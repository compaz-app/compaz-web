/* eslint-disable */
// El sistema se explica solo: cuando frena algo (plazo entre envíos, máximo de intentos, límite diario) dice qué pasó, por qué existe la regla
// y cuándo o cómo seguir. Nunca "espera un momento" a secas. Y una prueba de guardia impide que un límite nuevo quede sin explicación.
import { db, net, limpiar, req, session, mkCliente, mkCompita, mkSolicitud, tgText, tgBtn, tgPara, emailsA } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { duracionTexto, haceTexto, cuandoTexto, explicarEspera, CATALOGO, type ClaveEspera } from '@/lib/esperas'
import { catalogoEsperas } from '@/lib/esperas-catalogo'
import { GET as esperasGet } from '@/app/api/admin/esperas/route'
import { POST as solicitar } from '@/app/api/solicitudes/route'
import { POST as insistir } from '@/app/api/pago/insistir/route'
import { POST as pagoSolicitar } from '@/app/api/pago/solicitar/route'
import { POST as accesoPost } from '@/app/api/auth/solicitar-acceso/route'
import { POST as verificar } from '@/app/api/auth/verificar-codigo/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as meInteresa } from '@/app/api/me-interesa/route'

beforeEach(limpiar)
const AHORA = new Date('2026-11-10T15:00:00.000Z') // 11:00 am en Caracas

describe('las frases de tiempo nunca prometen menos de lo que falta', () => {
  test('duración: redondea hacia arriba', () => {
    assert.equal(duracionTexto(10_000), 'unos segundos'); assert.equal(duracionTexto(61_000), '2 minutos'); assert.equal(duracionTexto(3_600_000), '1 hora')
    assert.equal(duracionTexto(3_600_001), '2 horas'); assert.equal(duracionTexto(9 * 3_600_000 - 1), '9 horas'); assert.equal(duracionTexto(3 * 86_400_000), '3 días')
  })
  test('hace: redondea hacia abajo', () => {
    assert.equal(haceTexto(5_000), 'hace un momento'); assert.equal(haceTexto(10 * 60_000), 'hace 10 minutos'); assert.equal(haceTexto(3.9 * 3_600_000), 'hace 3 horas')
  })
  test('cuándo: hoy, mañana, otro día y "en N minutos" si falta poco, en hora de Venezuela', () => {
    assert.equal(cuandoTexto(new Date('2026-11-10T20:40:00Z'), AHORA), 'hoy a las 4:40 pm')
    assert.equal(cuandoTexto(new Date('2026-11-11T13:00:00Z'), AHORA), 'mañana a las 9:00 am')
    assert.match(cuandoTexto(new Date('2026-11-14T13:00:00Z'), AHORA), /^el 14 nov a las 9:00 am$/)
    assert.equal(cuandoTexto(new Date(AHORA.getTime() + 5 * 60_000), AHORA), 'en 5 minutos')
  })
})

