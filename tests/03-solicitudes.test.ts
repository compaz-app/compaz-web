/* eslint-disable */
import { db, net, session, limpiar, req, tgText, tgBtn, ultimoTg, tgPara, emailsA, ahoraMas, mkCompita, mkCliente, mkSolicitud, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as crear } from '@/app/api/solicitudes/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'

beforeEach(limpiar)

const pedir = (cliente: any, body: any) => { session.user = { id: cliente.id, email: cliente.email }; return crear(req('/api/solicitudes', { json: body })) }
const ok3 = () => [ahoraMas(120), ahoraMas(240), ahoraMas(360)]

describe('POST /api/solicitudes (cliente pide entrevista)', () => {
  test('sin sesión → 401', async () => {
    const c = mkCompita()
    session.user = null
    assert.equal((await crear(req('/api/solicitudes', { json: { compita_id: c.id, mensaje: 'x', slots_propuestos: ok3() } }))).status, 401)
  })

  test('validaciones: pasado, NaN, >3, vacío, mensaje enorme, compita no disponible, cliente bloqueado', async () => {
    const compita = mkCompita(); const cli = mkCliente()
    const base = { compita_id: compita.id, mensaje: 'hola', slots_propuestos: ok3() }
    const malos: Array<[string, any]> = [
      ['slot pasado', { ...base, slots_propuestos: [new Date(Date.now() - 3600_000).toISOString()] }],
      ['slot NaN', { ...base, slots_propuestos: ['no-es-fecha'] }],
      ['slot en 5 min (menos de 30)', { ...base, slots_propuestos: [ahoraMas(5)] }],
      ['4 slots', { ...base, slots_propuestos: [...ok3(), ahoraMas(500)] }],
      ['0 slots', { ...base, slots_propuestos: [] }],
      ['slot a 1 año', { ...base, slots_propuestos: [ahoraMas(60 * 24 * 365)] }],
      ['mensaje vacío', { ...base, mensaje: '   ' }],
      ['mensaje de 2000 chars', { ...base, mensaje: 'a'.repeat(2000) }],
      ['sin compita', { ...base, compita_id: undefined }],
    ]
    for (const [nombre, body] of malos) assert.equal((await pedir(cli, body)).status, 400, nombre)
    assert.equal(db.rows('solicitudes').length, 0)

    const inactiva = mkCompita({ verificado: false })
    assert.equal((await pedir(cli, { ...base, compita_id: inactiva.id })).status, 400)
    const bloqueado = mkCliente({ plan: 'bloqueado' })
    assert.equal((await pedir(bloqueado, base)).status, 403)
  })

  test('creación OK: Telegram a la compita con botones; nombre del cliente con HTML llega escapado', async () => {
    const compita = mkCompita({ telegram_chat_id: '600' }); const cli = mkCliente({ nombre: 'Pedro <b>& Hijos' })
    const r = await pedir(cli, { compita_id: compita.id, mensaje: 'Mi mamá tiene <8am pastillas & más', slots_propuestos: ok3() })
    assert.equal(r.status, 200)
    const m = ultimoTg(600)!
    assert.ok(m, 'la compita recibió el mensaje (no falló el parseo HTML de Telegram)')
    const cb = m.markup.inline_keyboard.flat().map((b: any) => b.callback_data)
    assert.equal(cb.filter((d: string) => d.startsWith('slot:')).length, 3)
    assert.ok(cb.some((d: string) => d.startsWith('rechazar:')))
  })

  test('Telegram caído al crear: la solicitud existe y el ADMIN es avisado (antes se perdía en silencio)', async () => {
    const compita = mkCompita({ telegram_chat_id: '601' }); const cli = mkCliente()
    net.tgFailFor.add('601')
    const r = await pedir(cli, { compita_id: compita.id, mensaje: 'hola', slots_propuestos: ok3() })
    assert.equal(r.status, 200)
    assert.equal(db.rows('solicitudes').length, 1)
    assert.ok(tgPara(999).some((m) => m.text.includes('No se pudo notificar')))
  })

  test('compita sin Telegram vinculado: se avisa al admin', async () => {
    const compita = mkCompita({ telegram_chat_id: null }); const cli = mkCliente()
    await pedir(cli, { compita_id: compita.id, mensaje: 'hola', slots_propuestos: ok3() })
    assert.ok(tgPara(999).some((m) => m.text.includes('Solicitud sin Telegram')))
  })

  test('doble envío simultáneo crea una sola solicitud pendiente', async () => {
    const compita = mkCompita(); const cli = mkCliente()
    const body = { compita_id: compita.id, mensaje: 'hola', slots_propuestos: ok3() }
    const rs = await Promise.all([pedir(cli, body), pedir(cli, body)])
    assert.equal(db.rows('solicitudes').filter((s) => s.estado === 'pendiente').length, 1)
    assert.ok(rs.some((r) => r.status === 400), 'una de las dos recibe el error de duplicado')
  })

  test('límite de 5 solicitudes por 24 h y 3 pendientes', async () => {
    const cli = mkCliente()
    for (let i = 0; i < 3; i++) await pedir(cli, { compita_id: mkCompita().id, mensaje: 'hola', slots_propuestos: ok3() })
    const r = await pedir(cli, { compita_id: mkCompita().id, mensaje: 'hola', slots_propuestos: ok3() })
    assert.equal(r.status, 400)
  })
})

