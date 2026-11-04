/* eslint-disable */
// Recorridos de punta a punta de lo AUTOMÁTICO, simulando el paso del tiempo: avisos, escalera, eventos,
// decisiones y motivos encadenados sobre la misma base. Comprueba que las piezas hablan bien entre sí.
import { db, net, session, limpiar, req, mkCompita, mkCliente, mkSolicitud, ahoraMas, emailsA, tgPara, tgBtn, firmaDaily } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as crear } from '@/app/api/solicitudes/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as dailyWebhook } from '@/app/api/webhooks/daily/route'
import { POST as resultadoPost } from '@/app/api/solicitud/resultado-llamada/route'
import { GET as motivoGet, POST as motivoPost } from '@/app/api/solicitud/motivo/route'
import { POST as registrarPago } from '@/app/api/admin/registrar-pago/route'
import { procesarEscalera } from '@/lib/escalera'
import { qRol } from '@/lib/links'

beforeEach(limpiar)

const hace = (min: number) => ahoraMas(-min)
const avisos = () => db.rows('avisos').filter((a) => a.plantilla !== 'escalera_tarea')
const tipos = (solicitudId: string) => db.rows('eventos').filter((e) => e.entidad_id === solicitudId).map((e) => e.tipo)
/** Simula que pasó el plazo de espera de todos los avisos que esperan una acción. */
const vencerPlazos = () => db.rows('avisos').forEach((a) => { if (a.plazo_accion_hasta) a.plazo_accion_hasta = hace(1) })

