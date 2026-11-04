/* eslint-disable */
// Paso 1.4 (flujo C): al terminar la entrevista, la pregunta de contratar sale con notificar().
// Queda registrada, un fallo se puede reintentar, una sala nueva (tras reconectar) tiene su propio aviso
// y la decisión del cliente anota la acción y el evento.
import { db, net, limpiar, req, mkCompita, mkCliente, mkSolicitud, tgPara, emailsA, firmaDaily, ahoraMas } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as dailyWebhook } from '@/app/api/webhooks/daily/route'
import { POST as resultadoPost, GET as resultadoGet } from '@/app/api/solicitud/resultado-llamada/route'
import { reintentarAviso } from '@/lib/avisos'
import { qRol } from '@/lib/links'

beforeEach(limpiar)

function escenario() {
  const compita = mkCompita({ telegram_chat_id: '900', nombre: 'Lucía Pérez' })
  const cli = mkCliente({ email: 'carlos@mail.test', nombre: 'Carlos Ruiz' })
  const sol = mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: new Date(Date.now() - 5 * 60_000).toISOString(), room_url: 'https://compaz.daily.co/ent-x-1' })
  return { compita, cli, sol }
}
const terminar = (sol: any, duracion: number) => {
  const body = JSON.stringify({ event_type: 'meeting.ended', payload: { room_name: 'ent-x', room_url: sol.room_url, duration: duracion } })
  return dailyWebhook(req('/api/webhooks/daily', { body, headers: { 'content-type': 'application/json', ...firmaDaily(body) } }))
}
const avisos = (canal: string) => db.rows('avisos').filter((a) => a.canal === canal && a.paso === 10)

describe('webhook de Daily: avisos post-llamada con registro', () => {
  test('llamada normal: el cliente recibe la pregunta, el compita las gracias, y todo queda registrado', async () => {
    const { sol } = escenario()
    await terminar(sol, 900)
    const correo = emailsA('carlos@mail.test')
    assert.equal(correo.length, 1)
    assert.match(correo[0].html, /Sí, quiero contratar a Lucía Pérez/)
    assert.ok(tgPara(900).some((m) => m.text.includes('¡Gracias por la llamada!')))
    assert.equal(avisos('correo')[0].estado, 'enviado')
    assert.ok(avisos('correo')[0].plazo_accion_hasta, 'se espera su decisión en 2 h')
    assert.equal(avisos('telegram')[0].estado, 'enviado')
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'entrevista_terminada' && e.datos.corta === false))
  })

  test('llamada corta: no se ofrece contratar y al compita se le pregunta qué pasó', async () => {
    const { sol } = escenario()
    await terminar(sol, 45)
    assert.ok(!emailsA('carlos@mail.test')[0].html.includes('Sí, quiero contratar'))
    assert.ok(tgPara(900).some((m) => m.text.includes('problemas técnicos')))
  })

  test('tras reconectar (sala nueva) la llamada completa tiene su propio aviso', async () => {
    const { sol } = escenario()
    await terminar(sol, 45)
    sol.room_url = 'https://compaz.daily.co/ent-x-2'
    sol.confirmacion_llamada_enviada = false // lo que hace reconectar-llamada
    net.emails = []
    await terminar(sol, 900)
    assert.equal(emailsA('carlos@mail.test').length, 1)
    assert.match(emailsA('carlos@mail.test')[0].html, /Sí, quiero contratar/)
    assert.equal(avisos('correo').length, 2)
  })

  test('si el correo falla: el admin se entera, queda fallido y se puede reintentar', async () => {
    const { sol } = escenario()
    net.resendFail = true
    await terminar(sol, 900)
    assert.ok(tgPara(999).some((m) => m.text.includes('No se pudo enviar el correo post-llamada')))
    const a = avisos('correo')[0]
    assert.equal(a.estado, 'fallido')
    net.resendFail = false
    assert.equal((await reintentarAviso(a.id)).estado, 'enviado')
    assert.equal(emailsA('carlos@mail.test').length, 1)
  })

  test('si Telegram falla con el compita: no rompe nada y el correo del cliente sale igual', async () => {
    const { sol } = escenario()
    net.tgFailFor.add('900')
    const r = await terminar(sol, 900)
    assert.equal(r.status, 200)
    assert.equal(emailsA('carlos@mail.test').length, 1)
    assert.equal(avisos('telegram')[0].estado, 'fallido')
  })
})

describe('decisión del cliente', () => {
  test('al decir que no: se anota la acción y el evento, y el aviso fallido de esa decisión ya no se reintenta', async () => {
    const { sol } = escenario()
    net.resendFail = true
    await terminar(sol, 900)
    net.resendFail = false
    const t = sol.token_respuesta
    await resultadoPost(req(`/api/solicitud/resultado-llamada?token=${t}&resultado=no_contratar&${qRol(t, 'cliente')}`, { method: 'POST' }))
    assert.equal(db.rows('solicitudes')[0].estado, 'rechazada')
    assert.equal(avisos('correo')[0].estado, 'cancelado', 'ya decidió: no se le reenvía la pregunta')
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'decision_contratar' && e.datos.resultado === 'no_contratar' && e.actor.startsWith('cliente:')))
  })

  test('al tocar contratar: se anota la acción del aviso y el evento, y va al pago', async () => {
    const { sol } = escenario()
    await terminar(sol, 900)
    const r = await resultadoGet(req(`/api/solicitud/resultado-llamada?token=${sol.token_respuesta}&resultado=contratar`))
    assert.equal(r.status, 303)
    assert.match(r.headers.get('location')!, /\/pago\?solicitud=/)
    assert.ok(avisos('correo')[0].accion_en, 'el aviso queda con la acción anotada')
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'decision_contratar' && e.datos.resultado === 'contratar'))
  })
})
