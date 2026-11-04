/* eslint-disable */
// Paso 1.4 (flujo B): el aviso de pago confirmado al cliente usa notificar().
// Queda registrado, un fallo del correo se puede reintentar y un pago anulado no se confirma.
import { db, net, limpiar, req, session, mkCliente, ahoraMas, emailsA } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as registrarPago } from '@/app/api/admin/registrar-pago/route'
import { notificar, reintentarAviso } from '@/lib/avisos'

beforeEach(limpiar)

const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
const pagar = (cli: any) => {
  admin()
  return registrarPago(req('/api/admin/registrar-pago', { json: { usuario_id: cli.id, tipo: 'plan', plan: 'quincenal', metodo: 'zelle' } }))
}
const avisosPago = () => db.rows('avisos').filter((a) => a.plantilla === 'pago_confirmado')
const seedPago = (cli: any, o: Record<string, any> = {}) =>
  db.seed('pagos_plan', { usuario_id: cli.id, tipo: 'plan', plan: 'quincenal', visitas: 2, monto_usd: 60, metodo: 'zelle', vence: ahoraMas(60 * 24 * 60), estado: 'activo', ...o })

describe('registrar-pago: aviso al cliente', () => {
  test('el correo llega, el aviso queda registrado y queda el evento del pago', async () => {
    const cli = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test' })
    const r = await pagar(cli)
    assert.equal(r.status, 200)
    assert.equal((await r.json()).data.correo_enviado, true)

    const correos = emailsA('caro@mail.test').filter((e) => e.subject === 'Recibimos tu pago en Compaz')
    assert.equal(correos.length, 1)
    assert.match(correos[0].html, /Hola, Carolina\. Registramos tu pago de <strong>\$/)
    assert.match(correos[0].html, /Las visitas que no uses este mes/)
    assert.match(correos[0].html, /\/dashboard/)

    const a = avisosPago()[0]
    assert.equal(a.canal, 'correo')
    assert.equal(a.estado, 'enviado')
    assert.equal(a.paso, 12)
    assert.equal(a.entidad, 'pago')
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'pago_confirmado' && e.actor === 'admin:admin@compaz.test' && e.entidad_id === a.entidad_id))
  })

  test('si el correo falla el pago queda registrado igual y el aviso se puede reintentar', async () => {
    const cli = mkCliente({ email: 'caro@mail.test' })
    net.resendFail = true
    const r = await pagar(cli)
    assert.equal(r.status, 200, 'el pago se registró')
    assert.equal((await r.json()).data.correo_enviado, false, 'se avisa al admin de que el correo no salió')
    assert.equal(db.rows('pagos_plan').length, 1)
    const a = avisosPago()[0]
    assert.equal(a.estado, 'fallido')
    assert.ok(a.error)

    net.resendFail = false
    const r2 = await reintentarAviso(a.id)
    assert.equal(r2.estado, 'enviado')
    assert.equal(emailsA('caro@mail.test').filter((e) => e.subject === 'Recibimos tu pago en Compaz').length, 1)
  })

  test('un cliente sin correo no es un error: no hay nada que enviar', async () => {
    const cli = mkCliente({ email: null })
    const r = await pagar(cli)
    assert.equal(r.status, 200)
    assert.equal((await r.json()).data.correo_enviado, true)
  })
})

describe('plantilla pago_confirmado', () => {
  test('la variante de confirmación conserva su texto', async () => {
    const cli = mkCliente({ nombre: 'Luis Andrade', email: 'luis@mail.test' })
    const pago = seedPago(cli)
    const r = await notificar({
      plantilla: 'pago_confirmado', canal: 'correo', destinatario: { tipo: 'cliente', id: cli.id },
      variables: { pagoId: pago.id, origen: 'confirmacion' }, entidad: 'pago', entidadId: pago.id, paso: 12,
    })
    assert.equal(r.estado, 'enviado')
    const html = emailsA('luis@mail.test')[0].html
    assert.match(html, /Hola, Luis\. Confirmamos tu pago de <strong>\$60<\/strong>/)
    assert.match(html, /disponibles hasta el/)
  })

  test('un pago anulado no se confirma: el aviso se cancela y no sale el correo', async () => {
    const cli = mkCliente({ email: 'luis@mail.test' })
    const pago = seedPago(cli, { estado: 'anulado' })
    const r = await notificar({
      plantilla: 'pago_confirmado', canal: 'correo', destinatario: { tipo: 'cliente', id: cli.id },
      variables: { pagoId: pago.id, origen: 'registro' }, entidad: 'pago', entidadId: pago.id, paso: 12,
    })
    assert.equal(r.estado, 'cancelado')
    assert.equal(emailsA('luis@mail.test').length, 0)
  })
})
