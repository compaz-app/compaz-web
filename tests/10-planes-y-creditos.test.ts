/* eslint-disable */
import { db, net, session, limpiar, req, tgText, tgPara, emailsA, ahoraMas, hoyVEstr, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { calcularCreditos } from '@/lib/creditos'
import { POST as nueva } from '@/app/api/visita/nueva/route'
import { POST as pagoConfirmar } from '@/app/api/pago/confirmar/route'
import { POST as registrarPago } from '@/app/api/admin/registrar-pago/route'
import { POST as anularPago } from '@/app/api/admin/anular-pago/route'
import { GET as listarPagos } from '@/app/api/admin/pagos/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { cupoDelPlan } from '@/lib/visitas'

beforeEach(limpiar)
const DIA = 86400_000
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
const iso = (offsetDias: number) => new Date(Date.now() + offsetDias * DIA).toISOString()
const pagar = (cli: any, body: any = {}) => { admin(); return registrarPago(req('/api/admin/registrar-pago', { json: { usuario_id: cli.id, tipo: 'plan', plan: 'quincenal', metodo: 'zelle', ...body } })) }
const terminarActiva = (cli: any) => { const v = db.rows('visitas').find((x) => x.usuario_id === cli.id && x.estado !== 'terminada'); if (v) { v.estado = 'terminada'; v.fin = new Date().toISOString() } }

/** Cliente con compita y una visita ya terminada, y un paquete "a mano" (inicio/vence/visitas controlados). */
const mundoCon = (paquetes: Array<{ inicioDias: number; venceDias: number; visitas: number; tipo?: string; plan?: string }>, visitasHaceDias: number[] = []) => {
  const lucia = mkCompita({ telegram_chat_id: '5000', nombre: 'Lucía' })
  const carlos = mkCliente({ email: 'carlos@mail.test', nombre: 'Carlos', compita_id: lucia.id })
  paquetes.forEach((p) => db.seed('pagos_plan', { usuario_id: carlos.id, tipo: p.tipo ?? 'plan', plan: p.plan ?? 'quincenal', visitas: p.visitas, monto_usd: 75, metodo: 'zelle', inicio: iso(p.inicioDias), vence: iso(p.venceDias) }))
  visitasHaceDias.forEach((d) => db.seed('visitas', { usuario_id: carlos.id, compita_id: lucia.id, estado: 'terminada', created_at: iso(-d), fin: iso(-d) }))
  return { lucia, carlos }
}

describe('calcularCreditos (lógica pura de paquetes con vencimiento a 60 días)', () => {
  const P = (id: string, v: number, ini: number, ven: number) => ({ id, tipo: 'plan' as const, visitas: v, inicio: iso(ini), vence: iso(ven) })

  test('las visitas no usadas NO se pierden al cerrar el mes: se suman al siguiente pago', () => {
    const r = calcularCreditos([P('a', 2, -35, 25), P('b', 2, 0, 60)], [iso(-34)])
    assert.equal(r.disponibles, 3)
  })
  test('pasados los 60 días el saldo no usado vence', () => {
    const r = calcularCreditos([P('a', 2, -61, -1), P('b', 2, 0, 60)], [])
    assert.equal(r.disponibles, 2)
  })
  test('se gastan primero las que vencen antes', () => {
    const r = calcularCreditos([P('a', 2, -50, 10), P('b', 4, 0, 60)], [iso(-1)])
    const a = r.paquetes.find((p) => p.id === 'a')!, b = r.paquetes.find((p) => p.id === 'b')!
    assert.deepEqual([a.restantes, b.restantes], [1, 4])
    assert.equal(r.proximoVencimiento, a.vence)
  })
  test('un paquete anulado no cuenta', () => {
    assert.equal(calcularCreditos([{ ...P('a', 4, 0, 60), estado: 'anulado' }], []).disponibles, 0)
  })
  test('visitas anteriores a todo pago no consumen créditos', () => {
    assert.equal(calcularCreditos([P('a', 2, 0, 60)], [iso(-100)]).disponibles, 2)
  })
  test('sin saldo no hay próximo vencimiento', () => {
    const r = calcularCreditos([P('a', 1, -1, 59)], [iso(-0.5)])
    assert.equal(r.disponibles, 0); assert.equal(r.proximoVencimiento, null)
  })
})

describe('Contratación crea el paquete y la primera visita cuenta', () => {
  test('pago/confirmar (simulado) registra el pago del plan y descuenta la primera visita', async () => {
    const lucia = mkCompita({ telegram_chat_id: '5001' }); const carlos = mkCliente({ email: 'c@mail.test' })
    const sol = mkSolicitud(carlos, lucia, { estado: 'aceptada', slot_confirmado: ahoraMas(-60) })
    como(carlos)
    assert.equal((await pagoConfirmar(req('/api/pago/confirmar', { json: { solicitud_id: sol.id, plan: 'semanal' } }))).status, 200)
    assert.equal(db.rows('pagos_plan').length, 1)
    const c = await cupoDelPlan(carlos.id)
    assert.deepEqual([c!.limite, c!.usadas, c!.restantes, c!.modo], [4, 1, 3, 'creditos'])
  })
})

describe('Agendar otra visita con créditos', () => {
  test('A la carta: 1 visita; la 2ª se bloquea y el admin recibe "plan agotado"', async () => {
    const { carlos } = mundoCon([{ inicioDias: -2, venceDias: 58, visitas: 1, plan: 'carta' }], [1])
    como(carlos); const r = await nueva()
    assert.equal(r.status, 409)
    assert.ok(tgPara(999).some((m) => m.text.includes('Plan agotado')))
  })

  test('Compañía: el saldo del mes anterior se suma y todo se puede usar', async () => {
    const { carlos } = mundoCon([{ inicioDias: -35, venceDias: 25, visitas: 2 }, { inicioDias: 0, venceDias: 60, visitas: 2 }], [34])
    como(carlos)
    for (let i = 0; i < 3; i++) { assert.equal((await nueva()).status, 200, `visita ${i + 1} de las 3 disponibles`); terminarActiva(carlos) }
    assert.equal((await nueva()).status, 409)
  })

  test('el saldo del primer pago vence a los 60 días y ya no se puede usar', async () => {
    const { carlos } = mundoCon([{ inicioDias: -61, venceDias: -1, visitas: 2 }], [70])
    como(carlos); assert.equal((await nueva()).status, 409)
    await pagar(carlos)
    como(carlos); assert.equal((await nueva()).status, 200)
  })

  test('CICLO VENCIDO sin pagar: puede usar una visita ya programada, pero no agendar nuevas', async () => {
    const { lucia, carlos } = mundoCon([{ inicioDias: -61, venceDias: -1, visitas: 2 }], [])
    const v = db.seed('visitas', { usuario_id: carlos.id, compita_id: lucia.id, estado: 'programada', fecha_programada: hoyVEstr(), hora_inicio_programada: '10:00', hora_fin_programada: '12:00' })
    await webhook(tgText(5000, '▶️ Iniciar visita')); await webhook(tgText(5000, '✅ Sí, iniciar'))
    assert.equal(v.estado, 'en_curso', 'la visita ya programada se realiza')
    terminarActiva(carlos); como(carlos)
    assert.equal((await nueva()).status, 409)
  })

  test('visita extra: pago de 2 horas habilita una visita más (aunque el plan esté agotado)', async () => {
    const { carlos } = mundoCon([{ inicioDias: -2, venceDias: 58, visitas: 1, plan: 'carta' }], [1])
    como(carlos); assert.equal((await nueva()).status, 409)
    const r = await pagar(carlos, { tipo: 'extra', plan: undefined, horas: 2, metodo: 'zelle' })
    assert.equal(r.status, 200)
    assert.equal((await r.json()).data.pago.monto_usd, 40)
    como(carlos); assert.equal((await nueva()).status, 200)
    terminarActiva(carlos); assert.equal((await nueva()).status, 409)
  })

  test('sin pagos registrados: cuentas con plan antiguo mantienen su límite; sin plan, sin límite', async () => {
    const lucia = mkCompita({ telegram_chat_id: '5002' })
    const viejo = mkCliente({ compita_id: lucia.id, plan_contratado: 'carta', plan_inicio: iso(-3) })
    db.seed('visitas', { usuario_id: viejo.id, compita_id: lucia.id, estado: 'terminada', created_at: iso(-2) })
    como(viejo); assert.equal((await nueva()).status, 409)
    const libre = mkCliente({ compita_id: lucia.id })
    db.seed('visitas', { usuario_id: libre.id, compita_id: lucia.id, estado: 'terminada', created_at: iso(-2) })
    como(libre); assert.equal((await nueva()).status, 200)
  })
})

describe('Registrar pago (panel admin)', () => {
  test('solo admin', async () => {
    const { carlos } = mundoCon([])
    como(carlos)
    assert.equal((await registrarPago(req('/api/admin/registrar-pago', { json: { usuario_id: carlos.id, tipo: 'plan', plan: 'carta', metodo: 'zelle' } }))).status, 401)
    assert.equal((await anularPago(req('/api/admin/anular-pago', { json: { pago_id: 'x' } }))).status, 401)
    assert.equal((await listarPagos(req(`/api/admin/pagos?usuario_id=${carlos.id}`))).status, 401)
  })

  test('Zelle: crea el paquete, vence a los 60 días, avisa al cliente y menciona Zelle y las condiciones de reembolso', async () => {
    const { carlos } = mundoCon([])
    const r = await pagar(carlos, { plan: 'semanal', metodo: 'zelle', referencia: 'ZELLE-123' })
    assert.equal(r.status, 200)
    const p = (await r.json()).data.pago
    assert.equal(p.visitas, 4); assert.equal(p.monto_usd, 140)
    assert.ok(Math.abs(new Date(p.vence).getTime() - new Date(p.inicio).getTime() - 60 * DIA) < 5000)
    const mail = emailsA('carlos@mail.test')[0]
    assert.ok(mail.html.includes('Zelle') && mail.html.includes('$140') && mail.html.includes('reembolsos'))
    assert.equal(carlos.plan_contratado, 'semanal')
  })

  test('validaciones: método, plan, horas mínimas (2), monto, cliente inexistente', async () => {
    const { carlos } = mundoCon([])
    assert.equal((await pagar(carlos, { metodo: 'bitcoin' })).status, 400)
    assert.equal((await pagar(carlos, { plan: 'platino' })).status, 400)
    assert.equal((await pagar(carlos, { tipo: 'extra', horas: 1 })).status, 400)
    assert.equal((await pagar(carlos, { tipo: 'extra', horas: 13 })).status, 400)
    assert.equal((await pagar(carlos, { monto_usd: -5 })).status, 400)
    assert.equal((await pagar({ id: 'no-existe' })).status, 404)
    assert.equal(db.rows('pagos_plan').length, 0)
  })

  test('el monto se puede ajustar (descuento) y la extra de 3 horas cuesta $60 por defecto', async () => {
    const { carlos } = mundoCon([])
    assert.equal((await (await pagar(carlos, { plan: 'quincenal', monto_usd: 60 })).json()).data.pago.monto_usd, 60)
    assert.equal((await (await pagar(carlos, { tipo: 'extra', horas: 3 })).json()).data.pago.monto_usd, 60)
  })

  test('anular un pago equivocado devuelve el cupo; no se puede anular dos veces; el historial lo muestra', async () => {
    const { carlos } = mundoCon([])
    const id = (await (await pagar(carlos, { plan: 'semanal' })).json()).data.pago.id
    assert.equal((await cupoDelPlan(carlos.id))!.restantes, 4)
    admin(); assert.equal((await anularPago(req('/api/admin/anular-pago', { json: { pago_id: id, motivo: 'Zelle no llegó' } }))).status, 200)
    assert.equal((await cupoDelPlan(carlos.id))?.restantes ?? 0, 0)
    assert.equal((await anularPago(req('/api/admin/anular-pago', { json: { pago_id: id } }))).status, 400)
    const h = await (await listarPagos(req(`/api/admin/pagos?usuario_id=${carlos.id}`))).json()
    assert.equal(h.data.pagos[0].estado, 'anulado')
  })

  test('si el correo falla, el pago igual queda registrado y se informa', async () => {
    const { carlos } = mundoCon([]); net.resendFail = true
    const r = await pagar(carlos)
    assert.equal(r.status, 200); assert.equal((await r.json()).data.correo_enviado, false)
    assert.equal(db.rows('pagos_plan').length, 1)
  })
})
