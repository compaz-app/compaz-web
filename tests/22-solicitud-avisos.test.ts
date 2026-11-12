/* eslint-disable */
// Paso 1.4 (flujo A): la solicitud de entrevista avisa al compita con notificar().
// Telegram primero y con registro; si no se entrega, el correo de respaldo sale en ese momento.
import { db, net, limpiar, req, session, mkCompita, mkCliente, ahoraMas, tgPara, tgBtn, emailsA, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as crear } from '@/app/api/solicitudes/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'

beforeEach(limpiar)

const pedir = (cliente: any, body: any) => {
  session.user = { id: cliente.id, email: cliente.email }
  return crear(req('/api/solicitudes', { json: body }))
}
const datos = (compita: any) => ({ compita_id: compita.id, mensaje: 'Mi mamá vive sola', slots_propuestos: [ahoraMas(120), ahoraMas(240)] })
const avisosDe = (canal: string) => db.rows('avisos').filter((a) => a.canal === canal)

describe('solicitud nueva: Telegram primero, correo solo de respaldo', () => {
  test('con Telegram activo el compita recibe un solo aviso, por Telegram, y queda registrado', async () => {
    const compita = mkCompita({ telegram_chat_id: '800', email: 'lucia@mail.test' })
    const r = await pedir(mkCliente({ nombre: 'Carolina' }), datos(compita))
    assert.equal(r.status, 200)
    assert.equal(tgPara(800).length, 1, 'un mensaje de Telegram')
    assert.equal(emailsA('lucia@mail.test').length, 0, 'sin correo a la vez')
    const a = avisosDe('telegram')[0]
    assert.equal(a.estado, 'enviado')
    assert.equal(a.plantilla, 'solicitud_nueva')
    assert.equal(a.paso, 5)
    assert.ok(a.plazo_accion_hasta, 'se espera una respuesta en 6 h')
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'solicitud_creada'), 'queda el evento')
  })

  test('si Telegram falla, el correo de respaldo sale enseguida con enlaces firmados y queda enlazado', async () => {
    const compita = mkCompita({ telegram_chat_id: '801', email: 'lucia@mail.test' })
    net.tgFailFor.add('801')
    const r = await pedir(mkCliente({ nombre: 'Carolina' }), datos(compita))
    assert.equal(r.status, 200, 'la solicitud se crea igual')
    const tg = avisosDe('telegram')[0]
    const correo = avisosDe('correo')[0]
    assert.equal(tg.estado, 'fallido')
    assert.ok(tg.error)
    assert.equal(correo.estado, 'enviado')
    assert.equal(correo.respaldo_de, tg.id, 'el respaldo apunta al aviso que falló')
    const enviado = emailsA('lucia@mail.test')
    assert.equal(enviado.length, 1)
    assert.match(enviado[0].html, /\/api\/solicitud\/responder\?token=[^"]+(&amp;|&)slot=0(&amp;|&)quien=compita(&amp;|&)s=/, 'enlace firmado por horario')
    assert.match(enviado[0].html, /slot=-1/, 'enlace para rechazar')
    assert.ok(avisosAdmin().some((m) => /No se pudo notificar/.test(m.text) && /Se le notificó por correo/.test(m.text)), 'el admin sabe')
  })

  test('sin Telegram vinculado pero con correo: sale el correo y se avisa al admin', async () => {
    const compita = mkCompita({ telegram_chat_id: null, email: 'lucia@mail.test' })
    await pedir(mkCliente(), datos(compita))
    assert.equal(avisosDe('telegram')[0].estado, 'fallido')
    assert.equal(avisosDe('telegram')[0].error, 'sin Telegram vinculado')
    assert.equal(emailsA('lucia@mail.test').length, 1)
    assert.ok(avisosAdmin().some((m) => /Solicitud sin Telegram/.test(m.text) && /Se le notificó por correo/.test(m.text)))
  })

  test('sin Telegram ni correo: no hay a dónde avisar y el admin lo sabe', async () => {
    const compita = mkCompita({ telegram_chat_id: null, email: null })
    const r = await pedir(mkCliente(), datos(compita))
    assert.equal(r.status, 200)
    assert.equal(avisosDe('correo').length, 0)
    assert.ok(avisosAdmin().some((m) => /No tiene correo registrado/.test(m.text)))
  })

  test('si el correo de respaldo también falla, el admin lo sabe y la solicitud existe', async () => {
    const compita = mkCompita({ telegram_chat_id: '802', email: 'lucia@mail.test' })
    net.tgFailFor.add('802'); net.resendFail = true
    const r = await pedir(mkCliente(), datos(compita))
    assert.equal(r.status, 200)
    assert.equal(db.rows('solicitudes').length, 1)
    assert.equal(avisosDe('correo')[0].estado, 'fallido')
    assert.ok(avisosAdmin().some((m) => /Tampoco se pudo por correo/.test(m.text)))
  })
})

describe('cuando el compita responde', () => {
  test('al aceptar un horario se anota la acción, se cancelan pendientes y queda el evento', async () => {
    const compita = mkCompita({ telegram_chat_id: '803', email: 'lucia@mail.test' })
    await pedir(mkCliente(), datos(compita))
    const sol = db.rows('solicitudes')[0]
    await webhook(tgBtn(803, `slot:0:${sol.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].estado, 'aceptada')
    assert.ok(avisosDe('telegram')[0].accion_en, 'el aviso queda con la acción anotada')
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'solicitud_aceptada' && e.actor === `compita:${compita.id}`))
  })

  test('al rechazar queda el evento y un aviso fallido de esa solicitud se cancela', async () => {
    const compita = mkCompita({ telegram_chat_id: '804', email: null })
    net.tgFailFor.add('804')
    await pedir(mkCliente(), datos(compita))
    assert.equal(avisosDe('telegram')[0].estado, 'fallido')
    const sol = db.rows('solicitudes')[0]
    net.tgFailFor.clear()
    await webhook(tgBtn(804, `rechazar:${sol.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].estado, 'rechazada')
    assert.equal(avisosDe('telegram')[0].estado, 'cancelado', 'ya no se reintenta algo ya respondido')
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'solicitud_rechazada'))
  })
})
