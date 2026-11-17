/* eslint-disable */
// Captación en Supabase (postulaciones). Desde nov-2026 las postulaciones se guardan SOLO en Supabase y el CMC las lee de ahí (/api/cmc/postulaciones):
// ya no hay copia a Airtable, ni reintentos, ni conciliación (ver docs/versiones.md 1.3.12).
//
// Tipo de pruebas de este archivo: UNITARIAS y de INTEGRACIÓN con dobles. La función SQL se simula con una versión mínima en memoria. La lógica SQL
// real (identidad, repeticiones, huella, permisos) se prueba contra PostgreSQL en tests/sql/captacion.sql y la concurrencia en tests/sql/concurrencia.sh.
import { db, limpiar, req, session, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import {
  normalizarTelefono, normalizarEmail, tipoDesdeContacto, separarUbicacion, claveIdempotencia,
  contactoCanonico, leerContacto, postulacionesPorResolver,
} from '@/lib/captacion'
import { POST as waitlist } from '@/app/api/waitlist/route'
import { POST as resolver } from '@/app/api/admin/postulaciones/resolver/route'

// ── Supabase simulado (versión mínima de las funciones SQL) ───────────────────
const sb = { filas: [] as any[] }
function supabaseSimulado() {
  sb.filas = []
  db.rpcs.registrar_postulacion = (a: any) => {
    const previa = sb.filas.find((f) => f.clave_idempotencia === a.p_clave)
    if (previa) return { data: [{ postulacion_id: previa.id, persona_id: 'p', resultado: 'reintento_tecnico', recibida_en: previa.recibida_en }], error: null }
    const fila = {
      id: randomUUID(), clave_idempotencia: a.p_clave, tipo: a.p_tipo, fuente: a.p_fuente,
      nombre_declarado: a.p_nombre, telefono_declarado: a.p_telefono_decl, email_declarado: a.p_email_decl,
      ubicacion_declarada: a.p_ubicacion_decl, utm_source: a.p_utm?.source ?? null, recibida_en: new Date().toISOString(),
      airtable_estado: 'pendiente', resuelta: null as any,
    }
    sb.filas.push(fila)
    return { data: [{ postulacion_id: fila.id, persona_id: 'p', resultado: 'registrada', recibida_en: fila.recibida_en }], error: null }
  }
  // La bandeja de «por resolver» son las filas que el sistema marcó como agotada o en conflicto (histórico anterior a nov-2026).
  db.rpcs.postulaciones_por_resolver = () => ({
    data: sb.filas.filter((f) => ['agotada', 'conflicto'].includes(f.airtable_estado) && !f.resuelta).map((f) => ({
      id: f.id, recibida_en: f.recibida_en, tipo: f.tipo, nombre: f.nombre_declarado, telefono: f.telefono_declarado,
      email: f.email_declarado, ubicacion: f.ubicacion_declarada, airtable_estado: f.airtable_estado, airtable_intentos: 5, airtable_ultimo_error: 'limite', coincidencia: 'nueva',
    })), error: null,
  })
  db.rpcs.resolver_postulacion = (a: any) => {
    const f = sb.filas.find((x) => x.id === a.p_id && ['agotada', 'conflicto'].includes(x.airtable_estado) && !x.resuelta)
    if (!f) return { data: false, error: null }
    f.resuelta = { resolucion: a.p_resolucion, actor: a.p_actor, nota: a.p_nota }; f.airtable_estado = 'no_aplica'
    return { data: true, error: null }
  }
}
const fila = () => sb.filas[sb.filas.length - 1]
beforeEach(() => { limpiar(); supabaseSimulado() })

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
const avisos = (texto: string) => avisosAdmin().filter((m) => m.text.includes(texto)).length

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
  test('el Contacto canónico (el formato que lee el CMC) se puede leer de vuelta', () => {
    const c = contactoCanonico('+584121234567', 'a@b.co', 'compita')
    assert.equal(c, 'WA: +584121234567 | Email: a@b.co | Rol: compa')
    assert.deepEqual(leerContacto(c), { telefono: '+584121234567', email: 'a@b.co', tipo: 'compita' })
    assert.equal(leerContacto('texto libre'), null)
  })
})

