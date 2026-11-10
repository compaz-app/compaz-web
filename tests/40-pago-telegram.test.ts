/* eslint-disable */
// Lote 2: el equipo confirma el pago con un botón de Telegram y el cliente puede insistir (alerta URGENTE, 1 por 30 min).
import { db, net, limpiar, req, session, mkCliente, tgBtn, tgPara, emailsA } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as solicitar } from '@/app/api/pago/solicitar/route'
import { POST as insistir } from '@/app/api/pago/insistir/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { GET as pagosAdmin } from '@/app/api/admin/pagos/route'
import { escalarPagosInsistidos } from '@/lib/confirmar-pago'
import { setAjuste } from '@/lib/ajustes'
import { POST as confirmar } from '@/app/api/admin/confirmar-solicitud/route'

beforeEach(limpiar)
const ADMIN_CHAT = '999'
const comoCliente = (c: any) => { session.user = { id: c.id, email: c.email, user_metadata: { nombre: c.nombre } } as any }
const pedir = async (c: any) => {
  comoCliente(c)
  const r = await solicitar(req('/api/pago/solicitar', { json: { tipo: 'plan', plan: 'quincenal', metodo: 'zelle' } }))
  assert.equal(r.status, 200)
  return db.rows('solicitudes_pago').find((s) => s.usuario_id === c.id)!
}
const botones = (m: any) => (m?.markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data)

describe('pago: botón de confirmar en Telegram', () => {
  test('el aviso al equipo trae el botón con la solicitud', async () => {
    const c = mkCliente({ nombre: 'Carolina', email: 'caro@mail.test' })
    const s = await pedir(c)
    const m = tgPara(ADMIN_CHAT).at(-1)
    assert.deepEqual(botones(m), [`pagoconf:${s.id}`])
  })

  test('tocar el botón confirma el pago, crea el pago, avisa al cliente y no se repite', async () => {
    const c = mkCliente({ nombre: 'Carolina', email: 'caro@mail.test' })
    const s = await pedir(c)
    await webhook(tgBtn(ADMIN_CHAT, `pagoconf:${s.id}`))
    assert.equal(db.rows('solicitudes_pago')[0].estado, 'confirmado')
    assert.equal(db.rows('pagos_plan').length, 1)
    assert.equal(emailsA('caro@mail.test').filter((e) => e.subject === 'Recibimos tu pago en Compaz').length, 1)
    assert.match(tgPara(ADMIN_CHAT).at(-1)!.text, /confirmado/)
    await webhook(tgBtn(ADMIN_CHAT, `pagoconf:${s.id}`))
    assert.equal(db.rows('pagos_plan').length, 1, 'un segundo toque no duplica el pago')
    assert.match(tgPara(ADMIN_CHAT).at(-1)!.text, /No se confirmó/)
  })

  test('desde otro chat no se puede confirmar', async () => {
    const c = mkCliente({ email: 'caro@mail.test' })
    const s = await pedir(c)
    await webhook(tgBtn('12345', `pagoconf:${s.id}`))
    assert.equal(db.rows('solicitudes_pago')[0].estado, 'pendiente')
    assert.equal(db.rows('pagos_plan').length, 0)
  })
})

describe('pago: el cliente insiste', () => {
  test('la primera insistencia manda alerta URGENTE con botón; la segunda dentro de 30 minutos solo se cuenta', async () => {
    const c = mkCliente({ nombre: 'Carolina', email: 'caro@mail.test' })
    const s = await pedir(c)
    const antes = tgPara(ADMIN_CHAT).length
    assert.equal((await insistir()).status, 200)
    const m = tgPara(ADMIN_CHAT).at(-1)!
    assert.equal(tgPara(ADMIN_CHAT).length, antes + 1)
    assert.match(m.text, /URGENTE/)
    assert.deepEqual(botones(m), [`pagoconf:${s.id}`])
    assert.equal((await insistir()).status, 200)
    assert.equal(tgPara(ADMIN_CHAT).length, antes + 1, 'no re-alerta')
    const ev = db.rows('eventos').filter((e) => e.tipo === 'pago_insistido')
    assert.equal(ev.length, 2)
    assert.deepEqual(ev.map((e) => e.datos.alertado), [true, false])
  })

  test('pasados 30 minutos vuelve a alertar', async () => {
    const c = mkCliente({ email: 'caro@mail.test' })
    await pedir(c)
    await insistir()
    db.rows('eventos').find((e) => e.tipo === 'pago_insistido')!.creado_en = new Date(Date.now() - 31 * 60_000).toISOString()
    const antes = tgPara(ADMIN_CHAT).length
    await insistir()
    assert.equal(tgPara(ADMIN_CHAT).length, antes + 1)
  })

  test('sin pago pendiente da 404 y sin sesión 401', async () => {
    const c = mkCliente({ email: 'caro@mail.test' })
    comoCliente(c)
    assert.equal((await insistir()).status, 404)
    session.user = null
    assert.equal((await insistir()).status, 401)
  })
})

