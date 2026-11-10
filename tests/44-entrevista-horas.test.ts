/* eslint-disable */
// Lote 3 (tramo 2): "Hablar primero" con horas libres. Pedir → el compita acepta → el cliente elige una hora libre →
// queda reservada → el compita confirma o dice "No puedo a esa hora" → si no responde, se libera y se avisa.
import { db, net, limpiar, req, session, mkCliente, mkCompita, tgBtn, tgPara, emailsA, cron } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as solicitar } from '@/app/api/solicitudes/route'
import { GET as horasGet, POST as horaPost } from '@/app/api/solicitudes/hora/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as cronEscalera } from '@/app/api/cron/escalera-avisos/route'
import { POST as cronRecordatorios } from '@/app/api/cron/recordatorios/route'
import { POST as reagendarCompita } from '@/app/api/solicitud/reagendar-compita/route'
import { POST as reagendarCliente } from '@/app/api/solicitud/reagendar-cliente/route'
import { GET as infoReagendar } from '@/app/api/solicitud/info-reagendar/route'
import { qRol } from '@/lib/links'
import { limpiarCacheAjustes } from '@/lib/ajustes'

beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
const CHAT = '9900'

// Franjas amplias todos los días para que siempre haya horas libres sin importar cuándo corra la prueba.
const todasLasFranjas = DIAS.map((dia) => ({ dia, inicio: '08:00', fin: '20:00' }))
function mundo(o: any = {}) {
  const compita = mkCompita({ telegram_chat_id: CHAT, horarios_disponibles: todasLasFranjas, ...o })
  const cliente = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test' })
  return { compita, cliente }
}
async function pedirYAceptar(compita: any, cliente: any) {
  como(cliente)
  const r = await solicitar(req('/api/solicitudes', { json: { compita_id: compita.id, tipo: 'entrevista', que: 'Compañía y conversación', lugar_privado: false } }))
  assert.equal(r.status, 200)
  const sol = db.rows('solicitudes').find((s) => s.cliente_id === cliente.id)!
  await webhook(tgBtn(CHAT, `directa:${sol.token_respuesta}`))
  return sol
}
const libres = async (cliente: any, sol: any) => { como(cliente); const r = await horasGet(req(`/api/solicitudes/hora?solicitud=${sol.id}`)); return { status: r.status, horas: (await r.json()).data?.horas ?? [] } }
const elegir = (cliente: any, sol: any, inicio: string, zona?: string) => { como(cliente); return horaPost(req('/api/solicitudes/hora', { json: { solicitud_id: sol.id, inicio, zona } })) }
const botones = (m: any) => (m?.markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data)

describe('el compita acepta hablar primero', () => {
  test('el aviso no trae horarios; al aceptar, el cliente recibe el correo para elegir la hora y no se le pide pagar', async () => {
    const { compita, cliente } = mundo()
    const sol = await pedirYAceptar(compita, cliente)
    assert.equal(db.rows('solicitudes').find((s) => s.id === sol.id)!.estado, 'aceptada')
    const correo = emailsA('caro@mail.test').find((e) => /Elige la hora/.test(e.subject))!
    assert.ok(correo, 'correo de elegir hora')
    assert.match(correo.html, new RegExp(`/solicitar/hora\\?solicitud=${sol.id}`))
    assert.ok(!/pago/i.test(correo.html.replace(/Compaz nunca/g, '')), 'no habla de pagar')
    assert.match(tgPara(CHAT).at(-1)!.text, /Aceptaste hablar/)
  })
})

