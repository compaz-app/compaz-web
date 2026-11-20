/* eslint-disable */
// Entrega 1 del cambio «las horas se acuerdan solo con las horas libres»: el compita nunca escribe horas en texto libre; si necesita otras horas, cambia las de su
// perfil (comando /horas o botón «Cambiar mis horas») y los clientes que lo esperaban se enteran.
import { db, net, limpiar, req, tgText, tgBtn, tgPara, ultimoTg, emailsA, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { horasNuevas, avisarHorasNuevas } from '@/lib/horas-nuevas'

beforeEach(limpiar)
const hace = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const franja = (dia: string, inicio: string, fin: string) => ({ dia, inicio, fin })
const TODOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

describe('cambiar mis horas desde Telegram', () => {
  test('/horas y el botón dan el enlace de un solo uso que baja a la sección de horas', async () => {
    mkCompita({ telegram_chat_id: '700', nombre: 'Lucía Pérez' })
    await webhook(tgText(700, '/horas'))
    assert.match(ultimoTg(700)!.text, /Cambia tus horas libres/); assert.match(ultimoTg(700)!.text, /compita\/perfil\?token=[^&]+&foco=horarios/)
    net.tg = []
    await webhook(tgBtn(700, 'mis_horas'))
    assert.match(ultimoTg(700)!.text, /foco=horarios/)
    net.tg = []
    await webhook(tgText(700, '/perfil'))
    assert.doesNotMatch(ultimoTg(700)!.text, /foco=horarios/, '/perfil sigue siendo el perfil completo')
  })
  test('al decir «No puedo a esa hora» el mensaje trae el botón «Cambiar mis horas»', () => {
    const w = readFileSync('app/api/telegram-webhook/route.ts', 'utf8')
    assert.match(w, /Esa hora quedó libre[\s\S]{0,260}callback_data: 'mis_horas'/)
  })
  test('la pantalla de perfil baja sola a la sección de horas', () => {
    assert.match(readFileSync('app/compita/perfil/EditarPerfil.tsx', 'utf8'), /foco === 'horarios'\) horariosRef\.current\?\.scrollIntoView/)
    assert.match(readFileSync('app/compita/perfil/page.tsx', 'utf8'), /foco=\{foco\}/)
  })
})

describe('los clientes que esperaban se enteran', () => {
  test('las horas nuevas: solo las que antes no había', () => {
    const ahora = new Date('2026-12-01T15:00:00.000Z')
    const antes = TODOS.map((d) => franja(d, '08:00', '09:00'))
    assert.equal(horasNuevas(antes, antes, ahora).length, 0)
    assert.ok(horasNuevas(antes, [...antes, ...TODOS.map((d) => franja(d, '15:00', '16:00'))], ahora).length > 0)
    assert.equal(horasNuevas(antes, antes.slice(0, 3), ahora).length, 0, 'quitar horas no es avisar')
    assert.ok(horasNuevas([], antes, ahora).length > 0)
  })
  test('avisa (campana y correo) a quien espera elegir hora; no a quien ya tiene hora ni a solicitudes de otro tipo; una vez por cambio', async () => {
    const lucia = mkCompita({ telegram_chat_id: '710', nombre: 'Lucía Pérez' })
    const espera = mkCliente({ email: 'espera@mail.test' }); const conHora = mkCliente({ email: 'hora@mail.test' }); const directa = mkCliente({ email: 'directa@mail.test' })
    const s1 = mkSolicitud(espera, lucia, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [], slot_confirmado: null })
    mkSolicitud(conHora, lucia, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [], slot_confirmado: hace(-60) })
    mkSolicitud(directa, lucia, { estado: 'aceptada', tipo: 'directa', slots_propuestos: [], slot_confirmado: null })
    const despues = TODOS.map((d) => franja(d, '15:00', '17:00'))
    assert.equal(await avisarHorasNuevas(lucia.id, [], despues), 1)
    assert.equal(db.rows('novedades_cliente').filter((n) => n.tipo === 'horas_actualizadas' && n.usuario_id === espera.id).length, 1)
    const m = emailsA('espera@mail.test').find((e) => /actualizó sus horas/.test(e.subject))!
    assert.ok(m); assert.match(m.html, new RegExp(`/solicitar/hora\\?solicitud=${s1.id}`))
    assert.equal(emailsA('hora@mail.test').length + emailsA('directa@mail.test').length, 0)
    await avisarHorasNuevas(lucia.id, [], despues) // el mismo cambio no avisa dos veces
    assert.equal(db.rows('novedades_cliente').filter((n) => n.tipo === 'horas_actualizadas').length, 1)
  })
  test('guardar el perfil con horas nuevas dispara el aviso', () => {
    const r = readFileSync('app/api/compita/perfil/route.ts', 'utf8')
    assert.match(r, /horariosDe\(compitaId\)/); assert.match(r, /avisarHorasNuevas\(compitaId, horariosAntes/)
  })
})

describe('el compita ya no escribe horas', () => {
  test('rechazar una solicitud no abre ningún «escribe tus horarios» ni en Telegram ni por el enlace web', () => {
    for (const f of ['app/api/telegram-webhook/route.ts', 'app/api/solicitud/responder/route.ts']) {
      const s = readFileSync(f, 'utf8')
      assert.doesNotMatch(s, /Puedes sugerir otros horarios/, f)
    }
    assert.doesNotMatch(readFileSync('app/api/solicitud/reagendar-compita/route.ts', 'utf8'), /sugerir_r:|iniciarReagendadoPorCompita\(/)
  })
})
