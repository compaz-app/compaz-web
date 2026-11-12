/* eslint-disable */
// Confirmación de la cita de la visita por el compita: el cliente PROPONE; la visita queda programada solo cuando el compita confirma.
import { db, net, limpiar, req, session, cron, mkCliente, mkCompita, mkVisita, tgText, tgBtn, tgPara, emailsA } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { PUT as fecha } from '@/app/api/visita/fecha/route'
import { POST as reagendar } from '@/app/api/visita/reagendar/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as escalera } from '@/app/api/cron/escalera-avisos/route'
import { escalarCitasSinRespuesta, versionCita } from '@/lib/citas'
import { estadoDelCliente } from '@/lib/estado-cliente'
import { situacionDelCompita } from '@/lib/que-me-toca'
import { limpiarCacheAjustes } from '@/lib/ajustes'

const CHAT = '9959'
beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const dia = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10)
const mundo = (o: any = {}) => {
  const cliente = mkCliente({ nombre: 'Carolina Rojas', email: 'caro@mail.test' }); const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez', ...o })
  Object.assign(cliente, { compita_id: compita.id }); const v = mkVisita(cliente, compita, { estado: 'pre_visita', fecha_programada: null })
  session.user = { id: cliente.id, email: cliente.email } as any
  return { cliente, compita, v }
}
const proponer = (v: any, d = 3, ini = '09:00', fin = '10:00') => fecha(req('/api/visita/fecha', { method: 'PUT', json: { visita_id: v.id, fecha_programada: dia(d), hora_inicio: ini, hora_fin: fin } }))
const fila = (id: string) => db.rows('visitas').find((x) => x.id === id)!
const botones = (m: any) => (m?.markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data)
const ver = (v: any) => versionCita(fila(v.id).cita_propuesta_en)
const eventos = (t: string) => db.rows('eventos').filter((e) => e.tipo === t)