describe('el cliente elige una hora libre', () => {
  test('ve solo horas libres y puede reservar una; el compita recibe los dos botones', async () => {
    const { compita, cliente } = mundo(); const sol = await pedirYAceptar(compita, cliente)
    const l = await libres(cliente, sol)
    assert.equal(l.status, 200); assert.ok(l.horas.length > 20)
    const hora = l.horas[3]
    const r = await elegir(cliente, sol, hora.inicio, 'America/New_York')
    assert.equal(r.status, 200)
    const reserva = db.rows('reservas_horario')[0]
    assert.equal(reserva.estado, 'reservada'); assert.equal(reserva.inicio, hora.inicio); assert.equal(reserva.solicitud_id, sol.id)
    const m = tgPara(CHAT).at(-1)!
    assert.deepEqual(botones(m), [`reserva:ok:${reserva.id}`, `reserva:no:${reserva.id}`])
    assert.match(m.text, /eligió una hora/)
    assert.equal(db.rows('usuarios').find((u) => u.id === cliente.id)!.zona_horaria, 'America/New_York', 'guarda su zona')
    assert.ok(!(await libres(cliente, sol)).horas.some((h: any) => h.inicio === hora.inicio), 'esa hora ya no aparece libre')
  })

  test('las horas llegan con la hora local y la de Caracas cuando tiene zona', async () => {
    const { compita, cliente } = mundo(); const sol = await pedirYAceptar(compita, cliente)
    db.rows('usuarios').find((u) => u.id === cliente.id)!.zona_horaria = 'Europe/Madrid'
    const h = (await libres(cliente, sol)).horas[0]
    assert.ok(h.local && h.local.zona === 'Europe/Madrid'); assert.match(h.texto, /tu hora \(Madrid\)/)
  })

  test('cambiar de hora suelta la anterior', async () => {
    const { compita, cliente } = mundo(); const sol = await pedirYAceptar(compita, cliente)
    const hs = (await libres(cliente, sol)).horas
    await elegir(cliente, sol, hs[2].inicio)
    assert.equal((await elegir(cliente, sol, hs[5].inicio)).status, 200)
    const vivas = db.rows('reservas_horario').filter((r) => r.estado === 'reservada')
    assert.equal(vivas.length, 1); assert.equal(vivas[0].inicio, hs[5].inicio)
    assert.ok((await libres(cliente, sol)).horas.some((h: any) => h.inicio === hs[2].inicio), 'la primera volvió a estar libre')
    // El compita recibe el aviso de CADA hora que el cliente elige (no solo de la primera).
    const pedidos = tgPara(CHAT).filter((m) => /eligió una hora/.test(m.text))
    assert.equal(pedidos.length, 2)
    assert.ok(botones(pedidos[1]).every((b: string) => b.includes(vivas[0].id)), 'los botones del segundo aviso son de la reserva nueva')
  })

  test('si el compita rechaza dos horas seguidas de la misma solicitud, el cliente recibe los dos correos', async () => {
    const { compita, cliente } = mundo(); const sol = await pedirYAceptar(compita, cliente)
    for (const i of [1, 6]) {
      const hora = (await libres(cliente, sol)).horas[i].inicio
      await elegir(cliente, sol, hora)
      await webhook(tgBtn(CHAT, `reserva:no:${db.rows('reservas_horario').find((r) => r.estado === 'reservada')!.id}`))
    }
    assert.equal(emailsA('caro@mail.test').filter((e) => /no puede a esa hora/.test(e.subject)).length, 2)
  })

  test('dos clientes por la misma hora: uno la gana y el otro recibe un aviso claro (409) y puede elegir otra', async () => {
    const { compita, cliente } = mundo(); const otro = mkCliente({ nombre: 'Luis', email: 'luis@mail.test' })
    const sol1 = await pedirYAceptar(compita, cliente); const sol2 = await pedirYAceptar(compita, otro)
    const hora = (await libres(cliente, sol1)).horas[4].inicio
    assert.equal((await elegir(cliente, sol1, hora)).status, 200)
    const r2 = await elegir(otro, sol2, hora)
    assert.equal(r2.status, 409); assert.match((await r2.json()).error, /hora/i)
    assert.equal(db.rows('reservas_horario').filter((r) => r.estado === 'reservada').length, 1)
  })

  test('solo la solicitud propia y solo si ya fue aceptada y sin hora', async () => {
    const { compita, cliente } = mundo(); const sol = await pedirYAceptar(compita, cliente)
    const ajeno = mkCliente({ email: 'ajeno@mail.test' })
    assert.equal((await libres(ajeno, sol)).status, 404)
    assert.equal((await elegir(ajeno, sol, (await libres(cliente, sol)).horas[0].inicio)).status, 404)
    db.rows('solicitudes').find((s) => s.id === sol.id)!.estado = 'pendiente'
    assert.equal((await libres(cliente, sol)).status, 404)
    session.user = null
    assert.equal((await horasGet(req(`/api/solicitudes/hora?solicitud=${sol.id}`))).status, 401)
  })

  test('si no se le puede avisar al compita, la hora no queda reservada en vano', async () => {
    const { compita, cliente } = mundo(); const sol = await pedirYAceptar(compita, cliente)
    net.tgFailFor.add(CHAT)
    const r = await elegir(cliente, sol, (await libres(cliente, sol)).horas[1].inicio)
    assert.equal(r.status, 502)
    assert.equal(db.rows('reservas_horario').filter((x) => x.estado === 'reservada').length, 0)
  })
})