describe('La ruta guarda solo en Supabase', () => {
  test('familias y Compitas se guardan sin ninguna llamada a un servicio externo', async () => {
    const fetchReal = globalThis.fetch; let externas = 0
    globalThis.fetch = (async (i: any, o?: any) => { const u = typeof i === 'string' ? i : i.url; if (/airtable/i.test(u)) externas++; return fetchReal(i, o) }) as any
    try {
      assert.equal((await waitlist(postulacion())).status, 200); assert.equal(fila().tipo, 'compita')
      const email = 'familia.solo@mail.test'
      assert.equal((await waitlist(postulacion({ email, contacto: `WA: +584121234567 | Email: ${email} | Rol: familia` }))).status, 200); assert.equal(fila().tipo, 'familia')
      assert.equal(externas, 0)
    } finally { globalThis.fetch = fetchReal }
  })
  test('la ruta envía a Supabase los datos normalizados y las 5 UTM', async () => {
    await waitlist(postulacion())
    const r = db.rpcLlamadas.find((l) => l.fn === 'registrar_postulacion')!.args
    assert.equal(r.p_tipo, 'compita'); assert.equal(r.p_fuente, 'se_compita'); assert.equal(r.p_telefono_e164, '+584121234567')
    assert.deepEqual(r.p_utm, { source: 'meta', medium: 'paid', campaign: 'oct', content: 'video-3', term: 'cuidado' })
  })
  test('una postulación repetida días después se guarda (200)', async () => {
    db.rpcs.registrar_postulacion = () => ({ data: [{ postulacion_id: randomUUID(), persona_id: 'p', resultado: 'repetida', recibida_en: new Date().toISOString() }], error: null })
    assert.equal((await waitlist(postulacion())).status, 200)
  })
  test('honeypot: "ok" sin guardar nada', async () => {
    assert.equal((await waitlist(postulacion({ website: 'http://spam.test' }))).status, 200)
    assert.equal(db.rpcLlamadas.length, 0)
  })
  test('si Supabase falla, la persona ve un error (503), nunca un "ok" falso, y se avisa una vez', async () => {
    db.fail['registrar_postulacion:rpc'] = 2
    // El límite de avisos es por instancia (15 min): se adelanta el reloj para no depender de otras pruebas.
    const ahora = Date.now, base = ahora() + 3_600_000
    Date.now = () => base
    try {
      const r = await waitlist(postulacion())
      assert.equal(r.status, 503); assert.match((await r.json()).error, /Inténtalo de nuevo/)
      await waitlist(postulacion())
      assert.equal(avisos('no pudo enviar su postulación'), 1, 'como mucho un aviso cada 15 min')
    } finally { Date.now = ahora }
  })
})

describe('Bandeja de postulaciones por resolver (histórico)', () => {
  const pedir = (body: any) => resolver(req('/api/admin/postulaciones/resolver', { json: body }))
  test('lo que no llegó al CMC queda identificable hasta su resolución, con autor y nota', async () => {
    await waitlist(postulacion()); const f = fila(); f.airtable_estado = 'agotada'
    assert.equal((await postulacionesPorResolver()).length, 1)
    assert.equal((await pedir({ id: f.id, resolucion: 'registrada_en_cmc', nota: 'COM-1099' })).status, 401, 'sin sesión de admin')
    session.user = { id: randomUUID(), email: 'admin@compaz.test' }
    assert.equal((await pedir({ id: f.id, resolucion: 'registrada_en_cmc', nota: '' })).status, 400, 'exige nota')
    assert.equal((await pedir({ id: f.id, resolucion: 'vinculada_airtable', nota: 'x', airtableId: 'recAAAAAAAAAAAAAA' })).status, 400, 'ya no existe vincular a Airtable')
    assert.equal(f.airtable_estado, 'agotada', 'sigue en la bandeja')
    assert.equal((await pedir({ id: f.id, resolucion: 'registrada_en_cmc', nota: 'Registrada a mano como COM-1099' })).status, 200)
    assert.deepEqual(f.resuelta, { resolucion: 'registrada_en_cmc', actor: 'admin@compaz.test', nota: 'Registrada a mano como COM-1099' })
    assert.equal((await postulacionesPorResolver()).length, 0, 'ya no aparece como pendiente')
  })
  test('«no procede» también pide el motivo', async () => {
    await waitlist(postulacion()); fila().airtable_estado = 'conflicto'
    session.user = { id: randomUUID(), email: 'admin@compaz.test' }
    assert.equal((await pedir({ id: fila().id, resolucion: 'no_procede', nota: '' })).status, 400)
    assert.equal((await pedir({ id: fila().id, resolucion: 'no_procede', nota: 'Prueba interna' })).status, 200)
  })
})
