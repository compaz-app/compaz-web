/* eslint-disable */
import { db, net, limpiar, cron, tgPara, emailsA, ahoraMas, hoyVEstr, mkCompita, mkCliente, mkSolicitud, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as recordatorios } from '@/app/api/cron/recordatorios/route'
import { POST as seguimiento } from '@/app/api/cron/seguimiento/route'
import { POST as cierre } from '@/app/api/cron/cierre-rechazo/route'
import { POST as noshow } from '@/app/api/cron/noshow-alerta/route'
import { POST as cuestionario } from '@/app/api/cron/recordatorio-cuestionario/route'
import { POST as visitaCron } from '@/app/api/cron/recordatorio-visita/route'
import { POST as manana } from '@/app/api/cron/recordatorio-primera-visita/route'
import { POST as limpieza } from '@/app/api/cron/limpieza/route'

beforeEach(limpiar)
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

describe('Autorización de crons', () => {
  test('sin secreto o con secreto incorrecto → 401, y nada se ejecuta', async () => {
    const compita = mkCompita(); const cli = mkCliente(); mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: ahoraMas(30) })
    for (const h of [recordatorios, seguimiento, cierre, noshow, cuestionario, visitaCron, manana, limpieza]) {
      assert.equal((await h(cron('x', null))).status, 401)
      assert.equal((await h(cron('x', 'incorrecto'))).status, 401)
      assert.equal((await h(cron('x', ''))).status, 401)
    }
    assert.equal(net.emails.length + net.tg.length, 0)
  })
})

describe('recordatorios (link de la llamada 1 h antes)', () => {
  const setup = (min = 30) => {
    const compita = mkCompita({ telegram_chat_id: '700' }); const cli = mkCliente({ email: 'cli@mail.test' })
    const sol = mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: ahoraMas(min) })
    return { compita, cli, sol }
  }

  test('envía email + Telegram + admin una sola vez aunque el cron corra varias veces', async () => {
    setup()
    await recordatorios(cron('r')); await recordatorios(cron('r')); await recordatorios(cron('r'))
    assert.equal(emailsA('cli@mail.test').length, 1)
    assert.equal(tgPara(700).length, 1)
    assert.equal(net.rooms.length, 1)
    assert.match(emailsA('cli@mail.test')[0].html, /\/sala\/[^"]+\?quien=cliente&s=[0-9a-f]{24}/)
    assert.match(tgPara(700)[0].text, /quien=compita&amp;s=|quien=compita&s=/)
  })

  test('Resend caído: no se marca como enviado ni se avisa a la compita; al volver, se envía (sin duplicar)', async () => {
    setup()
    net.resendFail = true
    await recordatorios(cron('r'))
    assert.equal(db.rows('solicitudes')[0].recordatorio_enviado, false, 'el flag se libera para reintentar')
    assert.equal(tgPara(700).length, 0)
    net.resendFail = false
    await recordatorios(cron('r')); await recordatorios(cron('r'))
    assert.equal(emailsA('cli@mail.test').length, 1)
    assert.equal(tgPara(700).length, 1)
  })

  test('Daily caído: se alerta al admin (una vez) y se reintenta', async () => {
    setup()
    net.dailyFail = true
    await recordatorios(cron('r')); await recordatorios(cron('r'))
    assert.equal(tgPara(999).filter((m) => m.text.includes('No se pudo crear la sala')).length, 1)
    assert.equal(net.emails.length, 0)
    net.dailyFail = false
    await recordatorios(cron('r'))
    assert.equal(emailsA('cli@mail.test').length, 1)
  })

  test('llamada de hace 2 h con cron caído: no manda enlaces a una sala ya vencida', async () => {
    setup(-120)
    await recordatorios(cron('r'))
    assert.equal(net.emails.length, 0)
  })

  test('nombre de compita con HTML no inyecta marcado en el email', async () => {
    const compita = mkCompita({ telegram_chat_id: '701', nombre: '<img src=x onerror=alert(1)>' }); const cli = mkCliente({ email: 'c@mail.test' })
    mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: ahoraMas(30) })
    await recordatorios(cron('r'))
    assert.ok(!emailsA('c@mail.test')[0].html.includes('<img src=x'))
  })

  test('alerta de sala vacía funciona (la consulta ya no usa una columna inexistente)', async () => {
    const compita = mkCompita(); const cli = mkCliente()
    mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: hace(120), confirmacion_llamada_enviada: false })
    await recordatorios(cron('r')); await recordatorios(cron('r'))
    assert.equal(tgPara(999).filter((m) => m.text.includes('posible sala vacía')).length, 1)
  })
})

