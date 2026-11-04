/* eslint-disable */
// Paso 1.5: escalera de respaldo (lib/escalera.ts y cron escalera-avisos).
// Se mide la acción, no la entrega: un aviso entregado que nadie atiende pasa al correo y luego al equipo.
import { db, net, limpiar, cron, mkCompita, mkCliente, mkSolicitud, tgPara, emailsA, ahoraMas } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { procesarEscalera } from '@/lib/escalera'
import { POST as escaleraCron } from '@/app/api/cron/escalera-avisos/route'

beforeEach(limpiar)

const hace = (min: number) => ahoraMas(-min)

function escenario(o: { email?: string | null; estadoSolicitud?: string } = {}) {
  const compita = mkCompita({ telegram_chat_id: '960', nombre: 'Lucía Pérez', email: o.email === undefined ? 'lucia@mail.test' : o.email })
  const cli = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test' })
  const sol = mkSolicitud(cli, compita, { estado: o.estadoSolicitud ?? 'pendiente' })
  return { compita, cli, sol }
}
const avisoSolicitud = (compita: any, sol: any, o: Record<string, any> = {}) =>
  db.seed('avisos', {
    destinatario_tipo: 'compita', destinatario_id: compita.id, canal: 'telegram', plantilla: 'solicitud_nueva',
    variables: { solicitudId: sol.id }, entidad: 'solicitud', entidad_id: sol.id, paso: 5,
    estado: 'enviado', intentos: 1, ultimo_intento_en: hace(400), programado_para: hace(400), plazo_accion_hasta: hace(1), ...o,
  })
const avisos = () => db.rows('avisos')

describe('avisos atascados y fallidos', () => {
  test('un aviso que quedó "pendiente" (el servidor se cayó) se envía', async () => {
    const { compita, sol } = escenario()
    avisoSolicitud(compita, sol, { estado: 'pendiente', intentos: 0, ultimo_intento_en: null, plazo_accion_hasta: null, programado_para: hace(10) })
    const r = await procesarEscalera()
    assert.equal(r.barridos, 1)
    assert.equal(avisos()[0].estado, 'enviado')
    assert.equal(tgPara(960).length, 1)
  })

  test('un aviso pendiente reciente no se toca (puede estar enviándose)', async () => {
    const { compita, sol } = escenario()
    avisoSolicitud(compita, sol, { estado: 'pendiente', intentos: 0, ultimo_intento_en: null, plazo_accion_hasta: null, programado_para: hace(1) })
    assert.equal((await procesarEscalera()).barridos, 0)
  })

  test('un fallo pasajero se reintenta y llega', async () => {
    const { compita, sol } = escenario()
    avisoSolicitud(compita, sol, { estado: 'fallido', error: 'Telegram sendMessage error: timeout', ultimo_intento_en: hace(10), plazo_accion_hasta: null })
    const r = await procesarEscalera()
    assert.equal(r.reintentos, 1)
    assert.equal(avisos()[0].estado, 'enviado')
    assert.equal(avisos()[0].intentos, 2)
  })

  test('un fallo permanente (sin Telegram vinculado) no se reintenta', async () => {
    const { compita, sol } = escenario()
    avisoSolicitud(compita, sol, { estado: 'fallido', error: 'sin Telegram vinculado', ultimo_intento_en: hace(10), plazo_accion_hasta: null })
    assert.equal((await procesarEscalera()).reintentos, 0)
  })

  test('si el respaldo ya salió, no se reintenta el original (duplicaría el aviso)', async () => {
    const { compita, sol } = escenario()
    const original = avisoSolicitud(compita, sol, { estado: 'fallido', error: 'Telegram sendMessage error: x', ultimo_intento_en: hace(10), plazo_accion_hasta: null })
    avisoSolicitud(compita, sol, { canal: 'correo', respaldo_de: original.id, plazo_accion_hasta: hace(-300) })
    assert.equal((await procesarEscalera()).reintentos, 0)
    assert.equal(tgPara(960).length, 0)
  })

  test('deja de reintentar tras 3 intentos', async () => {
    const { compita, sol } = escenario()
    avisoSolicitud(compita, sol, { estado: 'fallido', error: 'Telegram sendMessage error: x', intentos: 3, ultimo_intento_en: hace(10), plazo_accion_hasta: null })
    assert.equal((await procesarEscalera()).reintentos, 0)
  })
})

