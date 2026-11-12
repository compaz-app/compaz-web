// Cancelaciones: se registran con su aviso, se marcan tardías según Ajustes, se pueden justificar y alimentan
// el nivel del compita (revisión o pausa). La ruta de cancelar sigue igual que antes y además deja el registro.
import { db, net, session, limpiar, req, mkCompita, mkCliente, mkVisita, tgPara } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { horasDeAviso, registrarCancelacion, marcarJustificada, resumenCancelacionesCompita } from '@/lib/cancelaciones'
import { limpiarCacheAjustes, setAjuste } from '@/lib/ajustes'
import { POST as cancelarRuta } from '@/app/api/visita/cancelar/route'

beforeEach(() => { limpiar(); limpiarCacheAjustes() })

/** Fecha y hora (hora de Venezuela) que quedan a `horas` horas de `ahora`. */
function visitaEn(horas: number, ahora: Date) {
  const t = new Date(ahora.getTime() + horas * 3_600_000 - 4 * 3_600_000) // a hora de Venezuela (UTC-4)
  const iso = t.toISOString()
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) }
}
const AHORA = new Date('2026-11-09T15:00:00.000Z')

describe('horas de aviso', () => {
  test('cuenta las horas hasta la visita en hora de Venezuela', () => {
    // 10:00 en Caracas = 14:00 UTC; son las 15:00 UTC → ya pasó 1 hora; mañana 10:00 → faltan 23 h
    assert.equal(horasDeAviso('2026-11-10', '10:00', AHORA), 23)
    assert.equal(horasDeAviso('2026-11-09', '10:00', AHORA), -1)
    assert.equal(horasDeAviso('2026-11-12', '16:30:00', AHORA), 77.5) // 16:30 en Caracas = 20:30 UTC; faltan 3 días y 5,5 h
  })
  test('sin fecha o con fecha inválida no hay aviso calculable', () => {
    assert.equal(horasDeAviso(null, null, AHORA), null)
    assert.equal(horasDeAviso('', '10:00', AHORA), null)
    assert.equal(horasDeAviso('mañana', '10:00', AHORA), null)
    assert.equal(horasDeAviso('2026-13-45', '10:00', AHORA), null)
  })
})