describe('cada restricción del catálogo se explica con razón y siguiente paso', () => {
  const claves = Object.keys(CATALOGO) as ClaveEspera[]
  test('todas dicen qué pasó, su razón EXACTA del catálogo y cómo o cuándo seguir', () => {
    for (const c of claves) {
      const e = explicarEspera(c, { desde: new Date(AHORA.getTime() - 10 * 60_000), duracionMs: 60 * 60_000, usados: 3, max: 3, ahora: AHORA })
      assert.ok(e.texto.includes(CATALOGO[c].porQue), `${c}: falta la razón`)
      assert.ok(e.texto.length > CATALOGO[c].porQue.length + 30, `${c}: falta qué pasó y el siguiente paso`)
      assert.doesNotMatch(e.texto, /undefined|NaN|null/, c)
      assert.doesNotMatch(e.texto, /^Espera un momento/i, c)
      assert.ok(e.resumen.length <= 110, `${c}: lo visible debe ser corto (${e.resumen.length})`)
      assert.ok(!e.resumen.includes(CATALOGO[c].porQue), `${c}: la razón no va a la vista`)
    }
  })
  test('las esperas por tiempo traen cuándo vuelve (fecha y segundos) y lo dicen en el texto', () => {
    const e = explicarEspera('recordatorio_reciente', { desde: new Date(AHORA.getTime() - 3 * 3_600_000), duracionMs: 12 * 3_600_000, ahora: AHORA })
    assert.equal(e.vuelveEn, new Date(AHORA.getTime() + 9 * 3_600_000).toISOString()); assert.equal(e.segundos, 9 * 3600)
    assert.match(e.resumen, /hace 3 horas/); assert.match(e.resumen, /hoy a las 8:00 pm/); assert.ok(!e.resumen.includes(e.porQue), 'la razón no va en el resumen'); assert.ok(e.resumen.length < 90, 'el resumen es corto')
  })
  test('el catálogo del panel trae TODAS las reglas con su valor de hoy, y respeta Ajustes', async () => {
    const lista = await catalogoEsperas()
    assert.deepEqual(lista.map((f) => f.clave).sort(), [...claves].sort())
    assert.ok(lista.every((f) => f.limita && f.porQue && f.valor))
    assert.match(lista.find((f) => f.clave === 'recordatorio_reciente')!.valor, /12 horas/)
    const { setAjuste, limpiarCacheAjustes } = await import('@/lib/ajustes'); await setAjuste({ clave: 'recordatorio_cliente_horas', valor: 24, actor: 'a@b.c' }); limpiarCacheAjustes()
    assert.match((await catalogoEsperas()).find((f) => f.clave === 'recordatorio_reciente')!.valor, /24 horas/)
  })
  test('GET /api/admin/esperas: con permiso de monitorear; sin sesión 401; cliente no entra', async () => {
    session.user = null; assert.equal((await esperasGet()).status, 401)
    session.user = { id: 'adm', email: 'admin@compaz.test' }; assert.equal((await esperasGet()).status, 200)
    session.user = { id: 'c', email: 'cli@mail.test' }; assert.ok([401, 403].includes((await esperasGet()).status))
  })
})