describe('avisos sin acción: respaldo y luego tarea para el equipo', () => {
  test('primer nivel: pasa el plazo sin respuesta y se manda el correo de respaldo, una sola vez', async () => {
    const { compita, sol } = escenario()
    const original = avisoSolicitud(compita, sol)
    const r = await procesarEscalera()
    assert.equal(r.respaldos, 1)
    const correo = emailsA('lucia@mail.test')
    assert.equal(correo.length, 1)
    assert.match(correo[0].subject, /^Recordatorio: Nueva solicitud de entrevista/)
    const hijo = avisos().find((a) => a.respaldo_de === original.id && a.canal === 'correo')!
    assert.equal(hijo.estado, 'enviado')
    assert.ok(hijo.plazo_accion_hasta, 'el respaldo también espera una acción')
    assert.equal(original.plazo_accion_hasta, null, 'el original deja de vigilarse')

    const r2 = await procesarEscalera()
    assert.equal(r2.respaldos, 0, 'no se repite')
    assert.equal(emailsA('lucia@mail.test').length, 1)
  })

  test('segundo nivel: si el respaldo tampoco tiene acción se abre una tarea, una sola vez', async () => {
    const { compita, sol } = escenario()
    const original = avisoSolicitud(compita, sol, { plazo_accion_hasta: null })
    avisoSolicitud(compita, sol, { canal: 'correo', respaldo_de: original.id, plazo_accion_hasta: hace(1) })
    const r = await procesarEscalera()
    assert.equal(r.tareas, 1)
    const flag = db.rows('admin_flags')[0]
    assert.equal(flag.entidad_tipo, 'compita')
    assert.match(flag.entidad_nombre, /Lucía Pérez no respondió una solicitud/)
    assert.equal(flag.reportado_por, 'escalera automática')
    assert.ok(tgPara(999).some((m) => /no respondió una solicitud/.test(m.text)), 'el admin lo sabe')
    assert.ok(avisos().some((a) => a.clave_unica === `escalera_tarea:${original.id}`), 'queda la marca de idempotencia')

    const r2 = await procesarEscalera()
    assert.equal(r2.tareas, 0)
    assert.equal(db.rows('admin_flags').length, 1, 'no se duplica la tarea')
  })

  test('si el compita no tiene correo, pasa directo a la tarea', async () => {
    const { compita, sol } = escenario({ email: null })
    avisoSolicitud(compita, sol)
    const r = await procesarEscalera()
    assert.equal(r.respaldos, 0)
    assert.equal(r.tareas, 1)
    assert.equal(emailsA('lucia@mail.test').length, 0)
  })

  test('si la persona ya actuó (accion_en), no escala', async () => {
    const { compita, sol } = escenario()
    avisoSolicitud(compita, sol, { accion_en: hace(30) })
    const r = await procesarEscalera()
    assert.deepEqual([r.respaldos, r.tareas], [0, 0])
  })

  test('si el plazo no ha vencido, no escala', async () => {
    const { compita, sol } = escenario()
    avisoSolicitud(compita, sol, { plazo_accion_hasta: hace(-60) })
    const r = await procesarEscalera()
    assert.deepEqual([r.respaldos, r.tareas], [0, 0])
  })

  test('si el hecho ya no aplica (respondió por otro camino), se cancela sin molestar a nadie', async () => {
    const { compita, sol } = escenario({ estadoSolicitud: 'aceptada' })
    avisoSolicitud(compita, sol)
    const r = await procesarEscalera()
    assert.equal(r.cancelados, 1)
    assert.equal(avisos()[0].estado, 'cancelado')
    assert.equal(emailsA('lucia@mail.test').length, 0)
    assert.equal(db.rows('admin_flags').length, 0)
  })

  test('si el correo de respaldo falla, el compita igual pasa a la tarea del equipo', async () => {
    const { compita, sol } = escenario()
    avisoSolicitud(compita, sol)
    net.resendFail = true
    const r = await procesarEscalera()
    assert.equal(r.respaldos, 0)
    assert.equal(r.tareas, 1)
  })
})

describe('la pregunta de contratar sin respuesta', () => {
  const avisoDecision = (cli: any, sol: any, o: Record<string, any> = {}) =>
    db.seed('avisos', {
      destinatario_tipo: 'cliente', destinatario_id: cli.id, canal: 'correo', plantilla: 'llamada_terminada_cliente',
      variables: { solicitudId: sol.id, corta: false }, entidad: 'solicitud', entidad_id: sol.id, paso: 10,
      estado: 'enviado', intentos: 1, ultimo_intento_en: hace(200), programado_para: hace(200), plazo_accion_hasta: hace(1), ...o,
    })

  test('a las 2 h sin decidir, el cliente recibe un recordatorio', async () => {
    const { cli, sol } = escenario({ estadoSolicitud: 'aceptada' })
    avisoDecision(cli, sol)
    const r = await procesarEscalera()
    assert.equal(r.respaldos, 1)
    assert.match(emailsA('caro@mail.test')[0].subject, /^Recordatorio: ¿Qué decidiste sobre Lucía Pérez\?/)
  })

  test('si ya decidió (la solicitud se cerró), no se le vuelve a preguntar', async () => {
    const { cli, sol } = escenario({ estadoSolicitud: 'rechazada' })
    avisoDecision(cli, sol)
    const r = await procesarEscalera()
    assert.equal(r.cancelados, 1)
    assert.equal(emailsA('caro@mail.test').length, 0)
  })

  test('tras el recordatorio sin decisión, se abre una tarea para el equipo', async () => {
    const { cli, sol } = escenario({ estadoSolicitud: 'aceptada' })
    const original = avisoDecision(cli, sol, { plazo_accion_hasta: null })
    avisoDecision(cli, sol, { respaldo_de: original.id, plazo_accion_hasta: hace(1) })
    const r = await procesarEscalera()
    assert.equal(r.tareas, 1)
    assert.match(db.rows('admin_flags')[0].entidad_nombre, /Carolina Pérez no ha decidido/)
    assert.equal(db.rows('admin_flags')[0].entidad_tipo, 'cliente')
  })
})

describe('cron escalera-avisos', () => {
  test('sin secreto responde 401', async () => {
    assert.equal((await escaleraCron(cron('escalera-avisos', null))).status, 401)
  })

  test('con secreto procesa, devuelve el resumen y deja su latido', async () => {
    const { compita, sol } = escenario()
    avisoSolicitud(compita, sol)
    const r = await escaleraCron(cron('escalera-avisos'))
    assert.equal(r.status, 200)
    assert.equal((await r.json()).data.respaldos, 1)
    assert.ok(db.rows('telegram_estados').some((e) => e.chat_id === 'cron:escalera-avisos'))
  })
})