describe('registrar una cancelación', () => {
  test('cliente con menos de 24 h es tardía; con más, a tiempo; sin fecha no cuenta como tardía', async () => {
    const c = mkCompita(); const u = mkCliente()
    const v1 = visitaEn(10, AHORA), v2 = visitaEn(48, AHORA)
    await registrarCancelacion({ compitaId: c.id, usuarioId: u.id, canceladoPor: 'cliente', fechaProgramada: v1.fecha, horaInicioProgramada: v1.hora, ahora: AHORA })
    await registrarCancelacion({ compitaId: c.id, usuarioId: u.id, canceladoPor: 'cliente', fechaProgramada: v2.fecha, horaInicioProgramada: v2.hora, ahora: AHORA })
    await registrarCancelacion({ compitaId: c.id, usuarioId: u.id, canceladoPor: 'cliente', ahora: AHORA })
    const f = db.rows('cancelaciones')
    assert.deepEqual(f.map((x) => x.tardia), [true, false, false])
    assert.equal(f[0].horas_de_aviso, 10)
    assert.equal(f[2].horas_de_aviso, null)
  })

  test('el umbral sale de Ajustes: con aviso mínimo de 12 h, una cancelación de compita a 18 h es a tiempo', async () => {
    const c = mkCompita(); const u = mkCliente(); const v = visitaEn(18, AHORA)
    await registrarCancelacion({ compitaId: c.id, usuarioId: u.id, canceladoPor: 'compita', fechaProgramada: v.fecha, horaInicioProgramada: v.hora, ahora: AHORA })
    assert.equal(db.rows('cancelaciones')[0].tardia, true, 'con el mínimo de 24 h es tardía')
    await setAjuste({ clave: 'compita_aviso_minimo_horas', valor: 12, actor: 'admin:a' })
    await registrarCancelacion({ compitaId: c.id, usuarioId: u.id, canceladoPor: 'compita', fechaProgramada: v.fecha, horaInicioProgramada: v.hora, ahora: AHORA })
    assert.equal(db.rows('cancelaciones')[1].tardia, false)
  })

  test('el administrador o el sistema nunca generan una cancelación tardía', async () => {
    const c = mkCompita(); const u = mkCliente(); const v = visitaEn(1, AHORA)
    await registrarCancelacion({ compitaId: c.id, usuarioId: u.id, canceladoPor: 'admin', fechaProgramada: v.fecha, horaInicioProgramada: v.hora, ahora: AHORA })
    await registrarCancelacion({ compitaId: c.id, usuarioId: u.id, canceladoPor: 'sistema', fechaProgramada: v.fecha, horaInicioProgramada: v.hora, ahora: AHORA })
    assert.deepEqual(db.rows('cancelaciones').map((x) => x.tardia), [false, false])
  })

  test('deja un evento visita_cancelada sin el texto libre del cliente (puede traer contactos)', async () => {
    const c = mkCompita(); const u = mkCliente(); const vis = mkVisita(u, c, { estado: 'pre_visita' })
    await registrarCancelacion({ visitaId: vis.id, compitaId: c.id, usuarioId: u.id, canceladoPor: 'cliente', motivo: 'Llámame al 305 555 1234' })
    const e = db.rows('eventos').find((x) => x.tipo === 'visita_cancelada')!
    assert.equal(e.entidad, 'visita'); assert.equal(e.entidad_id, vis.id)
    assert.equal(e.actor, `cliente:${u.id}`)
    assert.deepEqual(Object.keys(e.datos).sort(), ['cancelado_por', 'horas_de_aviso', 'tardia'])
    assert.ok(!JSON.stringify(e.datos).includes('305'))
    assert.match(db.rows('cancelaciones')[0].motivo, /305 555 1234/, 'el texto sí queda en la tabla, que solo ve el administrador')
  })

  test('un motivo largo se recorta a 500 caracteres', async () => {
    await registrarCancelacion({ compitaId: mkCompita().id, usuarioId: mkCliente().id, canceladoPor: 'cliente', motivo: 'x'.repeat(900) })
    assert.equal(db.rows('cancelaciones')[0].motivo.length, 500)
  })

  test('si el registro falla no lanza ni rompe el flujo: devuelve null', async () => {
    db.fail['cancelaciones:insert'] = 1
    const id = await registrarCancelacion({ compitaId: mkCompita().id, usuarioId: mkCliente().id, canceladoPor: 'cliente' })
    assert.equal(id, null)
    assert.equal(db.rows('cancelaciones').length, 0)
  })
})