describe('recorrido 1: el compita tarda en responder una solicitud', () => {
  test('aviso, respaldo por correo, tarea para el equipo y, al final, la respuesta tardía sin romper nada', async () => {
    const compita = mkCompita({ telegram_chat_id: '980', nombre: 'Lucía Pérez', email: 'lucia@mail.test' })
    const cliente = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test' })
    session.user = { id: cliente.id, email: cliente.email }
    const r = await crear(req('/api/solicitudes', { json: { compita_id: compita.id, mensaje: 'Mi mamá vive sola', slots_propuestos: [ahoraMas(120), ahoraMas(240)] } }))
    assert.equal(r.status, 200)
    const sol = db.rows('solicitudes')[0]

    // 1. Telegram sale primero y solo Telegram (sin correo a la vez)
    assert.equal(tgPara(980).length, 1)
    assert.equal(emailsA('lucia@mail.test').length, 0)
    assert.equal(avisos()[0].estado, 'enviado')

    // 2. Antes de que venza el plazo la escalera no molesta a nadie
    let e = await procesarEscalera()
    assert.deepEqual([e.respaldos, e.tareas], [0, 0])

    // 3. Pasan las 6 horas sin respuesta: llega el correo de respaldo, una sola vez
    vencerPlazos()
    e = await procesarEscalera()
    assert.equal(e.respaldos, 1)
    assert.equal(emailsA('lucia@mail.test').length, 1)
    assert.match(emailsA('lucia@mail.test')[0].subject, /^Recordatorio:/)
    e = await procesarEscalera()
    assert.equal(emailsA('lucia@mail.test').length, 1, 'una segunda corrida no repite el correo')

    // 4. El respaldo tampoco recibe respuesta: se abre UNA tarea para el equipo
    vencerPlazos()
    e = await procesarEscalera()
    assert.equal(e.tareas, 1)
    await procesarEscalera(); await procesarEscalera()
    assert.equal(db.rows('admin_flags').filter((f) => f.reportado_por === 'escalera automática').length, 1, 'una sola tarea aunque la escalera corra muchas veces')
    assert.ok(tgPara(999).some((m) => /no respondió una solicitud/.test(m.text)))

    // 5. El compita responde tarde: la solicitud avanza y los avisos quedan con su acción anotada
    await webhook(tgBtn(980, `slot:0:${sol.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].estado, 'aceptada')
    assert.ok(avisos().every((a) => a.accion_en || a.estado !== 'enviado'), 'ningún aviso enviado queda sin su acción')

    // 6. Después de responder, la escalera ya no hace nada más
    vencerPlazos()
    e = await procesarEscalera()
    assert.deepEqual([e.respaldos, e.tareas], [0, 0])
    assert.deepEqual(tipos(sol.id), ['solicitud_creada', 'solicitud_aceptada'])
  })
})

describe('recorrido 2: el cliente no decide tras la entrevista y al final dice que no', () => {
  test('pregunta, recordatorio, tarea, decisión, motivo y la línea de eventos completa', async () => {
    const compita = mkCompita({ telegram_chat_id: '981', nombre: 'Lucía Pérez' })
    const cliente = mkCliente({ nombre: 'Carlos Ruiz', email: 'carlos@mail.test' })
    const sol = mkSolicitud(cliente, compita, { estado: 'aceptada', slot_confirmado: hace(30), room_url: 'https://compaz.daily.co/ent-y-1' })

    // 1. Termina la llamada: el cliente recibe la pregunta y el compita las gracias
    const body = JSON.stringify({ event_type: 'meeting.ended', payload: { room_name: 'ent-y', room_url: sol.room_url, duration: 900 } })
    await dailyWebhook(req('/api/webhooks/daily', { body, headers: { 'content-type': 'application/json', ...firmaDaily(body) } }))
    assert.equal(emailsA('carlos@mail.test').length, 1)
    assert.ok(tgPara(981).some((m) => m.text.includes('¡Gracias por la llamada!')))

    // 2. No decide: recordatorio y luego tarea para el equipo
    vencerPlazos()
    let e = await procesarEscalera()
    assert.equal(e.respaldos, 1)
    assert.match(emailsA('carlos@mail.test').at(-1)!.subject, /^Recordatorio:/)
    vencerPlazos()
    e = await procesarEscalera()
    assert.equal(e.tareas, 1)
    assert.match(db.rows('admin_flags').at(-1)!.entidad_nombre, /Carlos Ruiz no ha decidido/)

    // 3. Decide que no: la solicitud se cierra y la escalera deja de vigilar
    const t = sol.token_respuesta
    const r = await resultadoPost(req(`/api/solicitud/resultado-llamada?token=${t}&resultado=no_contratar&${qRol(t, 'cliente')}`, { method: 'POST' }))
    assert.equal(r.status, 303)
    assert.equal(db.rows('solicitudes')[0].estado, 'rechazada')
    vencerPlazos()
    e = await procesarEscalera()
    assert.deepEqual([e.respaldos, e.tareas], [0, 0])

    // 4. Cuenta el motivo desde la pantalla a la que lo llevaron
    const destino = new URL(r.headers.get('location')!)
    assert.equal((await motivoGet(req(destino.pathname + destino.search))).status, 200)
    const m = await motivoPost(req(destino.pathname + destino.search, { method: 'POST', body: 'motivo=precio', headers: { 'content-type': 'application/x-www-form-urlencoded' } }))
    assert.equal(m.status, 200)

    // 5. La línea de eventos cuenta toda la historia, en orden
    assert.deepEqual(tipos(sol.id), ['entrevista_terminada', 'decision_contratar', 'motivo_no_contratar'])
    assert.equal(db.rows('eventos').find((x) => x.tipo === 'motivo_no_contratar')!.datos.motivo, 'precio')
  })
})

describe('recorrido 3: un correo de pago que falla se reintenta solo', () => {
  test('el pago se registra, el correo falla, la escalera lo reintenta y llega una sola vez', async () => {
    const cliente = mkCliente({ nombre: 'Luis Andrade', email: 'luis@mail.test' })
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    net.resendFail = true
    const r = await registrarPago(req('/api/admin/registrar-pago', { json: { usuario_id: cliente.id, tipo: 'plan', plan: 'quincenal', metodo: 'zelle' } }))
    assert.equal(r.status, 200)
    assert.equal(db.rows('pagos_plan').length, 1, 'el pago existe aunque el correo falló')
    assert.equal(avisos()[0].estado, 'fallido')
    assert.equal(emailsA('luis@mail.test').length, 0)

    // Todavía es muy pronto para reintentar
    let e = await procesarEscalera()
    assert.equal(e.reintentos, 0)

    // Pasan unos minutos y el servicio de correo se recupera
    avisos()[0].ultimo_intento_en = hace(10)
    net.resendFail = false
    e = await procesarEscalera()
    assert.equal(e.reintentos, 1)
    assert.equal(emailsA('luis@mail.test').length, 1)
    assert.equal(avisos()[0].estado, 'enviado')

    // Y ya no se repite
    avisos()[0].ultimo_intento_en = hace(10)
    e = await procesarEscalera()
    assert.equal(e.reintentos, 0)
    assert.equal(emailsA('luis@mail.test').length, 1)
  })
})
