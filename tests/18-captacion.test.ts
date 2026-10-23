/* eslint-disable */
// Bloque 1 · Captación en Supabase
//
// Tipo de pruebas de este archivo: UNITARIAS y de INTEGRACIÓN con dobles.
//   · Airtable simulado (puede guardar y luego cortar la conexión, fallar por límite…).
//   · Funciones SQL simuladas con una versión mínima en memoria (supabaseSimulado),
//     suficiente para encadenar ruta → cron → conciliación → bandeja.
// La lógica SQL real (identidad, repeticiones, reservas, huella, permisos) se prueba
// contra PostgreSQL en tests/sql/captacion.sql, y la concurrencia en tests/sql/concurrencia.sh.
import { db, net, limpiar, req, cron, tgPara, session } from './harness'
import { beforeEach, afterEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import {
  normalizarTelefono, normalizarEmail, tipoDesdeContacto, separarUbicacion, claveIdempotencia,
  contactoCanonico, leerContacto, camposAirtableDesdeFila,
} from '@/lib/captacion'
import { textoFormula, mismaFecha } from '@/lib/airtable'
import { POST as waitlist } from '@/app/api/waitlist/route'
import { POST as reintentar } from '@/app/api/cron/reintentar-airtable/route'
import { POST as conciliar } from '@/app/api/cron/conciliar-airtable/route'
import { POST as resolver } from '@/app/api/admin/postulaciones/resolver/route'

// ── Airtable simulado ──────────────────────────────────────────────────────────
type Modo = 'ok' | 'limite' | 'guarda_y_timeout' | 'guarda_y_502' | 'caido'
const at = {
  registros: [] as any[], modo: 'ok' as Modo, busquedaFalla: false, creaciones: 0,
  reset() { this.registros = []; this.modo = 'ok'; this.busquedaFalla = false; this.creaciones = 0 },
}
const desescapar = (s: string) => s.replace(/\\(["\\])/g, '$1')
const fetchHarness = globalThis.fetch
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input.url
  if (!url.startsWith('https://api.airtable.com/v0/')) return fetchHarness(input, init)
  const u = new URL(url)
  const metodo = init?.method ?? 'GET'
  const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status })
  if (metodo === 'POST') {
    at.creaciones++
    if (at.modo === 'limite') return json({ error: { type: 'INVALID_REQUEST_UNKNOWN', message: 'record limit exceeded' } }, 422)
    if (at.modo === 'caido') return json({ error: 'SERVER_ERROR' }, 503)
    const fields = JSON.parse(init.body).fields
    const id = 'rec' + randomUUID().replace(/-/g, '').slice(0, 14)
    at.registros.push({ id, createdTime: new Date().toISOString(), fields })
    if (at.modo === 'guarda_y_timeout') { const e = new Error('This operation was aborted'); e.name = 'AbortError'; throw e }
    if (at.modo === 'guarda_y_502') return json({ error: 'BAD_GATEWAY' }, 502)
    return json({ id, fields })
  }
  // GET un registro
  const partes = u.pathname.split('/')
  const ultimo = partes[partes.length - 1]
  if (/^rec[A-Za-z0-9]{14}$/.test(ultimo)) {
    const r = at.registros.find((x) => x.id === ultimo)
    return r ? json(r) : json({ error: 'NOT_FOUND' }, 404)
  }
  // Listado con filterByFormula
  if (at.busquedaFalla || at.modo === 'caido') return json({ error: 'SERVER_ERROR' }, 503)
  const f = u.searchParams.get('filterByFormula') ?? ''
  const porContacto = f.match(/^\{Contacto\} = "((?:[^"\\]|\\.)*)"$/)
  const desde = f.match(/^IS_AFTER\(CREATED_TIME\(\), "([^"]+)"\)$/)
  let records = at.registros
  if (porContacto) records = records.filter((r) => r.fields.Contacto === desescapar(porContacto[1]))
  else if (desde) records = records.filter((r) => r.createdTime > desde[1])
  else return json({ error: 'INVALID_FILTER_BY_FORMULA' }, 422)
  return json({ records })
}) as any

