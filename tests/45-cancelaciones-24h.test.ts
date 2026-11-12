/* eslint-disable */
// Regla de cancelación de 24 horas. Cliente: con menos aviso la visita cuenta como usada (y debe aceptarlo); con más, es
// gratis. Compita: se registra siempre, 2 tardías abren revisión, 3 pausan sus solicitudes nuevas; justificar levanta la pausa.
import { db, limpiar, req, session, mkCliente, mkCompita, mkVisita, tgBtn, tgPara, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { GET as previa, POST as cancelar } from '@/app/api/visita/cancelar/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as solicitar } from '@/app/api/solicitudes/route'
import { cupoDelPlan } from '@/lib/visitas'
import { marcarJustificada, resumenCancelacionesCompita, compitasEnPausa } from '@/lib/cancelaciones'
import { limpiarCacheAjustes } from '@/lib/ajustes'

beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
// Fecha y hora de una visita que ocurre dentro de `h` horas, como las guarda el sistema (hora de Venezuela).
function en(h: number) {
  const ve = new Date(Date.now() + h * 3600_000 - 4 * 3600_000)
  return { fecha_programada: ve.toISOString().slice(0, 10), hora_inicio_programada: ve.toISOString().slice(11, 16) }
}
const conPlan = (cli: any) => db.seed('pagos_plan', { usuario_id: cli.id, tipo: 'plan', plan: 'quincenal', visitas: 2, monto_usd: 60, metodo: 'zelle', inicio: new Date(Date.now() - 86400_000).toISOString(), vence: new Date(Date.now() + 40 * 86400_000).toISOString(), estado: 'activo' })
const quedan = async (cli: any) => (await cupoDelPlan(cli.id))!.restantes
const pedirCancelar = (cli: any, json: any = {}) => { como(cli); return cancelar(req('/api/visita/cancelar', { method: 'POST', json })) }

function mundo(horas: number | null, estado = 'programada') {
  const compita = mkCompita({ telegram_chat_id: '9601' }); const cliente = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test' })
  conPlan(cliente)
  const visita = mkVisita(cliente, compita, { estado, created_at: new Date(Date.now() - 3600_000).toISOString(), ...(horas === null ? {} : en(horas)) })
  return { compita, cliente, visita }
}

describe('el cliente cancela: la regla de las 24 horas', () => {
  test('la vista previa dice si es gratis o si la visita cuenta como usada', async () => {
    const lejos = mundo(48); como(lejos.cliente)
    const a = (await (await previa()).json()).data
    assert.equal(a.cuenta_como_usada, false); assert.equal(a.minimo_horas, 24); assert.ok(a.horas_de_aviso > 40)
    limpiar()
    const cerca = mundo(5); como(cerca.cliente)
    const b = (await (await previa()).json()).data
    assert.equal(b.cuenta_como_usada, true); assert.ok(b.horas_de_aviso < 6)
  })

  test('con más de 24 horas: es gratis, la visita no cuenta y el saldo se conserva', async () => {
    const { cliente } = mundo(48)
    assert.equal(await quedan(cliente), 1, 'la visita en coordinación ya descuenta un crédito')
    const r = await pedirCancelar(cliente)
    assert.equal(r.status, 200); assert.equal((await r.json()).data.cuenta_como_usada, false)
    assert.equal(db.rows('visitas').length, 0)
    const c = db.rows('cancelaciones')[0]
    assert.equal(c.cancelado_por, 'cliente'); assert.equal(c.tardia, false); assert.equal(c.cuenta_como_usada, false)
    assert.equal(await quedan(cliente), 2, 'el crédito volvió')
  })

  test('con menos de 24 horas el servidor EXIGE que lo acepte: sin aceptar no se cancela nada', async () => {
    const { cliente } = mundo(5)
    const r = await pedirCancelar(cliente)
    assert.equal(r.status, 409); const d = await r.json(); assert.equal(d.tardia, true); assert.match(d.error, /se cuenta como usada/)
    assert.equal(db.rows('visitas').length, 1, 'la visita sigue ahí'); assert.equal(db.rows('cancelaciones').length, 0)
    assert.equal(await quedan(cliente), 1)
  })

  test('aceptando, la visita se cancela pero sigue contando como usada (el saldo no vuelve)', async () => {
    const { cliente } = mundo(5)
    const r = await pedirCancelar(cliente, { acepta_perder_visita: true })
    assert.equal(r.status, 200); assert.equal((await r.json()).data.cuenta_como_usada, true)
    assert.equal(db.rows('visitas').length, 0)
    const c = db.rows('cancelaciones')[0]
    assert.equal(c.tardia, true); assert.equal(c.cuenta_como_usada, true); assert.ok(c.visita_creada_en)
    assert.equal(await quedan(cliente), 1, 'sigue descontada')
    assert.ok(avisosAdmin().some((m) => /cuenta como usada/.test(m.text)), 'el equipo lo ve')
    assert.match(tgPara('9601').at(-1)!.text, /con poco aviso/)
  })

  test('si el equipo la justifica (emergencia), el crédito vuelve', async () => {
    const { cliente } = mundo(5)
    await pedirCancelar(cliente, { acepta_perder_visita: true })
    assert.equal(await quedan(cliente), 1)
    assert.equal(await marcarJustificada({ id: db.rows('cancelaciones')[0].id, justificada: true, actor: 'admin:admin@compaz.test' }), true)
    assert.equal(await quedan(cliente), 2)
    await marcarJustificada({ id: db.rows('cancelaciones')[0].id, justificada: false, actor: 'admin:admin@compaz.test' })
    assert.equal(await quedan(cliente), 1, 'quitar la marca vuelve a descontarla')
  })

  test('una visita todavía sin fecha (en coordinación) se cancela gratis: no hay nada que perder', async () => {
    const { cliente } = mundo(null, 'pre_visita')
    const r = await pedirCancelar(cliente)
    assert.equal(r.status, 200); assert.equal((await r.json()).data.cuenta_como_usada, false)
    assert.equal(await quedan(cliente), 2)
  })

  test('solo se cancela lo que no empezó: una visita en curso no', async () => {
    const { cliente } = mundo(1, 'en_curso')
    assert.equal((await pedirCancelar(cliente, { acepta_perder_visita: true })).status, 404)
    assert.equal(db.rows('visitas').length, 1)
  })

  test('el ajuste manda: con 48 horas de mínimo, cancelar con 30 horas ya cuesta la visita', async () => {
    const { setAjuste } = await import('@/lib/ajustes')
    await setAjuste({ clave: 'cancelacion_gratis_horas', valor: 48, actor: 'admin:a' })
    const { cliente } = mundo(30)
    assert.equal((await pedirCancelar(cliente)).status, 409)
  })
})

describe('el compita cancela: se registra y puede llevar a pausa', () => {
  async function cancelaTarde(compita: any, cliente: any) {
    const v = db.rows('visitas').find((x) => x.compita_id === compita.id)!
    Object.assign(v, { estado: 'programada', ...en(5) })
    await webhook(tgBtn('9601', 'reagendar_visita'))
  }
  function base() {
    const compita = mkCompita({ telegram_chat_id: '9601', nombre: 'Lucía Gómez' }); const cliente = mkCliente({ email: 'caro@mail.test' })
    mkVisita(cliente, compita, { estado: 'programada', ...en(5) })
    return { compita, cliente }
  }

  test('queda registrada con sus horas de aviso, la visita no se borra (se reprograma) y el compita lo sabe', async () => {
    const { compita } = base()
    await webhook(tgBtn('9601', 'reagendar_visita'))
    const c = db.rows('cancelaciones')[0]
    assert.equal(c.cancelado_por, 'compita'); assert.equal(c.tardia, true); assert.equal(c.cuenta_como_usada, false, 'al cliente no le cuesta')
    assert.equal(db.rows('visitas')[0].estado, 'pre_visita')
    assert.match(tgPara('9601').at(-1)!.text, /menos de 24 horas/)
  })

  test('con más de 24 horas de aviso no es tardía ni suma', async () => {
    const compita = mkCompita({ telegram_chat_id: '9601' }); const cliente = mkCliente({ email: 'caro@mail.test' })
    mkVisita(cliente, compita, { estado: 'programada', ...en(72) })
    await webhook(tgBtn('9601', 'reagendar_visita'))
    assert.equal(db.rows('cancelaciones')[0].tardia, false)
    assert.equal((await resumenCancelacionesCompita(compita.id)).nivel, 'normal')
    assert.ok(!db.rows('admin_flags').some((f) => f.tipo === 'cancelacion_tardia'))
  })

  test('a la 2.ª tardía se abre UNA tarea de revisión; a la 3.ª, pausa con prioridad urgente', async () => {
    const { compita, cliente } = base()
    await cancelaTarde(compita, cliente)
    assert.ok(!db.rows('admin_flags').some((f) => f.tipo === 'cancelacion_tardia'), 'con una sola no se abre nada')
    await cancelaTarde(compita, cliente)
    let t = db.rows('admin_flags').filter((f) => f.tipo === 'cancelacion_tardia')
    assert.equal(t.length, 1); assert.match(t[0].nota, /^REVISIÓN/); assert.equal(t[0].prioridad, 2)
    await cancelaTarde(compita, cliente)
    t = db.rows('admin_flags').filter((f) => f.tipo === 'cancelacion_tardia')
    assert.equal(t.length, 2); assert.ok(t.some((f) => /^PAUSA/.test(f.nota) && f.prioridad === 1))
    assert.equal((await resumenCancelacionesCompita(compita.id)).nivel, 'pausa')
  })

  test('en pausa no recibe solicitudes nuevas; al justificar una cancelación la pausa se levanta sola', async () => {
    const { compita, cliente } = base()
    for (let i = 0; i < 3; i++) await cancelaTarde(compita, cliente)
    const otro = mkCliente({ email: 'otro@mail.test' }); como(otro)
    const pedir = () => solicitar(req('/api/solicitudes', { json: { compita_id: compita.id, tipo: 'directa', que: 'Compañía y conversación', lugar_privado: false } }))
    const r = await pedir(); assert.equal(r.status, 400); assert.match((await r.json()).error, /no está disponible/)
    assert.equal(db.rows('solicitudes').length, 0)
    await marcarJustificada({ id: db.rows('cancelaciones')[0].id, justificada: true, actor: 'admin:admin@compaz.test' })
    assert.equal((await resumenCancelacionesCompita(compita.id)).nivel, 'revision')
    assert.equal((await pedir()).status, 200, 'ya puede recibir solicitudes')
  })

  test('el listado oculta al compita en pausa y lo vuelve a mostrar al justificar; no afecta a los demás', async () => {
    const { compita, cliente } = base()
    const otro = mkCompita({ telegram_chat_id: '9602' })
    for (let i = 0; i < 2; i++) await cancelaTarde(compita, cliente)
    assert.equal((await compitasEnPausa([compita.id, otro.id])).size, 0, 'con 2 todavía no está en pausa')
    await cancelaTarde(compita, cliente)
    const p = await compitasEnPausa([compita.id, otro.id])
    assert.deepEqual([...p], [compita.id])
    assert.deepEqual([...(await compitasEnPausa([]))], [])
    await marcarJustificada({ id: db.rows('cancelaciones')[0].id, justificada: true, actor: 'admin:admin@compaz.test' })
    assert.equal((await compitasEnPausa([compita.id, otro.id])).size, 0)
  })
})