describe('el cliente propone', () => {
  test('la visita NO queda programada: la propuesta se guarda aparte y se le pide al compita que confirme', async () => {
    const { v } = mundo(); const r = await proponer(v); assert.equal(r.status, 200); assert.equal((await r.json()).data.estado, 'pendiente_confirmacion')
    const f = fila(v.id); assert.equal(f.estado, 'pre_visita'); assert.equal(f.fecha_programada ?? null, null); assert.equal(f.cita_propuesta_fecha, dia(3)); assert.equal(f.cita_propuesta_inicio, '09:00')
    const m = tgPara(CHAT).at(-1)!; assert.match(m.text, /Carolina Rojas eligió el horario de la visita/); assert.match(m.text, /hora de Caracas/)
    assert.deepEqual(botones(m), [`cita:ok:${v.id}:${ver(v)}`, `cita:no:${v.id}:${ver(v)}`])
    assert.equal(eventos('cita_propuesta').length, 1)
  })
  test('el cliente recibe un correo que dice a quién se le pidió y qué sigue', async () => {
    const { v } = mundo(); await proponer(v)
    const c = emailsA('caro@mail.test').find((e) => /confirme tu visita/.test(e.subject))!; assert.ok(c); assert.match(c.html, /María P\./); assert.match(c.html, /te ofrecemos elegir otra sin costo/)
    assert.doesNotMatch(c.html, /\+58|@mail|Telegram/i, 'sin contactos del compita')
  })
  test('el portal del cliente lo muestra como "esperando que confirme", y "¿Qué me toca?" del compita lo pone como lo que le toca', async () => {
    const { cliente, compita, v } = mundo(); await proponer(v)
    assert.equal((await estadoDelCliente(cliente.id)).codigo, 'cita_pendiente')
    const s = await situacionDelCompita(compita.id, new Date(), CHAT); assert.ok(s.codigosTurno.includes('cita_por_confirmar')); assert.equal(s.noReconocido, false)
    assert.deepEqual((s.teclado?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data).filter((d: string) => d?.startsWith('cita:')), [`cita:ok:${v.id}:${ver(v)}`, `cita:no:${v.id}:${ver(v)}`])
  })
  test('proponer de nuevo reemplaza la propuesta y el botón VIEJO ya no sirve (nadie confirma a ciegas)', async () => {
    const { v } = mundo(); await proponer(v, 3); const vieja = ver(v); await new Promise((r) => setTimeout(r, 1100)); await proponer(v, 5, '14:00', '15:00')
    assert.notEqual(ver(v), vieja); assert.equal(fila(v.id).cita_propuesta_inicio, '14:00')
    net.tg.length = 0; await webhook(tgBtn(CHAT, `cita:ok:${v.id}:${vieja}`)); assert.match(tgPara(CHAT).at(-1)!.text, /ya cambió/); assert.equal(fila(v.id).estado, 'pre_visita')
    await webhook(tgBtn(CHAT, `cita:ok:${v.id}:${ver(v)}`)); assert.equal(fila(v.id).estado, 'programada'); assert.equal(fila(v.id).hora_inicio_programada, '14:00')
  })
  test('un botón "No puedo" VIEJO tampoco borra una propuesta nueva', async () => {
    const { v } = mundo(); await proponer(v, 3); const vieja = ver(v); await new Promise((r) => setTimeout(r, 1100)); await proponer(v, 5, '14:00', '15:00')
    net.emails.length = 0; await webhook(tgBtn(CHAT, `cita:no:${v.id}:${vieja}`))
    assert.ok(fila(v.id).cita_propuesta_en, 'la propuesta nueva sigue en pie'); assert.equal(fila(v.id).cita_propuesta_inicio, '14:00'); assert.equal(emailsA('caro@mail.test').filter((e) => /no puede a esa hora/.test(e.subject)).length, 0)
  })
  test('una visita ya programada conserva su fecha hasta que se confirme la nueva; si la rechazan, queda la anterior', async () => {
    const { v } = mundo(); Object.assign(fila(v.id), { estado: 'programada', fecha_programada: dia(2), hora_inicio_programada: '08:00', hora_fin_programada: '09:00' })
    await proponer(v, 6, '16:00', '17:00'); assert.equal(fila(v.id).fecha_programada, dia(2)); assert.equal(fila(v.id).hora_inicio_programada, '08:00')
    await webhook(tgBtn(CHAT, `cita:no:${v.id}:${ver(v)}`)); assert.equal(fila(v.id).fecha_programada, dia(2)); assert.equal(fila(v.id).cita_propuesta_en ?? null, null)
  })
})