describe('seguimiento (¿ocurrió la llamada? / ¿contratas?)', () => {
  test('paso 1: a los 25 min pide confirmación a ambos con enlaces firmados por rol; una sola vez', async () => {
    const compita = mkCompita({ telegram_chat_id: '710' }); const cli = mkCliente({ email: 'cli@mail.test' })
    mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: hace(30) })
    await seguimiento(cron('s')); await seguimiento(cron('s'))
    assert.equal(emailsA('cli@mail.test').length, 1)
    assert.equal(tgPara(710).length, 1)
    const urls = tgPara(710)[0].markup.inline_keyboard.flat().map((b: any) => b.url)
    assert.ok(urls.every((u: string) => /quien=compita&s=[0-9a-f]{24}/.test(u)))
  })

  test('CASO CRÍTICO: nadie respondió y pasaron 4 h → igual se pregunta "¿quieres contratar?" (antes el NULL lo bloqueaba)', async () => {
    const compita = mkCompita(); const cli = mkCliente({ email: 'cli@mail.test' })
    mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: hace(5 * 60), confirmacion_llamada_enviada: true, confirmacion_cliente: null, confirmacion_compita: null })
    await seguimiento(cron('s')); await seguimiento(cron('s'))
    const mails = emailsA('cli@mail.test').filter((e) => e.subject.includes('¿Cómo te fue'))
    assert.equal(mails.length, 1, 'exactamente un correo de decisión')
  })

  test('si alguien dijo que la llamada NO ocurrió, no se pregunta por contratar', async () => {
    const compita = mkCompita(); const cli = mkCliente({ email: 'cli@mail.test' })
    mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: hace(5 * 60), confirmacion_llamada_enviada: true, confirmacion_cliente: false })
    await seguimiento(cron('s'))
    assert.equal(emailsA('cli@mail.test').length, 0)
  })

  test('compita marcó "estuvo bien" (completada): el cliente igual recibe su seguimiento', async () => {
    const compita = mkCompita(); const cli = mkCliente({ email: 'cli@mail.test' })
    mkSolicitud(cli, compita, { estado: 'completada', slot_confirmado: hace(5 * 60), confirmacion_llamada_enviada: true })
    await seguimiento(cron('s'))
    assert.equal(emailsA('cli@mail.test').length, 1)
  })

  test('recordatorio de 24 h: una sola vez, y los enlaces "no" llevan firma de cliente', async () => {
    const compita = mkCompita(); const cli = mkCliente({ email: 'cli@mail.test' })
    mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: hace(30 * 60), confirmacion_llamada_enviada: true, seguimiento_enviado: true })
    await seguimiento(cron('s')); await seguimiento(cron('s'))
    const mails = emailsA('cli@mail.test')
    assert.equal(mails.length, 1)
    assert.match(mails[0].html, /respuesta=no&quien=cliente&s=[0-9a-f]{24}/)
  })

  test('Resend caído: libera el flag y reintenta sin duplicar', async () => {
    const compita = mkCompita(); const cli = mkCliente({ email: 'cli@mail.test' })
    mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: hace(30 * 60), confirmacion_llamada_enviada: true, seguimiento_enviado: true })
    net.resendFail = true; await seguimiento(cron('s'))
    assert.equal(db.rows('solicitudes')[0].seguimiento2_enviado, false)
    net.resendFail = false; await seguimiento(cron('s')); await seguimiento(cron('s'))
    assert.equal(emailsA('cli@mail.test').length, 1)
  })
})

describe('cierre-rechazo', () => {
  const conSugerir = (prefijo: 'sugerir_horarios' | 'sugerir_r', horasQueFaltan: number) => {
    const compita = mkCompita({ telegram_chat_id: '720', nombre: 'Lucía' }); const cli = mkCliente({ email: 'cli@mail.test', nombre: 'Carlos' })
    const sol = mkSolicitud(cli, compita, { estado: 'rechazada' })
    db.seed('telegram_estados', { chat_id: '720', pendiente_accion: `${prefijo}:${sol.id}:cli@mail.test:Carlos`, pendiente_expira: new Date(Date.now() + horasQueFaltan * 3600_000).toISOString() })
    return { sol }
  }

  test('recordatorio de 2 h se manda UNA vez (antes se repetía cada 30 min)', async () => {
    conSugerir('sugerir_horarios', 20)
    for (let i = 0; i < 6; i++) await cierre(cron('c'))
    assert.equal(tgPara(720).filter((m) => m.text.includes('Recordatorio')).length, 1)
  })

  test('el estado "sugerir_r" (ya recordado) no vuelve a recordar', async () => {
    conSugerir('sugerir_r', 10)
    await cierre(cron('c')); await cierre(cron('c'))
    assert.equal(tgPara(720).length, 0)
  })

  test('a las 24 h cierra: solicitud rechazada, email al cliente, aviso a la compita; idempotente', async () => {
    const { sol } = conSugerir('sugerir_horarios', -1)
    await cierre(cron('c')); await cierre(cron('c'))
    assert.equal(db.rows('solicitudes').find((s) => s.id === sol.id)!.estado, 'rechazada')
    assert.equal(emailsA('cli@mail.test').length, 1)
    assert.equal(tgPara(720).filter((m) => m.text.includes('cerrada automáticamente')).length, 1)
  })

  test('solicitud PENDIENTE ignorada: recordatorio a las 24 h (una vez) y cierre a las 72 h con email', async () => {
    const compita = mkCompita({ telegram_chat_id: '721' }); const cli = mkCliente({ email: 'cli@mail.test' })
    const s1 = mkSolicitud(cli, compita, { created_at: hace(26 * 60) })
    await cierre(cron('c')); await cierre(cron('c'))
    assert.equal(tgPara(721).filter((m) => m.text.includes('sin responder')).length, 1)
    assert.equal(db.rows('solicitudes').find((s) => s.id === s1.id)!.estado, 'pendiente')
    db.rows('solicitudes').find((s) => s.id === s1.id)!.created_at = hace(75 * 60)
    await cierre(cron('c')); await cierre(cron('c'))
    assert.equal(db.rows('solicitudes').find((s) => s.id === s1.id)!.estado, 'rechazada')
    assert.equal(emailsA('cli@mail.test').length, 1)
  })
})

