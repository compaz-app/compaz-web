/* eslint-disable */
// Privacidad de la analítica (2026-11-17, antes de conectar la lectura real del CMC):
// Clarity, Google Analytics y Meta Pixel solo en las páginas públicas; ningún dato personal en grabaciones, direcciones,
// eventos ni registros. Las campañas y conversiones públicas no cambian.
import './harness'
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { RUTAS_CON_ANALITICA, rutaConAnalitica } from '@/lib/analitica'
import { CmcError, pingCmc } from '@/lib/cmc-api'
import { cargarFichaReal } from '@/lib/confianza/lectura-real'

const leer = (f: string) => readFileSync(f, 'utf8')
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = `${d}/${n}`; return statSync(p).isDirectory() ? walk(p) : [p] })
/** Rutas de página de app/ (sin grupos ni segmentos dinámicos resueltos). */
const rutasDePagina = () => walk('app').filter((f) => /\/page\.tsx$/.test(f)).map((f) => f.replace(/^app/, '').replace(/\/page\.tsx$/, '').replace(/\/\([^)]+\)/g, '') || '/')

describe('dónde se carga la analítica', () => {
  test('solo las páginas públicas de captación se miden; las demás (y las futuras) quedan fuera', () => {
    assert.deepEqual([...RUTAS_CON_ANALITICA], ['/', '/se-compita', '/privacidad'])
    for (const r of RUTAS_CON_ANALITICA) assert.ok(rutasDePagina().includes(r), `${r} debe existir como página`)
    for (const r of ['/se-compita/', '/privacidad/']) assert.equal(rutaConAnalitica(r), true, r)
    const privadas = rutasDePagina().filter((r) => !(RUTAS_CON_ANALITICA as readonly string[]).includes(r))
    assert.ok(privadas.length > 15)
    for (const r of privadas) assert.equal(rutaConAnalitica(r), false, `${r} no debe medirse`)
    for (const r of ['/panel', '/panel/', '/admin', '/dashboard', '/portal', '/sala/abc', '/reagendar/x', '/onboarding', '/compita/perfil', '/pago', '/login', '/solicitar', '/compitas', '/feedback/1', '/llamada/x', '/cuenta/eliminar', '/se-compita/otra', '/ruta-nueva', '', null, undefined])
      assert.equal(rutaConAnalitica(r as any), false, String(r))
  })
  test('ningún archivo carga Clarity, GA o Meta fuera de components/Analitica.tsx', () => {
    const PATRON = /clarity\.ms\/tag|googletagmanager\.com\/gtag|fbevents\.js|facebook\.com\/tr\?/
    const archivos = [...walk('app'), ...walk('components'), ...walk('lib')].filter((f) => /\.(tsx?|js)$/.test(f))
    assert.deepEqual(archivos.filter((f) => PATRON.test(leer(f))), ['components/Analitica.tsx'])
    const layout = leer('app/layout.tsx')
    assert.match(layout, /<Analitica \/>/)
    assert.doesNotMatch(layout, /clarity\(|gtag\(|fbq\(|META_PIXEL|GA_MEASUREMENT/)
  })
  test('Analitica no pinta nada en una ruta privada y corta la medición al entrar en una sin recargar', () => {
    const s = leer('components/Analitica.tsx')
    assert.match(s, /const publica = rutaConAnalitica\(ruta\)/)
    assert.match(s, /if \(!publica\) return null/)
    assert.match(s, /\[`ga-disable-\$\{GA_ID\}`\] = !publica/)
    assert.match(s, /w\.clarity\('stop'\)/)
    assert.match(s, /fbq\.disablePushState = true;/, 'Meta no debe seguir solo la navegación interna (llegaría a rutas privadas)')
    assert.ok(s.indexOf('fbq.disablePushState') < s.indexOf("fbq('init'"), 'disablePushState va antes de init')
    assert.match(s, /\$\{CLARITY_ID\}/)
  })
})

describe('la medición comercial pública sigue igual', () => {
  test('PageView inicial y conversiones: form_submit (GA) y Lead (Meta) en la portada y en /se-compita', () => {
    const a = leer('components/Analitica.tsx')
    assert.match(a, /gtag\('config', '\$\{GA_ID\}'\)/)
    assert.match(a, /fbq\('init', '\$\{META_ID\}'\);\nfbq\('track', 'PageView'\);/)
    assert.match(a, /w\.fbq\?\.\('track', 'PageView'\)/, 'las navegaciones internas entre páginas públicas siguen contando')
    const portada = leer('app/page.tsx')
    assert.match(portada, /gtag\?\.\("event", "form_submit", \{ event_category: "waitlist" \}\)/)
    assert.match(portada, /fbq\?\.\(\s*"track",\s*"Lead"\s*\)/)
    assert.match(portada, /utm_source|utmSource/)
    const sc = leer('app/se-compita/SeCompita.tsx')
    assert.match(sc, /gtag\?\.\('event', 'form_submit', \{ event_category: 'waitlist', compita: true \}\)/)
    assert.match(sc, /fbq\?\.\('track', 'Lead'\)/)
  })
  test('ningún evento de analítica lleva datos personales', () => {
    const chat = leer('components/ChatWidget.tsx')
    assert.doesNotMatch(chat, /message_text|trackEvent\([^)]*trimmed(?!\.length)/)
    for (const f of [...walk('app'), ...walk('components')].filter((x) => /\.tsx?$/.test(x))) {
      const s = leer(f)
      for (const m of s.matchAll(/(gtag|fbq)\??\.?\(([^;\n]*)\)/g))
        assert.doesNotMatch(m[2], /nombre|email|correo|phone|telefono|whatsapp|form\.|mensaje|trimmed(?!\.length)/i, `${f}: ${m[0].slice(0, 80)}`)
    }
  })
  test('Clarity no graba lo que se escribe en los formularios ni en el chat públicos', () => {
    assert.match(leer('app/page.tsx'), /<form onSubmit=\{handleSubmit\}[^>]*data-clarity-mask="True"/)
    assert.match(leer('app/se-compita/SeCompita.tsx'), /<form onSubmit=\{handleSubmit\}[^>]*data-clarity-mask="True"/)
    assert.match(leer('components/ChatWidget.tsx'), /data-clarity-mask="True"\s+className=\{`chat-window/)
  })
})

describe('búsqueda del CMC fuera de la dirección', () => {
  test('la vista real nunca escribe la búsqueda en la URL ni en los enlaces', () => {
    const s = leer('components/panel/confianza/ConfianzaReal.tsx')
    assert.doesNotMatch(s, /set\('cf_q'|pon\('cf_q', (?!null)/)
    assert.match(s, /pon\('cf_q', null\)/, 'una dirección vieja con cf_q se limpia')
    assert.match(s, /u\.delete\('cf_q'\)/)
    assert.doesNotMatch(s, /inicial\.get\('cf_q'\)/)
    assert.match(s, /sessionStorage/)
    assert.doesNotMatch(leer('app/panel/page.tsx'), /confianza: \[[^\]]*'cf_q'/)
  })
  test('la ficha real y sus pestañas no llevan la búsqueda', () => {
    const p = leer('app/panel/page.tsx')
    assert.match(p, /hrefTab=\{\(t\) => enlace\(\{ cf_tab/)
    assert.doesNotMatch(leer('components/panel/confianza/FichaReal.tsx'), /cf_q/)
  })
})

describe('registros y errores sin datos personales', () => {
  const URL_API = 'https://script.google.com/macros/s/AKfycbSINTETICO_de_prueba-123/exec'
  const PII = 'Ana Ficticia +580000000000 ana@correo.com'
  test('un error del CMC con texto libre no pasa a los registros: solo códigos', async () => {
    const env = { ...process.env }; const antes = globalThis.fetch; const err = console.error; const logs: string[] = []
    process.env.CMC_API_URL = URL_API; process.env.CMC_API_TOKEN = 'k'.repeat(56)
    console.error = (...a: unknown[]) => { logs.push(a.map(String).join(' ')) }
    try {
      globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: PII }))) as any
      await assert.rejects(pingCmc(), (e: any) => e instanceof CmcError && e.codigo === 'respuesta_invalida' && !e.message.includes('Ana'))
      const r = await cargarFichaReal('COM-9001')
      assert.deepEqual(r, { estado: 'error', codigo: 'respuesta_invalida' })
      globalThis.fetch = (async () => { throw new Error(PII) }) as any
      assert.deepEqual(await cargarFichaReal('COM-9002'), { estado: 'error', codigo: 'sin_conexion' })
      assert.ok(logs.length >= 2)
      for (const l of logs) assert.doesNotMatch(l, /Ana|\+58|@correo/, l)
    } finally { globalThis.fetch = antes; console.error = err; process.env.CMC_API_URL = env.CMC_API_URL; process.env.CMC_API_TOKEN = env.CMC_API_TOKEN; if (!env.CMC_API_URL) delete process.env.CMC_API_URL; if (!env.CMC_API_TOKEN) delete process.env.CMC_API_TOKEN }
  })
  test('la API de Apps Script solo registra la operación y el código', () => {
    const gs = leer('docs/cmc/api-panel.gs')
    const logs = [...gs.matchAll(/console\.(log|error)\(([^;]*)\);/g)].map((m) => m[2])
    assert.deepEqual(logs, ["'[cmcApi] error', String((err && err.stack) || err)", "'[cmcApi] ' + p.op + (id ? ' ' + id : '') + ' ' + (Date.now() - t0) + ' ms'"])
  })
  test('existe la política de privacidad pública que hay que actualizar al cambiar la analítica', () => assert.ok(existsSync('app/privacidad/page.tsx')))
})