describe('el compita responde', () => {
  test('CONFIRMO: la visita queda programada con esa fecha y hora, se limpia la propuesta y se avisa a los dos', async () => {
    const { v } = mundo(); await proponer(v); net.tg.length = 0; net.emails.length = 0
    await webhook(tgBtn(CHAT, `cita:ok:${v.id}:${ver(v)}`))
    const f = fila(v.id); assert.equal(f.estado, 'programada'); assert.equal(f.fecha_programada, dia(3)); assert.equal(f.hora_inicio_programada, '09:00'); assert.equal(f.hora_fin_programada, '10:00'); assert.equal(f.cita_propuesta_en ?? null, null)
    assert.ok(tgPara(CHAT).some((m) => /Cita confirmada/.test(m.text))); assert.ok(tgPara(CHAT).some((m) => /Visita confirmada/.test(m.text)))
    assert.ok(emailsA('caro@mail.test').some((e) => /Visita confirmada/.test(e.subject))); assert.equal(eventos('cita_confirmada').length, 1)
  })
  test('NO PUEDO: la propuesta se borra, la visita sigue igual y el cliente recibe el correo para elegir otra hora', async () => {
    const { cliente, v } = mundo(); await proponer(v); net.emails.length = 0
    await webhook(tgBtn(CHAT, `cita:no:${v.id}:${ver(v)}`))
    assert.equal(fila(v.id).estado, 'pre_visita'); assert.equal(fila(v.id).cita_propuesta_en ?? null, null); assert.equal(eventos('cita_rechazada').length, 1)
    const c = emailsA('caro@mail.test').find((e) => /no puede a esa hora/.test(e.subject))!; assert.ok(c); assert.match(c.html, /no se descuenta de tu plan/)
    assert.equal((await estadoDelCliente(cliente.id)).codigo, 'agendar_visita')
  })
  test('un doble toque en "Confirmo" no duplica nada', async () => {
    const { v } = mundo(); await proponer(v); const ver1 = ver(v)
    await webhook(tgBtn(CHAT, `cita:ok:${v.id}:${ver1}`)); net.emails.length = 0; net.tg.length = 0
    await webhook(tgBtn(CHAT, `cita:ok:${v.id}:${ver1}`)); assert.match(tgPara(CHAT).at(-1)!.text, /ya no está pendiente/); assert.equal(emailsA('caro@mail.test').length, 0); assert.equal(eventos('cita_confirmada').length, 1)
  })
  test('si ya tiene otra visita a esa hora no se puede confirmar, y se le dice qué hacer', async () => {
    const { compita, v } = mundo(); const otro = mkCliente({ email: 'otro@mail.test' })
    await proponer(v)
    // mientras ella no respondía, otro cliente tomó una hora que se cruza (al proponer no había choque)
    mkVisita(otro, compita, { estado: 'programada', fecha_programada: dia(3), hora_inicio_programada: '09:30', hora_fin_programada: '10:30' }); net.tg.length = 0; await webhook(tgBtn(CHAT, `cita:ok:${v.id}:${ver(v)}`))
    assert.match(tgPara(CHAT).at(-1)!.text, /otra visita a esa hora/); assert.equal(fila(v.id).estado, 'pre_visita')
  })
  test('otro compita NO puede confirmar ni rechazar una propuesta ajena', async () => {
    const { v } = mundo(); await proponer(v); const intruso = mkCompita({ telegram_chat_id: '9960' }); const x = ver(v)
    await webhook(tgBtn('9960', `cita:ok:${v.id}:${x}`)); await webhook(tgBtn('9960', `cita:no:${v.id}:${x}`))
    assert.equal(fila(v.id).estado, 'pre_visita'); assert.ok(fila(v.id).cita_propuesta_en); assert.match(tgPara('9960').at(-1)!.text, /ya no está pendiente/)
  })
  test('botones mal formados o inventados no hacen nada ni rompen el bot', async () => {
    const { v } = mundo(); await proponer(v)
    for (const d of ['cita:ok', 'cita:xx:' + v.id + ':abc', 'cita:ok:no-es-un-id:abc', 'cita:ok:' + v.id]) await webhook(tgBtn(CHAT, d))
    assert.equal(fila(v.id).estado, 'pre_visita'); assert.ok(fila(v.id).cita_propuesta_en)
  })
})

describe('si no se puede avisar al compita (Telegram es requisito en Compaz)', () => {
  test('sin vínculo de Telegram la visita NO se agenda a ciegas: el cliente ve un error claro y el equipo una tarea', async () => {
    const { v } = mundo({ telegram_chat_id: null }); const r = await proponer(v); assert.equal(r.status, 502); assert.match((await r.json()).error, /No pudimos avisarle a tu compita/)
    const f = fila(v.id); assert.equal(f.estado, 'pre_visita'); assert.equal(f.cita_propuesta_en ?? null, null); assert.equal(f.fecha_programada ?? null, null)
    assert.ok(db.rows('admin_flags').some((t) => t.tipo === 'cita_sin_telegram' && /NO se agendó/.test(t.nota)))
  })
  test('si Telegram falla al entregar (bot bloqueado), tampoco queda una propuesta que nadie vio', async () => {
    const { v } = mundo(); net.tgFailFor.add(CHAT); const r = await proponer(v); assert.equal(r.status, 502)
    assert.equal(fila(v.id).cita_propuesta_en ?? null, null); assert.equal(fila(v.id).estado, 'pre_visita'); assert.equal(eventos('cita_propuesta').length, 0)
    assert.equal(emailsA('caro@mail.test').filter((e) => /confirme tu visita/.test(e.subject)).length, 0, 'no se le promete al cliente algo que no se pidió')
  })
  test('al arreglarse el vínculo, reintentar funciona', async () => {
    const { v } = mundo(); net.tgFailFor.add(CHAT); await proponer(v); net.tgFailFor.delete(CHAT)
    const r = await proponer(v); assert.equal(r.status, 200); assert.equal((await r.json()).data.estado, 'pendiente_confirmacion')
  })
  test('reagendar descarta la propuesta pendiente', async () => {
    const { v } = mundo(); await proponer(v); const r = await reagendar(req('/api/visita/reagendar', { json: { visita_id: v.id } })); assert.equal(r.status, 200)
    assert.equal(fila(v.id).cita_propuesta_en ?? null, null)
  })
})

