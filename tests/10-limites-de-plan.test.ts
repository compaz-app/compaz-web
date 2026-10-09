/* eslint-disable */
import { db, net, session, limpiar, req, tgText, tgBtn, tgPara, ultimoTg, ahoraMas, hoyVEstr, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as nueva } from '@/app/api/visita/nueva/route'
import { POST as pagoConfirmar } from '@/app/api/pago/confirmar/route'
import { POST as planCliente } from '@/app/api/admin/plan-cliente/route'
import { POST as asignarCompita } from '@/app/api/admin/asignar-compita/route'
import { cupoDelPlan } from '@/lib/visitas'

beforeEach(limpiar)
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
const DIA = 86400_000

const contratar = async (plan: string) => {
  const lucia = mkCompita({ telegram_chat_id: '4000', nombre: 'Lucía' })
  const carlos = mkCliente({ email: 'carlos@mail.test', nombre: 'Carlos' })
  const sol = mkSolicitud(carlos, lucia, { estado: 'aceptada', slot_confirmado: ahoraMas(-60) })
  como(carlos)
  assert.equal((await pagoConfirmar(req('/api/pago/confirmar', { json: { solicitud_id: sol.id, plan } }))).status, 200)
  return { lucia, carlos }
}
/** Cierra la visita activa para poder pedir otra. */
const terminarActiva = (carlos: any) => { const v = db.rows('visitas').find((x) => x.usuario_id === carlos.id && x.estado !== 'terminada'); if (v) { v.estado = 'terminada'; v.fin = new Date().toISOString() } }