describe('La compita responde por Telegram', () => {
  const setup = () => {
    const compita = mkCompita({ telegram_chat_id: '610' }); const cli = mkCliente({ email: 'cli@mail.test', nombre: 'Carlos' })
    const sol = mkSolicitud(cli, compita)
    return { compita, cli, sol }
  }

  test('acepta un horario → aceptada, slot guardado, email al cliente y aviso al admin', async () => {
    const { sol } = setup()
    await webhook(tgBtn(610, `slot:1:${sol.token_respuesta}`))
    const s = db.rows('solicitudes')[0]
    assert.equal(s.estado, 'aceptada')
    assert.equal(s.slot_confirmado, sol.slots_propuestos[1])
    assert.equal(emailsA('cli@mail.test').length, 1)
    assert.ok(tgPara(999).some((m) => m.text.includes('Entrevista confirmada')))
  })

  test('doble toque: la segunda pulsación no reprocesa ni reenvía el email', async () => {
    const { sol } = setup()
    await webhook(tgBtn(610, `slot:0:${sol.token_respuesta}`))
    await webhook(tgBtn(610, `slot:2:${sol.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].slot_confirmado, sol.slots_propuestos[0])
    assert.equal(emailsA('cli@mail.test').length, 1)
    assert.match(ultimoTg(610)!.text, /ya fue usado/)
  })

  test('otra compita no puede aceptar una solicitud ajena', async () => {
    const { sol } = setup()
    mkCompita({ telegram_chat_id: '611' })
    await webhook(tgBtn(611, `slot:0:${sol.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].estado, 'pendiente')
    assert.match(ultimoTg(611)!.text, /no es tuya/)
  })

  test('un horario que ya pasó no se puede aceptar', async () => {
    const compita = mkCompita({ telegram_chat_id: '612' }); const cli = mkCliente()
    const sol = mkSolicitud(cli, compita, { slots_propuestos: [new Date(Date.now() - 3600_000).toISOString(), ahoraMas(120)] })
    await webhook(tgBtn(612, `slot:0:${sol.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].estado, 'pendiente')
    assert.match(ultimoTg(612)!.text, /ya pasó/)
  })

  test('rechaza → rechazada y pide horarios alternativos; el texto llega al cliente escapado', async () => {
    const { sol } = setup()
    await webhook(tgBtn(610, `rechazar:${sol.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].estado, 'rechazada')
    await webhook(tgText(610, 'El lunes 3pm <script>alert(1)</script>'))
    const mail = emailsA('cli@mail.test').at(-1)!
    assert.ok(mail.html.includes('lunes 3pm'))
    assert.ok(!mail.html.includes('<script>alert(1)</script>'), 'el texto de la compita está escapado')
  })

  test('CRUCE: mensaje de visita con OTRO cliente no se filtra por email al cliente rechazado', async () => {
    const { compita, sol } = setup()
    await webhook(tgBtn(610, `rechazar:${sol.token_respuesta}`))
    // La compita tiene una visita en curso con otro cliente y le escribe algo
    const otro = mkCliente({ email: 'otro@mail.test' })
    mkVisita(otro, compita, { estado: 'en_curso', inicio: new Date().toISOString() })
    await webhook(tgText(610, 'Ya llegué, la señora está bien'))
    assert.equal(emailsA('cli@mail.test').length, 0, 'el cliente rechazado NO recibe mensajes de otra visita')
    assert.ok(db.rows('mensajes').some((m) => m.contenido === 'Ya llegué, la señora está bien' && m.origen === 'compita'))
    // En cambio, si RESPONDE al mensaje del bot, sí se toma como horarios alternativos
    await webhook(tgText(610, 'Martes 4pm', { reply_to_message: { message_id: 3 } }))
    assert.equal(emailsA('cli@mail.test').length, 1)
  })
})