describe('pago insistido sin confirmar: escalada a las horas de Ajustes', () => {
  const envejecer = (horas: number) => { for (const e of db.rows('eventos').filter((x) => x.tipo === 'pago_insistido')) e.creado_en = new Date(Date.now() - horas * 3600_000).toISOString() }

  test('antes de 6 horas no escala; después avisa una sola vez por correo y Telegram', async () => {
    const c = mkCliente({ nombre: 'Carolina', email: 'caro@mail.test' })
    await pedir(c); await insistir()
    envejecer(5)
    assert.equal(await escalarPagosInsistidos(), 0)
    envejecer(7)
    const tg = tgPara(ADMIN_CHAT).length
    assert.equal(await escalarPagosInsistidos(), 1)
    assert.equal(tgPara(ADMIN_CHAT).length, tg + 1)
    assert.ok(emailsA('admin@compaz.test').some((e) => e.subject === 'URGENTE: pago sin confirmar'))
    assert.equal(await escalarPagosInsistidos(), 0, 'no se repite')
    assert.equal(db.rows('eventos').filter((e) => e.tipo === 'pago_escalado').length, 1)
  })

  test('si ya se confirmó o nunca insistió, no escala', async () => {
    const c = mkCliente({ email: 'caro@mail.test' })
    const s = await pedir(c)
    envejecer(10)
    assert.equal(await escalarPagosInsistidos(), 0, 'sin insistencia')
    await insistir(); envejecer(10)
    await webhook(tgBtn(ADMIN_CHAT, `pagoconf:${s.id}`))
    assert.equal(await escalarPagosInsistidos(), 0, 'ya confirmado')
  })

  test('los plazos salen de Ajustes', async () => {
    const c = mkCliente({ email: 'caro@mail.test' })
    await pedir(c); await insistir()
    await setAjuste({ clave: 'pago_escalada_horas', valor: 1, actor: 'admin:a' })
    envejecer(2)
    assert.equal(await escalarPagosInsistidos(), 1)
    await setAjuste({ clave: 'pago_insistencia_min', valor: 5, actor: 'admin:a' })
    db.rows('eventos').find((e) => e.tipo === 'pago_insistido')!.creado_en = new Date(Date.now() - 6 * 60_000).toISOString()
    const antes = tgPara(ADMIN_CHAT).length
    await insistir()
    assert.equal(tgPara(ADMIN_CHAT).length, antes + 1, 'a los 6 min ya alerta porque la ventana es de 5')
  })

  test('el panel recibe cuántas veces insistió', async () => {
    const c = mkCliente({ email: 'caro@mail.test' })
    await pedir(c); await insistir(); await insistir()
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    const r = await pagosAdmin(req(`/api/admin/pagos?usuario_id=${c.id}`))
    assert.equal((await r.json()).data.pendiente.insistencias.veces, 2)
  })
})

describe('confirmar-solicitud por el panel', () => {
  test('el administrador confirma y recibe el pago y el cupo', async () => {
    const c = mkCliente({ email: 'caro@mail.test' })
    const s = await pedir(c)
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    const r = await confirmar(req('/api/admin/confirmar-solicitud', { json: { solicitud_id: s.id } }))
    assert.equal(r.status, 200)
    assert.equal((await r.json()).data.correo_enviado, true)
    assert.equal(db.rows('pagos_plan')[0].registrado_por ?? 'admin@compaz.test', 'admin@compaz.test')
  })
})