describe('el compita responde a la hora reservada', () => {
  async function conReserva() {
    const { compita, cliente } = mundo(); const sol = await pedirYAceptar(compita, cliente)
    const hora = (await libres(cliente, sol)).horas[2].inicio
    await elegir(cliente, sol, hora)
    return { compita, cliente, sol, hora, reserva: db.rows('reservas_horario')[0] }
  }

  test('confirmar: la solicitud queda con su hora y se anuncia igual que una entrevista de siempre', async () => {
    const { cliente, sol, hora, reserva } = await conReserva()
    await webhook(tgBtn(CHAT, `reserva:ok:${reserva.id}`))
    assert.equal(db.rows('reservas_horario')[0].estado, 'confirmada')
    assert.equal(db.rows('solicitudes').find((s) => s.id === sol.id)!.slot_confirmado, hora)
    assert.ok(emailsA('caro@mail.test').some((e) => /está confirmada/.test(e.subject)), 'correo de llamada confirmada')
    const m = tgPara(CHAT).at(-1)!
    assert.match(m.text, /Llamada confirmada/)
    assert.ok(JSON.stringify(m.markup).includes('reagendar-compita'), 'con su botón de reagendar')
    assert.ok(tgPara('999').some((x) => /Entrevista confirmada/.test(x.text)), 'aviso al administrador')
  })

  test('"No puedo a esa hora": se libera y el cliente recibe el correo para elegir otra', async () => {
    const { sol, hora, reserva } = await conReserva()
    await webhook(tgBtn(CHAT, `reserva:no:${reserva.id}`))
    assert.equal(db.rows('reservas_horario')[0].estado, 'rechazada')
    assert.equal(db.rows('solicitudes').find((s) => s.id === sol.id)!.slot_confirmado ?? null, null)
    const c = emailsA('caro@mail.test').find((e) => /no puede a esa hora/.test(e.subject))!
    assert.ok(c); assert.match(c.html, /Elegir otra hora/)
    const { compita, cliente } = { compita: null, cliente: db.rows('usuarios').find((u) => u.email === 'caro@mail.test')! }
    assert.ok((await libres(cliente, sol)).horas.some((h: any) => h.inicio === hora), 'la hora volvió a estar libre')
  })

  test('otro compita no puede responder, y una reserva solo se responde una vez', async () => {
    const { reserva } = await conReserva()
    const intruso = mkCompita({ telegram_chat_id: '9911' })
    await webhook(tgBtn('9911', `reserva:ok:${reserva.id}`))
    assert.equal(db.rows('reservas_horario')[0].estado, 'reservada')
    await webhook(tgBtn(CHAT, `reserva:ok:${reserva.id}`))
    await webhook(tgBtn(CHAT, `reserva:no:${reserva.id}`))
    assert.equal(db.rows('reservas_horario')[0].estado, 'confirmada')
    assert.match(tgPara(CHAT).at(-1)!.text, /ya fue respondida/)
  })

  test('si no responde a tiempo, el cron libera la hora y le avisa al cliente una sola vez', async () => {
    const { reserva } = await conReserva()
    db.rows('reservas_horario')[0].vence_en = new Date(Date.now() - 1000).toISOString()
    const r = await cronEscalera(cron('/api/cron/escalera-avisos'))
    assert.equal(r.status, 200); assert.equal((await r.json()).data.reservasVencidas, 1)
    assert.equal(db.rows('reservas_horario')[0].estado, 'vencida')
    const avisos = emailsA('caro@mail.test').filter((e) => /se liberó/.test(e.subject))
    assert.equal(avisos.length, 1)
    await cronEscalera(cron('/api/cron/escalera-avisos'))
    assert.equal(emailsA('caro@mail.test').filter((e) => /se liberó/.test(e.subject)).length, 1, 'no se repite')
    await webhook(tgBtn(CHAT, `reserva:ok:${reserva.id}`))
    assert.match(tgPara(CHAT).at(-1)!.text, /ya se liberó|ya fue respondida/, 'confirmar tarde no funciona')
  })
})

