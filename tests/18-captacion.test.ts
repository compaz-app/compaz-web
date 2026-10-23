/* eslint-disable */
// Bloque 1 · Captación en Supabase: normalización, /api/waitlist, cron de reintentos
// y entrega directa al CMC. La lógica SQL (identidad, repeticiones, cola) se prueba
// aparte, contra Postgres, en tests/sql/captacion.sql.
import { db, net, limpiar, req, cron, tgPara } from './harness'
import { beforeEach, afterEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizarTelefono, normalizarEmail, tipoDesdeContacto, separarUbicacion, claveIdempotencia,
  camposAirtableDesdeFila, comoRegistroAirtable,
} from '@/lib/captacion'
import { POST as waitlist } from '@/app/api/waitlist/route'
import { POST as reintentar } from '@/app/api/cron/reintentar-airtable/route'
import { GET as cmcGet, POST as cmcPost } from '@/app/api/interno/cmc/postulaciones/route'

// ── Airtable simulado ──────────────────────────────────────────────────────────
const airtable = { creados: [] as any[], fallar: 0 as number | 'siempre', estado: 422 }
const fetchHarness = globalThis.fetch
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input.url
  if (url.startsWith('https://api.airtable.com/v0/')) {
    if (airtable.fallar === 'siempre' || airtable.fallar > 0) {
      if (typeof airtable.fallar === 'number') airtable.fallar--
      return new Response(JSON.stringify({ error: { type: 'INVALID_REQUEST', message: 'límite de registros' } }), { status: airtable.estado })
    }
    const body = JSON.parse(init.body)
    const id = 'rec' + String(airtable.creados.length + 1).padStart(14, 'A')
    airtable.creados.push({ id, ...body.fields })
    return new Response(JSON.stringify({ id, fields: body.fields }), { status: 200 })
  }
  return fetchHarness(input, init)
}) as any