describe('si el compita no responde (la escalera)', () => {
  const ahora = () => new Date(Date.now())
  const horas = (h: number) => new Date(Date.now() + h * 3600_000)
  test('antes de 6 horas no pasa nada; a las 6 se le recuerda UNA vez con los botones', async () => {
    const { v } = mundo(); await proponer(v, 5); net.tg.length = 0
    assert.deepEqual(await escalarCitasSinRespuesta(horas(5)), { recordadas: 0, escaladas: 0 })
    assert.deepEqual(await escalarCitasSinRespuesta(horas(7)), { recordadas: 1, escaladas: 0 }); assert.match(tgPara(CHAT).at(-1)!.text, /Falta tu respuesta/); assert.deepEqual(botones(tgPara(CHAT).at(-1)), [`cita:ok:${v.id}:${ver(v)}`, `cita:no:${v.id}:${ver(v)}`])
    net.tg.length = 0; assert.deepEqual(await escalarCitasSinRespuesta(horas(8)), { recordadas: 0, escaladas: 0 }); assert.equal(tgPara(CHAT).length, 0, 'no se repite')
  })
  test('a las 24 horas: UNA tarea para el equipo y un correo al cliente, sin repetirse', async () => {
    const { v } = mundo(); await proponer(v, 5); net.emails.length = 0
    assert.deepEqual(await escalarCitasSinRespuesta(horas(25)), { recordadas: 0, escaladas: 1 }); await escalarCitasSinRespuesta(horas(30))
    assert.equal(db.rows('admin_flags').filter((f) => f.tipo === 'cita_sin_confirmar').length, 1); assert.match(db.rows('admin_flags').find((f) => f.tipo === 'cita_sin_confirmar')!.nota, /no confirma la cita/)
    assert.equal(emailsA('caro@mail.test').filter((e) => /Seguimos esperando/.test(e.subject)).length, 1)
  })
  test('si la hora propuesta está a menos de 12 horas, se escala de inmediato sin esperar las 24', async () => {
    const { v } = mundo(); await proponer(v, 5)
    // la propuesta es para dentro de 3 horas (hora de Caracas): ya no hay tiempo de esperar
    const en3h = new Date(Date.now() + 3 * 3600_000 - 4 * 3600_000).toISOString()
    Object.assign(fila(v.id), { cita_propuesta_fecha: en3h.slice(0, 10), cita_propuesta_inicio: en3h.slice(11, 16), cita_propuesta_fin: '23:59' })
    assert.equal((await escalarCitasSinRespuesta(ahora())).escaladas, 1)
  })
  test('con la hora lejana y poco tiempo de espera NO se escala todavía', async () => {
    const { v } = mundo(); await proponer(v, 5); assert.equal((await escalarCitasSinRespuesta(horas(2))).escaladas, 0)
  })
  test('una propuesta ya confirmada o rechazada no se recuerda ni se escala', async () => {
    const { v } = mundo(); await proponer(v, 5); await webhook(tgBtn(CHAT, `cita:no:${v.id}:${ver(v)}`)); net.tg.length = 0
    assert.deepEqual(await escalarCitasSinRespuesta(horas(40)), { recordadas: 0, escaladas: 0 })
  })
  test('la escalera real (cron) la ejecuta y lo informa', async () => {
    const { v } = mundo(); await proponer(v, 5); Object.assign(fila(v.id), { cita_propuesta_en: new Date(Date.now() - 7 * 3600_000).toISOString() })
    const r = await escalera(cron('escalera-avisos') as any); assert.equal(r.status, 200); const d = (await r.json()).data; assert.equal(d.citas.recordadas, 1)
  })
})