describe('justificar y nivel del compita', () => {
  const tardias = async (compitaId: string, n: number, canceladoPor: 'compita' | 'cliente' = 'compita') => {
    const u = mkCliente(); const v = visitaEn(3, AHORA)
    const ids: string[] = []
    for (let i = 0; i < n; i++) ids.push((await registrarCancelacion({ compitaId, usuarioId: u.id, canceladoPor, fechaProgramada: v.fecha, horaInicioProgramada: v.hora, ahora: AHORA }))!)
    return ids
  }

  test('2 tardías abren revisión y 3 pausan; los umbrales salen de Ajustes', async () => {
    const c = mkCompita()
    await tardias(c.id, 1)
    assert.equal((await resumenCancelacionesCompita(c.id, AHORA)).nivel, 'normal')
    await tardias(c.id, 1)
    assert.equal((await resumenCancelacionesCompita(c.id, AHORA)).nivel, 'revision')
    await tardias(c.id, 1)
    const r = await resumenCancelacionesCompita(c.id, AHORA)
    assert.deepEqual([r.total, r.tardias, r.cuentanContra, r.nivel], [3, 3, 3, 'pausa'])
    await setAjuste({ clave: 'canc_pausa', valor: 5, actor: 'admin:a' })
    assert.equal((await resumenCancelacionesCompita(c.id, AHORA)).nivel, 'revision')
  })

  test('una justificada deja de contar en su contra y queda un evento con quién la marcó', async () => {
    const c = mkCompita()
    const ids = await tardias(c.id, 3)
    assert.equal(await marcarJustificada({ id: ids[0], justificada: true, actor: 'admin:ana@compaz.test' }), true)
    const r = await resumenCancelacionesCompita(c.id, AHORA)
    assert.deepEqual([r.tardias, r.cuentanContra, r.nivel], [3, 2, 'revision'])
    const fila = db.rows('cancelaciones').find((x) => x.id === ids[0])!
    assert.equal(fila.justificada, true); assert.equal(fila.justificada_por, 'admin:ana@compaz.test')
    const e = db.rows('eventos').find((x) => x.tipo === 'cancelacion_justificada')!
    assert.equal(e.entidad, 'compita'); assert.equal(e.actor, 'admin:ana@compaz.test'); assert.equal(e.datos.justificada, true)
    // quitar la marca la vuelve a contar y también queda anotado
    await marcarJustificada({ id: ids[0], justificada: false, actor: 'admin:ana@compaz.test' })
    assert.equal((await resumenCancelacionesCompita(c.id, AHORA)).cuentanContra, 3)
    assert.equal(db.rows('eventos').filter((x) => x.tipo === 'cancelacion_justificada').length, 2)
  })

  test('solo cuentan las del compita, dentro de la ventana y de ese compita', async () => {
    const c = mkCompita(); const otro = mkCompita()
    await tardias(c.id, 1)
    await tardias(c.id, 2, 'cliente') // canceló el cliente: no es culpa del compita
    await tardias(otro.id, 3)
    const vieja = (await tardias(c.id, 1))[0]
    db.rows('cancelaciones').find((x) => x.id === vieja)!.creado_en = new Date(AHORA.getTime() - 40 * 86_400_000).toISOString()
    const r = await resumenCancelacionesCompita(c.id, AHORA)
    assert.deepEqual([r.total, r.cuentanContra, r.nivel], [1, 1, 'normal'])
  })

  test('marcar una cancelación que no existe, o con la base caída, devuelve false sin lanzar', async () => {
    assert.equal(await marcarJustificada({ id: '00000000-0000-4000-8000-000000000000', justificada: true, actor: 'admin:a' }), false)
    db.fail['cancelaciones:select'] = 1
    const r = await resumenCancelacionesCompita(mkCompita().id, AHORA)
    assert.equal(r.nivel, 'normal')
  })
})

describe('ruta de cancelar', () => {
  test('sigue igual que antes (borra la visita y avisa al compita) y además deja el registro', async () => {
    const c = mkCompita({ telegram_chat_id: '9100' }); const u = mkCliente({ nombre: 'Carolina' })
    const v = mkVisita(u, c, { estado: 'pre_visita' })
    session.user = { id: u.id, email: u.email }
    const r = await cancelarRuta(req('/api/visita/cancelar', { json: { mensaje: 'Ya no la necesito' } }))
    assert.equal(r.status, 200)
    assert.equal(db.rows('visitas').find((x) => x.id === v.id), undefined, 'la visita se borra como antes')
    assert.ok(tgPara(9100).some((m) => m.text.includes('ha cancelado')), 'el compita recibe el aviso')
    const f = db.rows('cancelaciones')
    assert.equal(f.length, 1)
    assert.deepEqual([f[0].cancelado_por, f[0].compita_id, f[0].usuario_id, f[0].visita_id], ['cliente', c.id, u.id, v.id])
    assert.equal(f[0].motivo, 'Ya no la necesito')
  })

  test('si el registro falla igual se cancela: el flujo del cliente nunca depende del historial', async () => {
    const c = mkCompita({ telegram_chat_id: '9101' }); const u = mkCliente()
    const v = mkVisita(u, c, { estado: 'pre_visita' })
    session.user = { id: u.id, email: u.email }
    db.fail['cancelaciones:insert'] = 1
    const r = await cancelarRuta(req('/api/visita/cancelar', { json: {} }))
    assert.equal(r.status, 200)
    assert.equal(db.rows('visitas').find((x) => x.id === v.id), undefined)
    assert.equal(db.rows('cancelaciones').length, 0)
  })

  test('sin visita en coordinación no registra nada', async () => {
    const u = mkCliente(); session.user = { id: u.id, email: u.email }
    const r = await cancelarRuta(req('/api/visita/cancelar', { json: {} }))
    assert.equal(r.status, 404)
    assert.equal(db.rows('cancelaciones').length, 0)
    void net
  })
})