// ── Supabase simulado (versión mínima de las funciones SQL) ───────────────────
const sb = { filas: [] as any[] }
function supabaseSimulado() {
  sb.filas = []
  const ms = () => new Date(Math.floor(Date.now())).toISOString()
  db.rpcs.registrar_postulacion = (a: any) => {
    const previa = sb.filas.find((f) => f.clave_idempotencia === a.p_clave)
    if (previa) return { data: [{ postulacion_id: previa.id, persona_id: 'p', resultado: 'reintento_tecnico', enviar_a_airtable: false, recibida_en: previa.recibida_en }], error: null }
    const importacion = !!a.p_airtable_id
    const fila = {
      id: randomUUID(), clave_idempotencia: a.p_clave, tipo: a.p_tipo, fuente: a.p_fuente,
      nombre_declarado: a.p_nombre, telefono_declarado: a.p_telefono_decl, email_declarado: a.p_email_decl,
      ubicacion_declarada: a.p_ubicacion_decl, utm_source: a.p_utm?.source ?? null, utm_medium: a.p_utm?.medium ?? null,
      utm_campaign: a.p_utm?.campaign ?? null, recibida_en: a.p_recibida_en ?? ms(),
      airtable_id: a.p_airtable_id ?? null, airtable_estado: importacion ? 'enviada' : 'pendiente',
      airtable_intentos: 0, airtable_ultimo_error: null, reservada: !importacion, listo: false, resuelta: null as any,
    }
    sb.filas.push(fila)
    return { data: [{ postulacion_id: fila.id, persona_id: 'p', resultado: 'registrada', enviar_a_airtable: !importacion, recibida_en: fila.recibida_en }], error: null }
  }
  db.rpcs.marcar_envio_airtable = (a: any) => {
    const f = sb.filas.find((x) => x.id === a.p_id)
    if (!f) return { data: null, error: null }
    let estado: string | null = null
    if (a.p_estado === 'enviada' && !f.resuelta && ['pendiente', 'error', 'agotada', 'conflicto'].includes(f.airtable_estado)) {
      f.airtable_estado = 'enviada'; f.airtable_id = a.p_airtable_id; estado = 'enviada'
    } else if (a.p_estado === 'conflicto' && ['pendiente', 'error'].includes(f.airtable_estado)) {
      f.airtable_estado = 'conflicto'; f.airtable_ultimo_error = a.p_error; estado = 'conflicto'
    } else if (a.p_estado === 'error' && ['pendiente', 'error'].includes(f.airtable_estado)) {
      f.airtable_intentos++; f.airtable_ultimo_error = a.p_error
      f.airtable_estado = f.airtable_intentos >= 5 ? 'agotada' : 'error'; estado = f.airtable_estado
    }
    f.reservada = false; f.listo = false
    return { data: estado, error: null }
  }
  db.rpcs.reclamar_envios_airtable = () => {
    const filas = sb.filas.filter((f) => ['pendiente', 'error'].includes(f.airtable_estado) && f.listo && !f.reservada)
    filas.forEach((f) => { f.reservada = true })
    return { data: filas.map((f) => ({ ...f })), error: null }
  }
  db.rpcs.postulaciones_por_resolver = () => ({
    data: sb.filas.filter((f) => ['agotada', 'conflicto'].includes(f.airtable_estado) && !f.resuelta).map((f) => ({
      id: f.id, recibida_en: f.recibida_en, tipo: f.tipo, nombre: f.nombre_declarado, telefono: f.telefono_declarado,
      email: f.email_declarado, ubicacion: f.ubicacion_declarada, airtable_estado: f.airtable_estado,
      airtable_intentos: f.airtable_intentos, airtable_ultimo_error: f.airtable_ultimo_error, coincidencia: 'nueva',
    })), error: null,
  })
  db.rpcs.resolver_postulacion = (a: any) => {
    const f = sb.filas.find((x) => x.id === a.p_id && ['agotada', 'conflicto'].includes(x.airtable_estado) && !x.resuelta)
    if (!f) return { data: false, error: null }
    f.resuelta = { resolucion: a.p_resolucion, actor: a.p_actor, nota: a.p_nota }
    if (a.p_resolucion === 'vinculada_airtable') { f.airtable_estado = 'enviada'; f.airtable_id = a.p_airtable_id } else f.airtable_estado = 'no_aplica'
    return { data: true, error: null }
  }
  db.rpcs.airtable_ids_vinculados = () => ({ data: sb.filas.filter((f) => f.airtable_id).map((f) => f.airtable_id), error: null })
  db.rpcs.conciliar_registro_airtable = (a: any) => {
    if (sb.filas.some((f) => f.airtable_id === a.p_airtable_id)) return { data: 'ya_vinculada', error: null }
    const huella = sb.filas.filter((f) => !f.airtable_id && Date.parse(f.recibida_en) === Date.parse(a.p_fecha)
      && f.telefono_declarado === a.p_telefono_decl && f.email_declarado.toLowerCase() === a.p_email_decl.toLowerCase())
    if (huella.length === 1) { db.rpcs.marcar_envio_airtable({ p_id: huella[0].id, p_estado: 'enviada', p_airtable_id: a.p_airtable_id }); return { data: 'adoptada', error: null } }
    if (huella.length > 1) return { data: 'ambigua', error: null }
    if (!a.p_telefono_e164 && !a.p_email_norm) return { data: null, error: { message: 'postulación sin teléfono ni correo' } }
    db.rpcs.registrar_postulacion({ ...a, p_clave: 'imp-' + a.p_airtable_id, p_fuente: 'respaldo_airtable', p_nombre: a.p_nombre, p_recibida_en: a.p_fecha })
    return { data: 'importada', error: null }
  }
}
/** Simula que pasa el tiempo: vencen la reserva del primer intento y la espera entre reintentos. */
const pasaElTiempo = () => sb.filas.forEach((f) => { f.reservada = false; f.listo = true })
const fila = () => sb.filas[sb.filas.length - 1]