describe('de la reserva al enlace de la sala', () => {
  test('una entrevista agendada con el flujo nuevo recibe su enlace de sala 1 hora antes, igual que las de siempre', async () => {
    // Una sola hora libre, dentro de unos 45 minutos (en la ventana del recordatorio).
    const objetivo = Math.ceil((Date.now() + 45 * 60_000) / 1_200_000) * 1_200_000
    const pared = new Date(objetivo - 4 * 3600_000) // reloj de Caracas
    const hh = (n: number) => String(n).padStart(2, '0')
    // Minutos del día en Caracas; el fin puede ser 24:00 (si el bloque llega a medianoche), nunca "00:00".
    const iniMin = pared.getUTCHours() * 60 + pared.getUTCMinutes(); const finMin = iniMin + 20
    const { compita, cliente } = mundo({ horarios_disponibles: [{ dia: DIAS[pared.getUTCDay()], inicio: `${hh(Math.floor(iniMin / 60))}:${hh(iniMin % 60)}`, fin: `${hh(Math.floor(finMin / 60))}:${hh(finMin % 60)}` }] })
    const sol = await pedirYAceptar(compita, cliente)
    const hora = (await libres(cliente, sol)).horas.find((h: any) => h.inicio === new Date(objetivo).toISOString())
    assert.ok(hora, 'la hora de dentro de 45 minutos está libre')
    assert.equal((await elegir(cliente, sol, hora.inicio)).status, 200)
    await webhook(tgBtn(CHAT, `reserva:ok:${db.rows('reservas_horario')[0].id}`))
    const antes = emailsA('caro@mail.test').length

    await cronRecordatorios(cron('r')); await cronRecordatorios(cron('r'))
    const correos = emailsA('caro@mail.test').slice(antes)
    assert.equal(correos.length, 1, 'un solo recordatorio aunque el cron corra dos veces')
    assert.match(correos[0].html, /\/sala\/[^"]+\?quien=cliente&s=[0-9a-f]{24}/)
    assert.equal(net.rooms.length, 1, 'se creó la sala')
    assert.match(tgPara(CHAT).at(-1)!.text, /quien=compita&amp;s=|quien=compita&s=/, 'el compita recibe su enlace')
  })
})

describe('reagendar una entrevista agendada con horas libres', () => {
  async function confirmada() {
    const { compita, cliente } = mundo(); const sol = await pedirYAceptar(compita, cliente)
    const hora = (await libres(cliente, sol)).horas[3].inicio
    await elegir(cliente, sol, hora)
    await webhook(tgBtn(CHAT, `reserva:ok:${db.rows('reservas_horario')[0].id}`))
    const fila = () => db.rows('solicitudes').find((x) => x.id === sol.id)!
    assert.equal(fila().slot_confirmado, hora)
    return { compita, cliente, sol, hora, fila }
  }
  const comoCompita = (token: string) => reagendarCompita(req(`/api/solicitud/reagendar-compita?token=${token}&${qRol(token, 'compita')}`, { method: 'POST' }))

  test('el compita reagenda: la hora se suelta, la solicitud queda sin hora y el cliente recibe el correo para elegir otra', async () => {
    const { cliente, sol, hora, fila } = await confirmada()
    const r = await comoCompita(sol.token_respuesta)
    assert.equal(r.status, 200)
    assert.equal(fila().slot_confirmado ?? null, null); assert.equal(fila().estado, 'aceptada')
    assert.equal(db.rows('reservas_horario')[0].estado, 'liberada')
    assert.ok(emailsA('caro@mail.test').some((e) => /no puede a esa hora/.test(e.subject) && /solicitar\/hora/.test(e.html)))
    assert.ok((await libres(cliente, sol)).horas.some((h: any) => h.inicio === hora), 'la hora soltada volvió a estar libre')
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'entrevista_reagendada'))
    assert.ok(tgPara('999').some((m) => /Entrevista reagendada/.test(m.text)))
  })

  test('el cliente reagenda desde su correo: la página sabe que es el flujo nuevo, suelta la hora y avisa al compita', async () => {
    const { sol, fila } = await confirmada()
    const info = await (await infoReagendar(req(`/api/solicitud/info-reagendar?token=${sol.token_respuesta}`))).json()
    assert.equal(info.data.nuevo_flujo, true); assert.equal(info.data.solicitud_id, sol.id)
    const antes = tgPara(CHAT).length
    const r = await reagendarCliente(req('/api/solicitud/reagendar-cliente', { json: { token: sol.token_respuesta } }))
    assert.equal(r.status, 200); assert.equal((await r.json()).data.solicitud_id, sol.id)
    assert.equal(fila().slot_confirmado ?? null, null)
    assert.equal(db.rows('reservas_horario')[0].estado, 'liberada')
    assert.match(tgPara(CHAT).at(-1)!.text, /pidió cambiar la hora/); assert.equal(tgPara(CHAT).length, antes + 1)
  })

  test('después de reagendar el cliente elige otra hora y el compita la confirma: todo vuelve a funcionar', async () => {
    const { cliente, sol, hora, fila } = await confirmada()
    await reagendarCliente(req('/api/solicitud/reagendar-cliente', { json: { token: sol.token_respuesta } }))
    const nueva = (await libres(cliente, sol)).horas.find((h: any) => h.inicio !== hora).inicio
    assert.equal((await elegir(cliente, sol, nueva)).status, 200)
    const viva = db.rows('reservas_horario').find((r) => r.estado === 'reservada')!
    await webhook(tgBtn(CHAT, `reserva:ok:${viva.id}`))
    assert.equal(fila().slot_confirmado, nueva)
  })

  test('reagendar varias veces: el cliente recibe un correo cada vez (no se toma por repetido)', async () => {
    const { cliente, sol } = await confirmada()
    for (let i = 0; i < 2; i++) {
      await comoCompita(sol.token_respuesta)
      const h = (await libres(cliente, sol)).horas[i + 8].inicio
      await elegir(cliente, sol, h)
      await webhook(tgBtn(CHAT, `reserva:ok:${db.rows('reservas_horario').find((r) => r.estado === 'reservada')!.id}`))
    }
    await comoCompita(sol.token_respuesta)
    assert.equal(emailsA('caro@mail.test').filter((e) => /no puede a esa hora/.test(e.subject)).length, 3)
  })

  test('sin hora todavía no hay nada que soltar: no avisa de más; y una solicitud cerrada no se reagenda', async () => {
    const { compita, cliente } = mundo(); const sol = await pedirYAceptar(compita, cliente) // aceptada, sin hora
    const antes = emailsA('caro@mail.test').length + tgPara(CHAT).length
    await reagendarCliente(req('/api/solicitud/reagendar-cliente', { json: { token: sol.token_respuesta } }))
    assert.equal(emailsA('caro@mail.test').length + tgPara(CHAT).length, antes)
    db.rows('solicitudes').find((x) => x.id === sol.id)!.estado = 'contratada'
    assert.equal((await reagendarCliente(req('/api/solicitud/reagendar-cliente', { json: { token: sol.token_respuesta } }))).status, 409)
  })

  test('una entrevista del contrato anterior no entra por el camino nuevo', async () => {
    const { compita, cliente } = mundo()
    const sol = db.seed('solicitudes', { cliente_id: cliente.id, compita_id: compita.id, mensaje: 'x', estado: 'aceptada', slot_confirmado: new Date(Date.now() + 7200_000).toISOString(), slots_propuestos: [new Date(Date.now() + 7200_000).toISOString()] })
    const info = await (await infoReagendar(req(`/api/solicitud/info-reagendar?token=${sol.token_respuesta}`))).json()
    assert.equal(info.data.nuevo_flujo, false)
    assert.equal((await reagendarCliente(req('/api/solicitud/reagendar-cliente', { json: { token: sol.token_respuesta } }))).status, 409)
    assert.ok(sol.slot_confirmado, 'no se tocó')
  })
})

describe('lo anterior no se rompe', () => {
  test('una entrevista del contrato anterior (con horarios propuestos) no se acepta por el camino sin horario', async () => {
    const { compita, cliente } = mundo()
    como(cliente)
    await solicitar(req('/api/solicitudes', { json: { compita_id: compita.id, mensaje: 'Mi mamá vive sola', slots_propuestos: [new Date(Date.now() + 7200_000).toISOString()] } }))
    const sol = db.rows('solicitudes')[0]
    await webhook(tgBtn(CHAT, `directa:${sol.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].estado, 'pendiente')
  })
})