const ENV = { ...process.env }
beforeEach(() => {
  limpiar()
  airtable.creados = []; airtable.fallar = 0; airtable.estado = 422
  Object.assign(process.env, { AIRTABLE_API_KEY: 'patTEST', AIRTABLE_BASE_ID: 'appTESTTESTTEST12' })
  delete process.env.POSTULACIONES_DESTINO
  delete process.env.CMC_ENTREGA_SECRETO
})
afterEach(() => { for (const k of ['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'POSTULACIONES_DESTINO', 'CMC_ENTREGA_SECRETO']) { if (ENV[k] === undefined) delete process.env[k]; else process.env[k] = ENV[k] } })

let n = 0
function postulacion(extra: Record<string, any> = {}) {
  n++
  const email = `aspirante${n}@mail.test`
  return req('/api/waitlist', {
    json: {
      nombre: 'Ana Prueba', whatsapp: '+584121234567', email, ciudad: 'Chacao, Miranda',
      contacto: `WA: +584121234567 | Email: ${email} | Rol: compa`,
      website: '', turnstileToken: '', utmSource: 'meta', utmMedium: 'paid', utmCampaign: 'oct',
      utmContent: 'video-3', utmTerm: 'cuidado', fuente: 'se_compita',
      claveIdempotencia: '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90', ...extra,
    },
  })
}

/** Simula registrar_postulacion y marcar_envio_airtable con un resultado fijo. */
function simularSupabase(r: { resultado?: string; enviar?: boolean } = {}) {
  db.rpcs.registrar_postulacion = () => ({
    data: [{ postulacion_id: '11111111-1111-4111-8111-111111111111', persona_id: '22222222-2222-4222-8222-222222222222', resultado: r.resultado ?? 'registrada', enviar_a_airtable: r.enviar ?? true }],
    error: null,
  })
  db.rpcs.marcar_envio_airtable = (a: any) => ({ data: a.p_ok ? 'enviada' : 'error', error: null })
}
const llamadas = (fn: string) => db.rpcLlamadas.filter((l) => l.fn === fn)

// ── Normalización ──────────────────────────────────────────────────────────────
describe('Normalización', () => {
  test('teléfonos venezolanos en todas sus formas acaban en el mismo E.164', () => {
    for (const v of ['04121234567', '4121234567', '+584121234567', '584121234567', '+58 412-123-4567', '+5804121234567']) {
      assert.equal(normalizarTelefono(v), '+584121234567', v)
    }
    assert.equal(normalizarTelefono('02121234567'), '+582121234567')
    assert.equal(normalizarTelefono('+1 (305) 555-0100'), '+13055550100')
    for (const v of ['', 'abc', '+58123', '+5841212345678', '+0123456789']) assert.equal(normalizarTelefono(v), null, v)
  })
  test('correos, tipo, ubicación y clave', () => {
    assert.equal(normalizarEmail('  Ana.Perez@Gmail.COM '), 'ana.perez@gmail.com')
    assert.equal(normalizarEmail('sin-arroba'), null)
    assert.equal(tipoDesdeContacto('WA: x | Email: y | Rol: compa'), 'compita')
    assert.equal(tipoDesdeContacto('WA: x | Email: y | Rol: familia'), 'familia')
    assert.equal(tipoDesdeContacto('WA: x | Email: y | Rol: '), 'desconocido')
    assert.deepEqual(separarUbicacion('Chacao, Miranda'), { ciudad: 'Chacao', region: 'Miranda' })
    assert.deepEqual(separarUbicacion('Caracas'), { ciudad: 'Caracas', region: null })
    assert.equal(claveIdempotencia('3F2A9C1E-5B7D-4E8A-9C21-7D4E5F6A8B90'), '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90')
    assert.match(claveIdempotencia('no-es-uuid'), /^[0-9a-f-]{36}$/)
  })
  test('la copia a Airtable reconstruye el mismo formato que envía hoy el formulario', () => {
    const c = camposAirtableDesdeFila({ id: 'x', tipo: 'compita', nombre_declarado: 'Ana', telefono_declarado: '+584121234567', email_declarado: 'a@b.co',
      ubicacion_declarada: 'Chacao, Miranda', utm_source: 'meta', utm_medium: null, utm_campaign: 'oct', recibida_en: '2026-10-22T10:00:00Z' })
    assert.equal(c.contacto, 'WA: +584121234567 | Email: a@b.co | Rol: compa')
    assert.equal(c.utmMedium, '')
    assert.equal(c.fecha, '2026-10-22T10:00:00Z')
  })
})

// ── /api/waitlist ──────────────────────────────────────────────────────────────
describe('/api/waitlist', () => {
  test('sin POSTULACIONES_DESTINO: comportamiento anterior (solo Airtable, sin Supabase)', async () => {
    const res = await waitlist(postulacion())
    assert.equal(res.status, 200)
    assert.equal(airtable.creados.length, 1)
    assert.equal(db.rpcLlamadas.length, 0)
  })

  test('con Supabase: guarda primero en Supabase con datos normalizados y copia a Airtable igual que antes', async () => {
    process.env.POSTULACIONES_DESTINO = 'supabase_y_airtable'
    simularSupabase()
    const res = await waitlist(postulacion())
    assert.equal(res.status, 200)
    const [r] = llamadas('registrar_postulacion')
    assert.equal(r.args.p_tipo, 'compita')
    assert.equal(r.args.p_fuente, 'se_compita')
    assert.equal(r.args.p_telefono_e164, '+584121234567')
    assert.equal(r.args.p_ciudad, 'Chacao')
    assert.equal(r.args.p_region, 'Miranda')
    assert.equal(r.args.p_clave, '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90')
    assert.deepEqual(r.args.p_utm, { source: 'meta', medium: 'paid', campaign: 'oct', content: 'video-3', term: 'cuidado' })
    assert.equal(airtable.creados.length, 1)
    assert.equal(airtable.creados[0].Contacto, `WA: +584121234567 | Email: ${r.args.p_email_decl} | Rol: compa`)
    assert.equal(airtable.creados[0].Ciudad, 'Chacao, Miranda')
    assert.equal(airtable.creados[0]['UTM Content'], undefined, 'Airtable no recibe campos nuevos')
    const [m] = llamadas('marcar_envio_airtable')
    assert.equal(m.args.p_ok, true)
    assert.equal(m.args.p_airtable_id, airtable.creados[0].id)
  })

  test('Airtable caído o lleno: la persona recibe "ok" y la copia queda pendiente', async () => {
    process.env.POSTULACIONES_DESTINO = 'supabase_y_airtable'
    simularSupabase(); airtable.fallar = 'siempre'
    const res = await waitlist(postulacion())
    assert.equal(res.status, 200)
    const [m] = llamadas('marcar_envio_airtable')
    assert.equal(m.args.p_ok, false)
    assert.match(m.args.p_error, /HTTP 422/)
  })

  test('postulación repetida o reintento técnico: no se envía a Airtable (sin segunda bienvenida)', async () => {
    process.env.POSTULACIONES_DESTINO = 'supabase_y_airtable'
    for (const resultado of ['repetida', 'reintento_tecnico']) {
      simularSupabase({ resultado, enviar: false })
      const res = await waitlist(postulacion())
      assert.equal(res.status, 200, resultado)
    }
    assert.equal(airtable.creados.length, 0)
    assert.equal(llamadas('marcar_envio_airtable').length, 0)
  })

  test('Supabase caído: se guarda directamente en Airtable para no perder la postulación', async () => {
    process.env.POSTULACIONES_DESTINO = 'supabase_y_airtable'
    db.fail['registrar_postulacion:rpc'] = 1
    const res = await waitlist(postulacion())
    assert.equal(res.status, 200)
    assert.equal(airtable.creados.length, 1)
  })

  test('Supabase caído y Airtable sin configurar: error (nunca un "ok" falso)', async () => {
    process.env.POSTULACIONES_DESTINO = 'supabase_y_airtable'
    delete process.env.AIRTABLE_API_KEY
    db.fail['registrar_postulacion:rpc'] = 1
    const res = await waitlist(postulacion())
    assert.equal(res.status, 500)
  })

  test('honeypot: responde "ok" sin guardar nada', async () => {
    process.env.POSTULACIONES_DESTINO = 'supabase_y_airtable'
    simularSupabase()
    const res = await waitlist(postulacion({ website: 'http://spam.test' }))
    assert.equal(res.status, 200)
    assert.equal(db.rpcLlamadas.length, 0)
    assert.equal(airtable.creados.length, 0)
  })
})

// ── Cron de reintentos ────────────────────────────────────────────────────────
describe('/api/cron/reintentar-airtable', () => {
  const fila = (id: string) => ({ id, tipo: 'compita', nombre_declarado: 'Ana', telefono_declarado: '+584121234567', email_declarado: `${id}@b.co`,
    ubicacion_declarada: 'Chacao, Miranda', utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'oct', recibida_en: '2026-10-22T10:00:00Z' })

  test('sin secreto → 401; desactivado mientras POSTULACIONES_DESTINO no esté activo', async () => {
    assert.equal((await reintentar(cron('reintentar-airtable', null))).status, 401)
    const res = await reintentar(cron('reintentar-airtable'))
    assert.equal(res.status, 200)
    assert.deepEqual((await res.json()).data, { desactivado: true })
    assert.equal(db.rpcLlamadas.length, 0)
  })

  test('reenvía las pendientes, marca cada resultado y avisa una sola vez de las agotadas', async () => {
    process.env.POSTULACIONES_DESTINO = 'supabase_y_airtable'
    db.rpcs.reclamar_envios_airtable = () => ({ data: [fila('a'), fila('b')], error: null })
    db.rpcs.marcar_envio_airtable = (a: any) => ({ data: a.p_ok ? 'enviada' : 'agotada', error: null })
    db.rpcs.postulaciones_para_cmc = () => ({ data: [{ id: 'b' }], error: null })
    airtable.fallar = 1   // la primera falla, la segunda entra
    const res = await reintentar(cron('reintentar-airtable'))
    assert.equal(res.status, 200)
    const d = (await res.json()).data
    assert.equal(d.reclamadas, 2); assert.equal(d.enviadas, 1); assert.equal(d.agotadas, 1); assert.equal(d.agotadasSinEntregar, 1)
    assert.equal(airtable.creados[0].Contacto, 'WA: +584121234567 | Email: b@b.co | Rol: compa')
    assert.equal(tgPara('999').filter((m) => m.text.includes('sin copiar a Airtable')).length, 1)
    await reintentar(cron('reintentar-airtable'))
    assert.equal(tgPara('999').filter((m) => m.text.includes('sin copiar a Airtable')).length, 1, 'no repite el aviso el mismo día')
  })
})

// ── Entrega directa al CMC ────────────────────────────────────────────────────
describe('/api/interno/cmc/postulaciones', () => {
  const pend = { id: '33333333-3333-4333-8333-333333333333', recibida_en: '2026-10-22T10:00:00Z', tipo: 'compita', nombre: 'Ana', telefono: '+584121234567',
    email: 'a@b.co', ubicacion: 'Chacao, Miranda', utm_source: 'meta', utm_medium: null, utm_campaign: null, utm_content: 'v3', utm_term: null, coincidencia: 'nueva' }
  const conSecreto = (s: string | null, init: any = {}) =>
    req('/api/interno/cmc/postulaciones', { ...init, headers: s === null ? {} : { 'x-cmc-secreto': s } })

  test('desactivada sin CMC_ENTREGA_SECRETO; 401 con secreto incorrecto', async () => {
    assert.equal((await cmcGet(conSecreto('x'))).status, 404)
    process.env.CMC_ENTREGA_SECRETO = 'secreto-cmc'
    assert.equal((await cmcGet(conSecreto(null))).status, 401)
    assert.equal((await cmcGet(conSecreto('otro'))).status, 401)
  })

  test('lista con el formato de Airtable y confirma la entrega', async () => {
    process.env.CMC_ENTREGA_SECRETO = 'secreto-cmc'
    db.rpcs.postulaciones_para_cmc = () => ({ data: [pend], error: null })
    db.rpcs.confirmar_entrega_cmc = (a: any) => ({ data: a.p_ids.length, error: null })
    const res = await cmcGet(conSecreto('secreto-cmc'))
    assert.equal(res.status, 200)
    const [r] = (await res.json()).data.records
    assert.equal(r.id, 'sup33333333333343338333333333333333')
    assert.equal(r.fields.Contacto, 'WA: +584121234567 | Email: a@b.co | Rol: compa')
    assert.equal(r.fields['UTM Content'], 'v3')
    const conf = await cmcPost(conSecreto('secreto-cmc', { json: { ids: [pend.id, 'no-es-uuid'] } }))
    assert.equal((await conf.json()).data.confirmadas, 1)
    assert.deepEqual(llamadas('confirmar_entrega_cmc')[0].args.p_ids, [pend.id])
  })

  test('el id "sup…" nunca puede confundirse con un id de Airtable', () => {
    const r = comoRegistroAirtable(pend as any)
    assert.ok(!/^rec/.test(r.id))
  })
})