describe('Crons de visitas', () => {
  test('noshow: alerta una sola vez 30 min después de la hora', async () => {
    const compita = mkCompita(); const cli = mkCliente()
    const horaIni = new Date(Date.now() - 4 * 3600_000 - 45 * 60_000).toISOString().slice(11, 16)
    mkVisita(cli, compita, { estado: 'programada', fecha_programada: hoyVEstr(), hora_inicio_programada: horaIni, hora_fin_programada: '23:59' })
    await noshow(cron('n')); await noshow(cron('n'))
    const cruzaMedianoche = hoyVEstr() !== new Date(Date.now() - 4 * 3600_000 - 45 * 60_000).toISOString().slice(0, 10)
    assert.equal(tgPara(999).filter((m) => m.text.includes('Posible no-show')).length, cruzaMedianoche ? 0 : 1)
  })

  test('visita en curso olvidada: máx. 6 recordatorios y alerta al admin a las 8 h (una vez)', async () => {
    const compita = mkCompita({ telegram_chat_id: '730' }); const cli = mkCliente()
    const v = mkVisita(cli, compita, { estado: 'en_curso', inicio: hace(40) })
    for (let i = 0; i < 3; i++) { await visitaCron(cron('v')); db.rows('mensajes').forEach((m) => (m.created_at = hace(45))) }
    assert.equal(tgPara(730).length, 3)
    v.inicio = hace(9 * 60)
    await visitaCron(cron('v')); await visitaCron(cron('v'))
    assert.equal(tgPara(999).filter((m) => m.text.includes('más de 8 horas')).length, 1)
  })

  test('recordatorio de mañana: usa el día de Venezuela y no repite; reprograma → vuelve a avisar', async () => {
    const compita = mkCompita({ telegram_chat_id: '731' }); const cli = mkCliente({ email: 'cli@mail.test' })
    const v = mkVisita(cli, compita, { estado: 'programada', fecha_programada: hoyVEstr(1), hora_inicio_programada: '10:00', hora_fin_programada: '12:00' })
    await manana(cron('m')); await manana(cron('m'))
    assert.equal(tgPara(731).length, 1); assert.equal(emailsA('cli@mail.test').length, 1)
    v.fecha_programada = hoyVEstr(1) // misma fecha: sigue sin repetir
    await manana(cron('m')); assert.equal(tgPara(731).length, 1)
  })

  test('cuestionario pendiente: recordatorio una sola vez', async () => {
    mkCompita({ telegram_chat_id: '732' })
    db.seed('telegram_estados', { chat_id: '732', pendiente_accion: 'reporte:vid:1:5', pendiente_expira: ahoraMas(15) })
    await cuestionario(cron('q')); await cuestionario(cron('q'))
    assert.equal(tgPara(732).length, 1)
    assert.ok(db.rows('telegram_estados').find((e) => e.chat_id === '732')!.pendiente_accion.startsWith('reporte_r:'))
  })

  test('limpieza borra filas de control viejas pero no las recientes', async () => {
    db.seed('telegram_estados', { chat_id: 'upd:1', updated_at: hace(60 * 30) })
    db.seed('telegram_estados', { chat_id: 'upd:2', updated_at: hace(10) })
    db.seed('telegram_estados', { chat_id: '123', pendiente_accion: 'reporte:x:0:' })
    assert.equal((await limpieza(cron('l'))).status, 200)
    const ids = db.rows('telegram_estados').map((r) => r.chat_id)
    assert.ok(!ids.includes('upd:1')); assert.ok(ids.includes('upd:2')); assert.ok(ids.includes('123'))
  })
})
