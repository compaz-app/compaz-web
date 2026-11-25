/* eslint-disable */
// Fuga de contactos en los textos libres: la solicitud de entrevista y los horarios sugeridos por el compita.
// El teléfono y el correo se censuran antes de llegar a la otra parte y el equipo recibe una alerta (como en el chat).
import { db, net, limpiar, req, session, mkCompita, mkCliente, mkSolicitud, ahoraMas, tgPara, tgText, emailsA, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as crear } from '@/app/api/solicitudes/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { reportarContactoEnTexto } from '@/lib/chat-moderacion'

beforeEach(limpiar)

const pedir = (cliente: any, body: any) => {
  session.user = { id: cliente.id, email: cliente.email }
  return crear(req('/api/solicitudes', { json: body }))
}
const horarios = () => [ahoraMas(120), ahoraMas(240)]

describe('POST /api/solicitudes: contactos en el texto libre', () => {
  test('teléfono y correo del cliente se censuran antes de llegar al compita', async () => {
    const cliente = mkCliente({ nombre: 'Carolina Pérez' })
    const compita = mkCompita()
    const r = await pedir(cliente, {
      compita_id: compita.id,
      mensaje: 'Mi mamá vive sola. Llámame al 0414 1234567 o escríbeme a carolina@mail.com',
      sobre_cliente: 'Soy yo, +58 414 7654321',
      slots_propuestos: horarios(),
    })
    assert.equal(r.status, 200, 'la solicitud se crea igual')

    const s = db.rows('solicitudes')[0]
    assert.ok(!/1234567|carolina@mail\.com/.test(s.mensaje), 'el mensaje guardado no tiene el contacto')
    assert.ok(!/7654321/.test(s.sobre_cliente), 'sobre_cliente guardado no tiene el contacto')
    assert.match(s.mensaje, /Mi mamá vive sola/, 'el resto del texto se conserva')

    const aCompita = net.tg.filter((m) => m.chat === String(compita.telegram_chat_id))
    assert.ok(aCompita.length >= 1, 'el compita recibió su aviso')
    for (const m of aCompita) assert.ok(!/1234567|7654321|carolina@mail\.com/.test(m.text), 'ningún aviso al compita lleva el contacto')
    for (const e of net.emails) assert.ok(!/1234567|7654321|carolina@mail\.com/.test(e.html), 'ningún correo al compita lleva el contacto')
  })

  test('se crea la alerta en Atención y se avisa al admin', async () => {
    const cliente = mkCliente({ nombre: 'Carolina Pérez' })
    const compita = mkCompita()
    await pedir(cliente, { compita_id: compita.id, mensaje: 'Hola, mi correo es carolina@mail.com', slots_propuestos: horarios() })
    const flag = db.rows('admin_flags')[0]
    assert.ok(flag, 'hay un flag')
    assert.equal(flag.entidad_tipo, 'cliente')
    assert.equal(flag.entidad_id, cliente.id)
    assert.equal(flag.reportado_por, 'moderación automática')
    assert.equal(flag.resuelto, false)
    assert.ok(avisosAdmin().some((m) => /Contacto externo/.test(m.text)), 'el admin recibe la alerta por Telegram')
  })

  test('un texto normal no se toca y no genera alerta', async () => {
    const cliente = mkCliente()
    const compita = mkCompita()
    await pedir(cliente, { compita_id: compita.id, mensaje: 'Mi mamá tiene 82 años y le gusta el jardín', sobre_cliente: 'Vivo en Miami desde 2015', slots_propuestos: horarios() })
    const s = db.rows('solicitudes')[0]
    assert.equal(s.mensaje, 'Mi mamá tiene 82 años y le gusta el jardín')
    assert.equal(s.sobre_cliente, 'Vivo en Miami desde 2015')
    assert.equal(db.rows('admin_flags').length, 0)
  })
})

describe('reportarContactoEnTexto', () => {
  test('crea el flag y avisa al admin, y nunca lanza', async () => {
    await reportarContactoEnTexto({ origen: 'compita', donde: 'los horarios sugeridos al cliente', quien: 'María Fuentes', entidadTipo: 'compita', entidadId: 'c1', textoOriginal: 'llámame al 0414 1234567' })
    const flag = db.rows('admin_flags')[0]
    assert.equal(flag.entidad_tipo, 'compita')
    assert.match(flag.nota, /los horarios sugeridos al cliente/)
    assert.ok(avisosAdmin().length > 0)
    net.tgFailAll = true
    db.fail['admin_flags:insert'] = 1
    await assert.doesNotReject(reportarContactoEnTexto({ origen: 'cliente', donde: 'x', quien: 'y', entidadTipo: 'cliente', entidadId: 'z', textoOriginal: 't' }))
  })
})