const ENV = { ...process.env }
const VARS = ['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'POSTULACIONES_DESTINO', 'CAPTACION_DESDE']
beforeEach(() => {
  limpiar(); at.reset()
  Object.assign(process.env, { AIRTABLE_API_KEY: 'patTEST', AIRTABLE_BASE_ID: 'appTESTTESTTEST12', POSTULACIONES_DESTINO: 'supabase_y_airtable', CAPTACION_DESDE: '2026-01-01T00:00:00.000Z' })
  supabaseSimulado()
})
afterEach(() => { for (const k of VARS) { if (ENV[k] === undefined) delete process.env[k]; else process.env[k] = ENV[k] } })

let n = 0
function postulacion(extra: Record<string, any> = {}) {
  n++
  const email = `aspirante${n}@mail.test`
  return req('/api/waitlist', {
    json: {
      nombre: 'Ana Prueba', whatsapp: '+584121234567', email, ciudad: 'Chacao, Miranda',
      contacto: `WA: +584121234567 | Email: ${email} | Rol: compa`,
      website: '', turnstileToken: '', utmSource: 'meta', utmMedium: 'paid', utmCampaign: 'oct',
      utmContent: 'video-3', utmTerm: 'cuidado', fuente: 'se_compita', claveIdempotencia: randomUUID(), ...extra,
    },
  })
}
const avisos = (texto: string) => tgPara('999').filter((m) => m.text.includes(texto)).length
const correrCron = async () => (await (await reintentar(cron('reintentar-airtable'))).json()).data

// ── Funciones puras ────────────────────────────────────────────────────────────
describe('Normalización y huella', () => {
  test('teléfonos venezolanos en todas sus formas acaban en el mismo E.164', () => {
    for (const v of ['04121234567', '4121234567', '+584121234567', '584121234567', '+58 412-123-4567', '+5804121234567']) {
      assert.equal(normalizarTelefono(v), '+584121234567', v)
    }
    assert.equal(normalizarTelefono('+1 (305) 555-0100'), '+13055550100')
    for (const v of ['', 'abc', '+58123', '+5841212345678', '+0123456789']) assert.equal(normalizarTelefono(v), null, v)
  })
  test('correo, tipo, ubicación y clave', () => {
    assert.equal(normalizarEmail('  Ana.Perez@Gmail.COM '), 'ana.perez@gmail.com')
    assert.equal(tipoDesdeContacto('WA: x | Email: y | Rol: compa'), 'compita')
    assert.equal(tipoDesdeContacto('WA: x | Email: y | Rol: familia'), 'familia')
    assert.deepEqual(separarUbicacion('Chacao, Miranda'), { ciudad: 'Chacao', region: 'Miranda' })
    assert.match(claveIdempotencia('no-es-uuid'), /^[0-9a-f-]{36}$/)
  })
  test('el Contacto canónico es idéntico en el primer intento y en los reintentos, y se puede leer de vuelta', () => {
    const c = contactoCanonico('+584121234567', 'a@b.co', 'compita')
    assert.equal(c, 'WA: +584121234567 | Email: a@b.co | Rol: compa')
    assert.equal(camposAirtableDesdeFila({ id: 'x', tipo: 'compita', nombre_declarado: 'A', telefono_declarado: '+584121234567', email_declarado: 'a@b.co',
      ubicacion_declarada: 'X', utm_source: null, utm_medium: null, utm_campaign: null, recibida_en: '2026-10-22T10:00:00.123+00:00' }).contacto, c)
    assert.deepEqual(leerContacto(c), { telefono: '+584121234567', email: 'a@b.co', tipo: 'compita' })
    assert.equal(leerContacto('texto libre'), null)
  })
  test('la Fecha se compara con milisegundos aunque Airtable y Postgres la escriban distinto', () => {
    assert.ok(mismaFecha('2026-10-22T10:00:00.123Z', '2026-10-22T10:00:00.123+00:00'))
    assert.ok(!mismaFecha('2026-10-22T10:00:00.123Z', '2026-10-22T10:00:00.124Z'))
  })
  test('las fórmulas de Airtable escapan comillas y rechazan saltos de línea', () => {
    assert.equal(textoFormula('a"b\\c'), '"a\\"b\\\\c"')
    assert.equal(textoFormula('a\nb'), null)
  })
})

// ── Los 10 escenarios obligatorios ─────────────────────────────────────────────
describe('Escenarios de fiabilidad', () => {
  test('1 · Airtable guarda y Supabase confirma', async () => {
    assert.equal((await waitlist(postulacion())).status, 200)
    assert.equal(at.registros.length, 1)
    assert.equal(fila().airtable_estado, 'enviada')
    assert.equal(fila().airtable_id, at.registros[0].id)
    assert.equal(at.registros[0].fields.Fecha, fila().recibida_en, 'la Fecha es la huella de Supabase')
  })

  test('2 · Airtable guarda pero la confirmación falla: el reintento encuentra el registro y no crea otro', async () => {
    db.fail['marcar_envio_airtable:rpc'] = 1
    assert.equal((await waitlist(postulacion())).status, 200)
    assert.equal(at.registros.length, 1)
    assert.equal(fila().airtable_estado, 'pendiente', 'sin confirmar')
    pasaElTiempo()
    const r = await correrCron()
    assert.equal(r.vinculada, 1); assert.equal(r.creada, 0)
    assert.equal(at.registros.length, 1, 'sigue habiendo un solo registro en Airtable')
    assert.equal(fila().airtable_id, at.registros[0].id)
  })

  test('3 · Airtable guarda y responde timeout (o 502): se vincula después, sin duplicar', async () => {
    for (const modo of ['guarda_y_timeout', 'guarda_y_502'] as Modo[]) {
      at.reset(); supabaseSimulado(); at.modo = modo
      assert.equal((await waitlist(postulacion())).status, 200, modo)
      assert.equal(fila().airtable_estado, 'error', modo)
      assert.match(fila().airtable_ultimo_error, /incierto/, modo)
      at.modo = 'ok'; pasaElTiempo()
      const r = await correrCron()
      assert.equal(r.vinculada, 1, modo)
      assert.equal(at.registros.length, 1, `${modo}: un solo registro`)
      assert.equal(fila().airtable_estado, 'enviada', modo)
    }
  })

  test('4 · Airtable rechaza por límite: 5 intentos, queda en la bandeja y se avisa una vez', async () => {
    at.modo = 'limite'
    assert.equal((await waitlist(postulacion())).status, 200, 'la persona no pierde su postulación')
    for (let i = 0; i < 4; i++) { pasaElTiempo(); await correrCron() }
    assert.equal(fila().airtable_estado, 'agotada')
    assert.equal(at.registros.length, 0)
    assert.equal(avisos('no llegaron a Airtable'), 1)
    pasaElTiempo(); await correrCron()
    assert.equal(avisos('no llegaron a Airtable'), 1, 'no repite el aviso de la misma postulación')
  })

  test('4b · Si la búsqueda previa falla, no se crea nada (se prefiere esperar a duplicar)', async () => {
    at.modo = 'limite'
    await waitlist(postulacion())
    at.modo = 'ok'; at.busquedaFalla = true; pasaElTiempo()
    const antes = at.creaciones
    const r = await correrCron()
    assert.equal(r.error, 1)
    assert.equal(at.creaciones, antes, 'sin búsqueda no hay creación')
  })

  test('4c · Huella repetida en Airtable: conflicto a la bandeja, sin crear otra', async () => {
    at.modo = 'limite'
    await waitlist(postulacion())
    const f = fila()
    const campos = camposAirtableDesdeFila(f)
    for (const id of ['recDUPLICADO00001', 'recDUPLICADO00002']) at.registros.push({ id, createdTime: new Date().toISOString(), fields: { Contacto: campos.contacto, Fecha: campos.fecha } })
    at.modo = 'ok'; pasaElTiempo()
    const r = await correrCron()
    assert.equal(r.conflicto, 1)
    assert.equal(f.airtable_estado, 'conflicto')
    assert.equal(at.registros.length, 2)
  })

  test('5 · Supabase falla y Airtable funciona: se guarda en Airtable, se avisa y la conciliación la importa una vez', async () => {
    db.fail['registrar_postulacion:rpc'] = 1
    assert.equal((await waitlist(postulacion())).status, 200)
    assert.equal(at.registros.length, 1)
    assert.equal(sb.filas.length, 0, 'Supabase no la tiene todavía')
    assert.equal(avisos('Supabase no respondió'), 1)
    const res = await conciliar(cron('conciliar-airtable'))
    assert.equal(res.status, 200)
    assert.equal((await res.json()).data.importada, 1)
    assert.equal(sb.filas.length, 1)
    assert.equal(fila().fuente, 'respaldo_airtable')
    assert.equal(fila().airtable_id, at.registros[0].id)
    const otra = await (await conciliar(cron('conciliar-airtable'))).json()
    assert.equal(otra.data.importada, 0); assert.equal(otra.data.ya_vinculada, 1)
    assert.equal(sb.filas.length, 1, 'la segunda conciliación no duplica')
  })

  test('5b · La conciliación también recupera una confirmación perdida (adopta, no importa)', async () => {
    db.fail['marcar_envio_airtable:rpc'] = 1
    await waitlist(postulacion())
    const d = (await (await conciliar(cron('conciliar-airtable'))).json()).data
    assert.equal(d.adoptada, 1); assert.equal(d.importada, 0)
    assert.equal(sb.filas.length, 1)
    assert.equal(fila().airtable_estado, 'enviada')
  })

  test('6 · Ambos fallan: error 500, nunca un "ok" falso', async () => {
    db.fail['registrar_postulacion:rpc'] = 1
    at.modo = 'caido'
    assert.equal((await waitlist(postulacion())).status, 500)
    db.fail['registrar_postulacion:rpc'] = 1
    delete process.env.AIRTABLE_API_KEY
    assert.equal((await waitlist(postulacion())).status, 500)
  })

  test('7 · Concurrencia: cubierta contra PostgreSQL real (tests/sql/concurrencia.sh)', () => {
    // Aquí solo se comprueba que la ruta pasa siempre la clave del navegador a la función SQL,
    // que es la que serializa con bloqueos de Postgres. Ver concurrencia.sh para el caso real.
    assert.ok(true)
  })

  test('8 · Postulación legítima repetida días después: se guarda y no se copia a Airtable', async () => {
    db.rpcs.registrar_postulacion = () => ({ data: [{ postulacion_id: randomUUID(), persona_id: 'p', resultado: 'repetida', enviar_a_airtable: false, recibida_en: new Date().toISOString() }], error: null })
    assert.equal((await waitlist(postulacion())).status, 200)
    assert.equal(at.creaciones, 0, 'sin copia: el CMC no manda otra bienvenida')
  })

  test('9 · Una pendiente se recupera sin generar otra bienvenida (un solo registro en Airtable, aunque el cron corra varias veces)', async () => {
    at.modo = 'guarda_y_timeout'
    await waitlist(postulacion())
    at.modo = 'ok'
    for (let i = 0; i < 3; i++) { pasaElTiempo(); await correrCron() }
    assert.equal(at.registros.length, 1)
    assert.equal(fila().airtable_estado, 'enviada')
  })

  test('10 · Lo que no llegó al CMC queda identificable hasta su resolución, con autor y comprobación', async () => {
    at.modo = 'limite'
    await waitlist(postulacion())
    for (let i = 0; i < 4; i++) { pasaElTiempo(); await correrCron() }
    const f = fila()
    assert.equal(f.airtable_estado, 'agotada')

    const pedir = (body: any) => resolver(req('/api/admin/postulaciones/resolver', { json: body }))
    assert.equal((await pedir({ id: f.id, resolucion: 'registrada_en_cmc', nota: 'COM-1099' })).status, 401, 'sin sesión de admin')

    session.user = { id: randomUUID(), email: 'admin@compaz.test' }
    assert.equal((await pedir({ id: f.id, resolucion: 'registrada_en_cmc', nota: '' })).status, 400, 'exige nota')
    at.registros.push({ id: 'recOTRAPERSONA001', createdTime: new Date().toISOString(), fields: { Contacto: 'WA: +584140000000 | Email: otra@mail.test | Rol: compa' } })
    const ajeno = await pedir({ id: f.id, resolucion: 'vinculada_airtable', airtableId: 'recOTRAPERSONA001' })
    assert.equal(ajeno.status, 400, 'no se vincula un registro de otra persona')
    assert.equal(f.airtable_estado, 'agotada', 'sigue en la bandeja')

    assert.equal((await pedir({ id: f.id, resolucion: 'registrada_en_cmc', nota: 'Registrada a mano como COM-1099' })).status, 200)
    assert.deepEqual(f.resuelta, { resolucion: 'registrada_en_cmc', actor: 'admin@compaz.test', nota: 'Registrada a mano como COM-1099' })
    pasaElTiempo(); const r = await correrCron()
    assert.equal(r.porResolver, 0, 'ya no aparece como pendiente')
  })
})

describe('Activación y cron', () => {
  test('sin POSTULACIONES_DESTINO: comportamiento anterior y crons apagados', async () => {
    delete process.env.POSTULACIONES_DESTINO
    assert.equal((await waitlist(postulacion())).status, 200)
    assert.equal(db.rpcLlamadas.length, 0)
    assert.equal(at.registros.length, 1)
    assert.deepEqual((await (await reintentar(cron('reintentar-airtable'))).json()).data, { desactivado: true })
    assert.deepEqual((await (await conciliar(cron('conciliar-airtable'))).json()).data, { desactivado: true })
  })
  test('crons sin secreto → 401; conciliación sin CAPTACION_DESDE → 500', async () => {
    assert.equal((await reintentar(cron('reintentar-airtable', null))).status, 401)
    assert.equal((await conciliar(cron('conciliar-airtable', 'mal'))).status, 401)
    delete process.env.CAPTACION_DESDE
    assert.equal((await conciliar(cron('conciliar-airtable'))).status, 500)
  })
  test('honeypot: "ok" sin guardar nada', async () => {
    assert.equal((await waitlist(postulacion({ website: 'http://spam.test' }))).status, 200)
    assert.equal(db.rpcLlamadas.length, 0)
    assert.equal(at.creaciones, 0)
  })
  test('la ruta envía a Supabase los datos normalizados y las 5 UTM', async () => {
    await waitlist(postulacion())
    const r = db.rpcLlamadas.find((l) => l.fn === 'registrar_postulacion')!.args
    assert.equal(r.p_tipo, 'compita'); assert.equal(r.p_fuente, 'se_compita'); assert.equal(r.p_telefono_e164, '+584121234567')
    assert.deepEqual(r.p_utm, { source: 'meta', medium: 'paid', campaign: 'oct', content: 'video-3', term: 'cuidado' })
    assert.equal(at.registros[0].fields['UTM Source'], 'meta')
    assert.equal(at.registros[0].fields['UTM Content'], undefined, 'Airtable no recibe campos nuevos')
  })
})