describe('lo que ve cada persona cuando algo se frena', () => {
  test('cliente: avisar de nuevo que pagó a los pocos minutos explica por qué no se alerta otra vez y cuándo podrá', async () => {
    const c = mkCliente({ nombre: 'Carolina', email: 'caro@mail.test' }); session.user = { id: c.id, email: c.email, user_metadata: { nombre: c.nombre } } as any
    await pagoSolicitar(req('/api/pago/solicitar', { json: { tipo: 'plan', plan: 'quincenal', metodo: 'zelle' } }))
    const r1 = await (await insistir()).json(); assert.equal(r1.data.alertado, true); assert.equal(r1.data.mensaje, null)
    const r2 = await (await insistir()).json(); assert.equal(r2.data.alertado, false)
    assert.match(r2.data.resumen, /Ya avisamos al equipo hace un momento/); assert.match(r2.data.resumen, /Podrás avisar de nuevo en 30 minutos/); assert.ok(r2.data.resumen.length < 90)
    assert.match(r2.data.porQue, /marcado como urgente/); assert.match(r2.data.porQue, /una sola alerta urgente por ventana/); assert.doesNotMatch(r2.data.resumen, /una sola alerta/)
  })
  test('cliente: el límite de solicitudes por día dice cuántas, por qué y a qué hora se libera un cupo', async () => {
    const c = mkCliente({ email: 'caro@mail.test' }); session.user = { id: c.id, email: c.email } as any
    for (let i = 0; i < 5; i++) mkSolicitud(c, mkCompita(), { created_at: new Date(Date.now() - (23 - i) * 3600_000).toISOString() })
    const r = await solicitar(req('/api/solicitudes', { json: { compita_id: mkCompita().id, tipo: 'directa', que: 'Compañía y conversación', lugar_privado: false } }))
    assert.equal(r.status, 429); const j = await r.json(); const m = j.error
    assert.match(m, /Llegaste al máximo de 5 solicitudes por día/); assert.match(m, /Podrás enviar otra (en|hoy|mañana)/); assert.match(j.porQue, /pocas solicitudes/)
    assert.doesNotMatch(m, /pocas solicitudes/, 'la razón va aparte, detrás del ⓘ'); assert.doesNotMatch(m, /Espera 24 horas/)
  })
  test('cliente: pedir otra vez al mismo compita dice cuándo se puede', async () => {
    const c = mkCliente({ email: 'caro@mail.test' }); const k = mkCompita({ telegram_chat_id: '9955' }); session.user = { id: c.id, email: c.email } as any
    db.seed('action_tokens', { cliente_id: c.id, compita_id: k.id, created_at: new Date(Date.now() - 2 * 3600_000).toISOString() })
    const r = await meInteresa(req('/api/me-interesa', { json: { compita_id: k.id } })); assert.equal(r.status, 429)
    const j = await r.json(); assert.match(j.error, /hace 2 horas/); assert.match(j.error, /Podrás enviar otra/); assert.match(j.porQue, /Telegram del compita/)
  })
  test('cliente: pedir enlaces seguidos desde una conexión dice cuánto esperar', async () => {
    mkCliente({ email: 'caro@mail.test' }); let ultima: any
    for (let i = 0; i < 12; i++) { db.rows('telegram_estados').filter((e) => e.chat_id.startsWith('acc_mail:')).forEach((e) => (e.updated_at = new Date(Date.now() - 120_000).toISOString())); ultima = await accesoPost(req('/api/auth/solicitar-acceso', { json: { email: 'caro@mail.test' }, headers: { 'x-nf-client-connection-ip': '7.7.7.7' } })) }
    assert.equal(ultima.status, 429); const j = await ultima.json(); const m = j.error
    assert.match(m, /Pediste muchos enlaces en la última hora/); assert.match(m, /Espera (\d+ minutos|1 hora)/); assert.match(m, /spam/); assert.match(j.porQue, /Protege las cuentas/)
  })
  test('cliente: fallar el código varias veces dice cuántas, por qué es así y cuánto esperar', async () => {
    mkCliente({ email: 'caro@mail.test' }); let ultima: any
    for (let i = 0; i < 6; i++) ultima = await verificar(req('/api/auth/verificar-codigo', { json: { email: 'caro@mail.test', codigo: '12345678' }, headers: { 'x-nf-client-connection-ip': '8.8.8.8' } }))
    assert.equal(ultima.status, 429); const j = await ultima.json(); const m = j.error
    assert.match(m, /Fallaste el código 5 veces/); assert.match(m, /Pide uno nuevo/); assert.match(m, /espera \d+ minutos/); assert.match(j.porQue, /nadie pueda adivinar/)
  })
  test('compita: recordarle al cliente dos veces seguidas explica la espera de 12 horas y a qué hora vuelve', async () => {
    const compita = mkCompita({ telegram_chat_id: '9956', nombre: 'María Pérez' }); const cliente = mkCliente({ email: 'caro@mail.test' })
    const s = mkSolicitud(cliente, compita, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [] })
    await webhook(tgBtn('9956', `rc:hora:${s.id}`)); await webhook(tgBtn('9956', `rc:hora:${s.id}`))
    const t = tgPara('9956').at(-1)!.text
    assert.match(t, /Ya se lo recordaste hace un momento/); assert.match(t, /Podrás volver a hacerlo (hoy|mañana|en)/)
    // la razón va en un bloque desplegable de Telegram, no a la vista
    assert.match(t, /<blockquote expandable>¿Por qué\? [\s\S]*no llenarle el correo/)
  })
})

// GUARDIA: toda respuesta 429 del servidor debe construirse con explicarEspera, para que un límite nuevo nunca quede mudo o vago.
describe('guardia: ningún límite nuevo queda sin explicar', () => {
  const rutas: string[] = []
  const recorre = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) recorre(p); else if (f === 'route.ts') rutas.push(p) } }
  recorre(join(process.cwd(), 'app/api'))
  test('las rutas que responden 429 usan explicarEspera', () => {
    const sin = rutas.filter((r) => /429/.test(readFileSync(r, 'utf8')) && !/explicarEspera/.test(readFileSync(r, 'utf8')))
    assert.deepEqual(sin, [], `Rutas con 429 sin explicación: ${sin.join(', ')}`)
  })
  test('no quedan frases vagas de espera en el código', () => {
    const vagas = /Espera un momento|Espera un rato|Espera unos minutos|Demasiados intentos\.|Intenta de nuevo más tarde|demasiadas solicitudes hoy/
    const malas = rutas.filter((r) => vagas.test(readFileSync(r, 'utf8')))
    assert.deepEqual(malas, [], `Frases vagas en: ${malas.join(', ')}`)
  })
})