describe('Límites por plan contratado', () => {
  test('contratar guarda el plan y la primera visita ya cuenta dentro del cupo', async () => {
    const { carlos } = await contratar('semanal')
    assert.equal(carlos.plan_contratado, 'semanal'); assert.ok(carlos.plan_inicio)
    const c = await cupoDelPlan(carlos.id)
    assert.deepEqual([c!.limite, c!.usadas, c!.restantes], [4, 1, 3])
  })

  test('A la carta: 1 visita en total; la 2ª se rechaza, avisa al admin y no crea nada', async () => {
    const { carlos } = await contratar('carta'); terminarActiva(carlos); como(carlos)
    const r = await nueva()
    assert.equal(r.status, 409); assert.match((await r.json()).error, /todas las visitas de tu plan/)
    assert.equal(db.rows('visitas').length, 1)
    assert.ok(tgPara(999).some((m) => m.text.includes('Plan agotado') && m.text.includes('A la carta')))
  })

  test('Compañía (2 por ciclo): la 2ª pasa y la 3ª se bloquea', async () => {
    const { carlos } = await contratar('quincenal'); terminarActiva(carlos); como(carlos)
    assert.equal((await nueva()).status, 200)
    assert.match(ultimoTg('4000')!.text, /2 de 2 de su plan/)
    terminarActiva(carlos)
    assert.equal((await nueva()).status, 409)
    assert.equal(db.rows('visitas').length, 2)
  })

  test('Compañía Plus (4 por ciclo): 4 sí, la 5ª no', async () => {
    const { carlos } = await contratar('semanal')
    for (let n = 2; n <= 4; n++) { terminarActiva(carlos); como(carlos); assert.equal((await nueva()).status, 200, `visita ${n}`) }
    terminarActiva(carlos); como(carlos)
    assert.equal((await nueva()).status, 409)
    assert.equal(db.rows('visitas').length, 4)
  })

  test('el ciclo de 30 días se renueva solo: pasado el mes vuelve a haber cupo', async () => {
    const { carlos } = await contratar('quincenal'); terminarActiva(carlos); como(carlos)
    await nueva(); terminarActiva(carlos)
    assert.equal((await nueva()).status, 409, 'agotado dentro del ciclo')
    // 31 días después: el plan_inicio y las visitas quedaron atrás
    carlos.plan_inicio = new Date(Date.now() - 31 * DIA).toISOString()
    db.rows('visitas').forEach((v) => (v.created_at = new Date(Date.now() - 31 * DIA + 1000).toISOString()))
    const c = await cupoDelPlan(carlos.id)
    assert.equal(c!.usadas, 0); assert.ok(new Date(c!.renueva!).getTime() > Date.now())
    assert.equal((await nueva()).status, 200)
  })

  test('A la carta NO se renueva con el tiempo (es un solo uso)', async () => {
    const { carlos } = await contratar('carta'); terminarActiva(carlos)
    carlos.plan_inicio = new Date(Date.now() - 90 * DIA).toISOString()
    db.rows('visitas').forEach((v) => (v.created_at = new Date(Date.now() - 90 * DIA + 1000).toISOString()))
    como(carlos); assert.equal((await nueva()).status, 409)
  })

  test('sin plan registrado (cuentas anteriores o asignadas a mano) no hay límite', async () => {
    const lucia = mkCompita({ telegram_chat_id: '4001' }); const carlos = mkCliente({ compita_id: lucia.id })
    db.seed('visitas', { usuario_id: carlos.id, compita_id: lucia.id, estado: 'terminada' })
    como(carlos); assert.equal(await cupoDelPlan(carlos.id), null)
    assert.equal((await nueva()).status, 200)
  })

  test('el admin renueva el plan (cobro manual): reinicia el ciclo y se puede agendar de nuevo', async () => {
    const { carlos } = await contratar('carta'); terminarActiva(carlos); como(carlos)
    assert.equal((await nueva()).status, 409)
    admin()
    assert.equal((await planCliente(req('/api/admin/plan-cliente', { json: { usuario_id: carlos.id, plan: 'quincenal' } }))).status, 200)
    assert.equal(carlos.plan_contratado, 'quincenal')
    db.rows('visitas').forEach((v) => (v.created_at = new Date(Date.now() - 1000).toISOString()))
    // el ciclo nuevo empieza ahora: las visitas anteriores a la renovación no cuentan
    carlos.plan_inicio = new Date(Date.now() - 500).toISOString()
    como(carlos); assert.equal((await nueva()).status, 200)
  })

  test('plan-cliente: solo admin, plan válido, cliente existente; quitar el plan elimina el límite', async () => {
    const { carlos } = await contratar('carta')
    como(carlos); assert.equal((await planCliente(req('/api/admin/plan-cliente', { json: { usuario_id: carlos.id, plan: 'semanal' } }))).status, 401)
    admin()
    assert.equal((await planCliente(req('/api/admin/plan-cliente', { json: { usuario_id: carlos.id, plan: 'gratis' } }))).status, 400)
    assert.equal((await planCliente(req('/api/admin/plan-cliente', { json: { usuario_id: 'no-existe', plan: 'carta' } }))).status, 404)
    await planCliente(req('/api/admin/plan-cliente', { json: { usuario_id: carlos.id, plan: null } }))
    assert.equal(await cupoDelPlan(carlos.id), null)
  })

  test('asignación manual por el admin con plan: queda registrado y limita', async () => {
    const lucia = mkCompita({ telegram_chat_id: '4002' }); const carlos = mkCliente()
    admin()
    assert.equal((await asignarCompita(req('/api/admin/asignar-compita', { json: { usuario_id: carlos.id, compita_id: lucia.id, plan: 'carta' } }))).status, 200)
    assert.equal(carlos.plan_contratado, 'carta')
    assert.equal((await asignarCompita(req('/api/admin/asignar-compita', { json: { usuario_id: carlos.id, compita_id: lucia.id, plan: 'inventado' } }))).status, 400)
    assert.equal((await cupoDelPlan(carlos.id))!.usadas, 1, 'la visita creada al asignar cuenta')
  })

  test('el cliente no puede ampliar su propio plan por la API de visitas (el límite es del servidor)', async () => {
    const { carlos } = await contratar('carta'); terminarActiva(carlos); como(carlos)
    // aunque intente "crear otra" repetidamente, nunca se crea
    for (let i = 0; i < 3; i++) assert.equal((await nueva()).status, 409)
    assert.equal(db.rows('visitas').length, 1)
  })

  test('si la columna del plan no existe aún (migración pendiente) contratar no se rompe y avisa al admin', async () => {
    const lucia = mkCompita({ telegram_chat_id: '4003' }); const carlos = mkCliente({ email: 'c@mail.test' })
    const sol = mkSolicitud(carlos, lucia, { estado: 'aceptada', slot_confirmado: ahoraMas(-60) })
    db.fail['usuarios:update'] = 1; como(carlos)
    assert.equal((await pagoConfirmar(req('/api/pago/confirmar', { json: { solicitud_id: sol.id, plan: 'semanal' } }))).status, 200)
    assert.ok(tgPara(999).some((m) => m.text.includes('no se pudo guardar el plan')))
  })
})
