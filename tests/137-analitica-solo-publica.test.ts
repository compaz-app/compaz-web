/* eslint-disable */
// Los scripts de medición de terceros (Clarity, Google Analytics, Meta) solo se cargan en las páginas públicas: nunca en el portal, el panel ni los enlaces con token.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { esRutaConAnalitica, RUTAS_CON_ANALITICA } from '@/lib/analitica-rutas'

describe('dónde se mide', () => {
  test('solo las páginas públicas de presentación', () => {
    for (const r of ['/', '/privacidad', '/se-compita', '/privacidad/', '/?utm_source=meta', '/se-compita#form']) assert.equal(esRutaConAnalitica(r), true, r)
  })
  test('nunca en las pantallas privadas, con token o de la familia', () => {
    for (const r of ['/portal', '/portal?sec=visitas', '/panel', '/dashboard', '/sala/abc123', '/reagendar/tok', '/onboarding', '/pago', '/compita/perfil', '/compitas', '/solicitar', '/llamada/ent-x', '/login', '/auth/callback', '/admin', '/cuenta', '/inventada']) assert.equal(esRutaConAnalitica(r), false, r)
    assert.equal(esRutaConAnalitica(null), false); assert.equal(esRutaConAnalitica(undefined), false)
  })
  test('es una lista de lo permitido: una pantalla nueva queda sin medición hasta que se agregue', () => {
    assert.deepEqual([...RUTAS_CON_ANALITICA].sort(), ['/', '/privacidad', '/se-compita'])
  })
})

describe('el código', () => {
  test('el diseño general ya no carga los scripts a mano: los pone el componente que mira la dirección', () => {
    const l = readFileSync('app/layout.tsx', 'utf8')
    assert.match(l, /<ScriptsAnaliticos /)
    for (const p of [/clarity\.ms\/tag/, /googletagmanager\.com\/gtag/, /connect\.facebook\.net/, /fbq\('init'/]) assert.doesNotMatch(l, p, `el diseño general sigue cargando ${p}`)
    const c = readFileSync('components/ScriptsAnaliticos.tsx', 'utf8')
    assert.match(c, /usePathname\(\)/); assert.match(c, /if \(!permitido\) return null/)
    for (const p of [/clarity\.ms\/tag/, /googletagmanager\.com\/gtag/, /connect\.facebook\.net/]) assert.match(c, p)
  })
  test('si ya se habían cargado y la persona pasa a una pantalla privada, se les pide parar', () => {
    const c = readFileSync('components/ScriptsAnaliticos.tsx', 'utf8')
    assert.match(c, /clarity\?\.\('stop'\)/); assert.match(c, /ga-disable-/); assert.match(c, /fbq\?\.\('consent', 'revoke'\)/)
  })
  test('ninguna pantalla privada carga estos scripts por su cuenta', () => {
    const pelos = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? pelos(`${d}/${e.name}`) : /\.(tsx|ts)$/.test(e.name) ? [`${d}/${e.name}`] : [])
    for (const f of pelos('app').filter((x) => !x.startsWith('app/layout'))) assert.doesNotMatch(readFileSync(f, 'utf8'), /clarity\.ms\/tag|googletagmanager\.com\/gtag\/js|connect\.facebook\.net/, f)
  })
})
