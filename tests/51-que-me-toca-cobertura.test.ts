/* eslint-disable */
// Cobertura de "¿Qué me toca?": NINGÚN estado en que pueda quedar un compita lo deja en el aire. Para cada situación
// real, la respuesta existe, no dice "nada pendiente" y le dice claramente si le toca a él o si solo espera.
import { db, limpiar, mkCliente, mkCompita, mkVisita, mkSolicitud, tgText, tgPara } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { situacionDelCompita } from '@/lib/que-me-toca'
import { limpiarCacheAjustes } from '@/lib/ajustes'

const CHAT = '9991'
const HORAS = [{ dia: 'lunes', inicio: '09:00', fin: '10:00' }]
beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const dentro = (min: number) => new Date(Date.now() + min * 60_000).toISOString()
const ve = (min: number) => { const t = new Date(Date.now() + min * 60_000 - 4 * 3600_000).toISOString(); return { fecha: t.slice(0, 10), hora: t.slice(11, 16) } }
function mundo(o: any = {}) {
  const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez', horarios_disponibles: HORAS, ...o }); const cliente = mkCliente({ nombre: 'Carolina Pérez', email: 'caro@mail.test' })
  return { compita, cliente }
}
const visita = (compita: any, cliente: any, min: number, o: any = {}) => { const i = ve(min); return mkVisita(cliente, compita, { estado: 'programada', fecha_programada: i.fecha, hora_inicio_programada: i.hora, hora_fin_programada: ve(min + 120).hora, direccion: 'Av. Miranda', ...o }) }
const estadoBot = (chat: string, accion: string, expira = dentro(20)) => db.seed('telegram_estados', { chat_id: chat, pendiente_accion: accion, pendiente_expira: expira })
// Toda respuesta debe decir si le toca o si solo espera, y qué hacer.
const GUIA = /(Te toca a ti|no tienes nada que hacer|Nada más por ahora|Por ahora no tienes nada|Se confirma sola|Solo espera cerca|hola@micompaz\.com)/i

type Caso = { nombre: string; armar: (m: { compita: any; cliente: any }) => void; esperado: RegExp; botones?: RegExp }
const CASOS: Caso[] = [
  // ── visitas
  { nombre: 'visita en coordinación sin mensajes', armar: ({ compita, cliente }) => { mkVisita(cliente, compita, { estado: 'pre_visita' }) }, esperado: /coordinando la fecha/ },
  { nombre: 'visita en coordinación con un mensaje del cliente sin responder', armar: ({ compita, cliente }) => { const v = mkVisita(cliente, compita, { estado: 'pre_visita' }); db.seed('mensajes', { visit_id: v.id, origen: 'cliente', tipo: 'texto', contenido: 'hola' }) }, esperado: /te escribió por el chat/ },
  { nombre: 'visita programada lejana', armar: ({ compita, cliente }) => { visita(compita, cliente, 3 * 24 * 60) }, esperado: /La dirección te llega 3 horas antes/ },
  { nombre: 'visita programada dentro de las 3 horas con dirección', armar: ({ compita, cliente }) => { visita(compita, cliente, 90) }, esperado: /Ya tienes la dirección/, botones: /camino:/ },
  { nombre: 'visita programada dentro de las 3 horas SIN dirección', armar: ({ compita, cliente }) => { visita(compita, cliente, 90, { direccion: null }) }, esperado: /todavía no registró la dirección/ },
  { nombre: 'visita programada que ya pasó y no se inició', armar: ({ compita, cliente }) => { visita(compita, cliente, -300) }, esperado: /no la iniciaste/ },
  { nombre: 'llegó y falta iniciar', armar: ({ compita, cliente }) => { visita(compita, cliente, -5, { llegada_en: hace(5) }) }, esperado: /¿Te abrieron\?/, botones: /nadie:/ },
  { nombre: 'nadie abre, dentro de la espera', armar: ({ compita, cliente }) => { visita(compita, cliente, -15, { llegada_en: hace(15), sin_acceso_en: hace(10) }) }, esperado: /espera de hasta 30 minutos/ },
  { nombre: 'nadie abre, ya pasaron los 30 minutos', armar: ({ compita, cliente }) => { visita(compita, cliente, -45, { llegada_en: hace(45), sin_acceso_en: hace(35) }) }, esperado: /Puedes cerrar la visita/, botones: /sinacceso:/ },
  { nombre: 'confirmando inicio', armar: ({ compita, cliente }) => { visita(compita, cliente, -3, { estado: 'confirmando_inicio' }) }, esperado: /confirme que llegaste/ },
  { nombre: 'visita en curso', armar: ({ compita, cliente }) => { visita(compita, cliente, -30, { estado: 'en_curso', hora_fin_programada: ve(60).hora, fecha_programada: ve(60).fecha }) }, esperado: /Estás en una visita/ },
  { nombre: 'visita en curso pasada la hora de fin', armar: ({ compita, cliente }) => { visita(compita, cliente, -150, { estado: 'en_curso', fecha_programada: ve(-30).fecha, hora_fin_programada: ve(-30).hora }) }, esperado: /pasó la hora de fin/, botones: /tb:ok:/ },
  { nombre: 'cambio de quién estará pendiente', armar: ({ compita, cliente }) => { const v = visita(compita, cliente, 3 * 24 * 60); db.seed('cambios_lugar', { visita_id: v.id, compita_id: compita.id, cliente_id: cliente.id, despues: [], estado: 'pendiente', vence_en: dentro(60) }) }, esperado: /cambió quién estará/, botones: /lugar:ok:/ },
  // ── solicitudes y reservas
  { nombre: 'solicitud directa por responder', armar: ({ compita, cliente }) => { mkSolicitud(cliente, compita, { tipo: 'directa', slots_propuestos: [] }) }, esperado: /quiere contratarte directamente/, botones: /directa:/ },
  { nombre: 'mandado por responder', armar: ({ compita, cliente }) => { mkSolicitud(cliente, compita, { tipo: 'mandado', slots_propuestos: [] }) }, esperado: /te pide un mandado/, botones: /directa:/ },
  { nombre: 'entrevista nueva por responder', armar: ({ compita, cliente }) => { mkSolicitud(cliente, compita, { tipo: 'entrevista', slots_propuestos: [] }) }, esperado: /quiere conocerte/, botones: /directa:/ },
  { nombre: 'entrevista antigua (con horarios) por responder', armar: ({ compita, cliente }) => { mkSolicitud(cliente, compita, { slots_propuestos: [dentro(180), dentro(300)] }) }, esperado: /quiere conocerte/, botones: /slot:/ },
  { nombre: 'hora reservada por confirmar', armar: ({ compita, cliente }) => { db.seed('reservas_horario', { compita_id: compita.id, cliente_id: cliente.id, inicio: dentro(2000), fin: dentro(2020), estado: 'reservada', vence_en: dentro(60) }) }, esperado: /falta que la confirmes/, botones: /reserva:ok:/ },
  { nombre: 'entrevista aceptada, el cliente aún no elige hora', armar: ({ compita, cliente }) => { mkSolicitud(cliente, compita, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [] }) }, esperado: /eligiendo una de tus horas libres/ },
  { nombre: 'videollamada confirmada para más tarde', armar: ({ compita, cliente }) => { mkSolicitud(cliente, compita, { estado: 'aceptada', slot_confirmado: dentro(300) }) }, esperado: /Tienes una videollamada/ },
  { nombre: 'videollamada que ya pasó sin que diga cómo estuvo', armar: ({ compita, cliente }) => { mkSolicitud(cliente, compita, { estado: 'aceptada', slot_confirmado: hace(90) }) }, esperado: /Cuéntanos cómo estuvo/ },
  { nombre: 'directa aceptada, esperando el pago', armar: ({ compita, cliente }) => { mkSolicitud(cliente, compita, { estado: 'aceptada', tipo: 'directa', slots_propuestos: [] }) }, esperado: /Esperamos su pago/ },
  { nombre: 'mandado aceptado, esperando el pago', armar: ({ compita, cliente }) => { mkSolicitud(cliente, compita, { estado: 'aceptada', tipo: 'mandado', slots_propuestos: [] }) }, esperado: /Esperamos su pago/ },
  // ── a medias en el bot
  { nombre: 'cuestionario de la visita a medias (pregunta 2)', armar: () => { estadoBot(CHAT, 'reporte:vvv:1:4') }, esperado: /pregunta 2 de 4/, botones: /reanudar_reporte/ },
  { nombre: 'cuestionario pausado', armar: () => { estadoBot(CHAT, 'reporte_r:vvv:2:4,5') }, esperado: /pregunta 3 de 4/, botones: /reanudar_reporte/ },
  { nombre: 'falta la novedad del cuestionario', armar: () => { estadoBot(CHAT, 'reporte_novedad:vvv:4,5,3,4') }, esperado: /último paso/, botones: /rn:skip/ },
  { nombre: 'horarios alternativos por escribir', armar: () => { estadoBot(CHAT, 'sugerir_horarios:sss:caro@mail.test:Carolina') }, esperado: /escribiendo los días y horas|escribiendo los días/ },
  { nombre: 'horarios alternativos por escribir (pausado)', armar: () => { estadoBot(CHAT, 'sugerir_r:sss:caro@mail.test:Carolina') }, esperado: /los días y horas que sí te funcionan/ },
  { nombre: 'esperando la foto de llegada', armar: () => { estadoBot(`lleg:${CHAT}`, 'llegada:vvv') }, esperado: /Falta la foto de tu llegada/ },
  { nombre: 'confirmar iniciar pendiente', armar: () => { estadoBot(`conf:${CHAT}`, 'iniciar:vvv') }, esperado: /confirmar que vas a empezar/, botones: /Sí, iniciar/ },
  { nombre: 'confirmar terminar pendiente', armar: () => { estadoBot(`conf:${CHAT}`, 'terminar:vvv') }, esperado: /confirmar que terminaste/, botones: /Sí, terminar/ },
  // ── cuenta
  { nombre: 'en pausa por cancelaciones tardías', armar: ({ compita, cliente }) => { for (let i = 0; i < 3; i++) db.seed('cancelaciones', { compita_id: compita.id, usuario_id: cliente.id, cancelado_por: 'compita', tardia: true, justificada: false, creado_en: hace(60) }) }, esperado: /en pausa/ },
]

describe('cada situación tiene respuesta y guía', () => {
  for (const c of CASOS) {
    test(c.nombre, async () => {
      const m = mundo(); c.armar(m)
      const s = await situacionDelCompita(m.compita.id, new Date(), CHAT)
      assert.equal(s.hayAlgo, true, 'NO debe decir que no hay nada')
      assert.ok(!/Nada pendiente/.test(s.texto))
      assert.match(s.texto, c.esperado)
      assert.match(s.texto, GUIA, 'debe decir si le toca a él o si solo espera')
      assert.ok(s.texto.length < 3500, 'cabe en un mensaje de Telegram')
      assert.ok(s.codigos.length > 0 && !s.codigos.includes('otro'), `cada situación tiene su código estable (${s.codigos})`)
      if (c.botones) assert.match(JSON.stringify(s.teclado), c.botones)
    })
  }
})

describe('sin horas libres y sin nada más', () => {
  test('le dice que cargue sus horas (no "nada pendiente")', async () => {
    const m = mundo({ horarios_disponibles: [] }); const s = await situacionDelCompita(m.compita.id, new Date(), CHAT)
    assert.equal(s.hayAlgo, true); assert.match(s.texto, /Todavía no cargaste tus horas libres/); assert.match(s.texto, /\/perfil/)
  })
  test('cuando de verdad no hay nada: lo dice, y además le da algo que hacer (perfil al día) y cómo pedir ayuda', async () => {
    const m = mundo(); const s = await situacionDelCompita(m.compita.id, new Date(), CHAT)
    assert.equal(s.hayAlgo, false); assert.match(s.texto, /Nada pendiente/); assert.match(s.texto, /\/perfil/); assert.match(s.texto, /hola@micompaz\.com/)
  })
})

describe('un estado que nadie previó NO se queda callado', () => {
  test('una visita programada sin fecha (dato roto): guía general y cómo pedir ayuda, nunca "nada pendiente"', async () => {
    const m = mundo(); mkVisita(m.cliente, m.compita, { estado: 'programada', fecha_programada: null })
    const s = await situacionDelCompita(m.compita.id, new Date(), CHAT)
    assert.equal(s.hayAlgo, true); assert.ok(!/Nada pendiente/.test(s.texto)); assert.match(s.texto, /hola@micompaz\.com/)
  })
})

describe('lo vencido ya no cuenta', () => {
  test('un paso a medias que expiró no se muestra (el bot ya no lo espera)', async () => {
    const m = mundo(); estadoBot(CHAT, 'reporte:vvv:1:4', hace(5))
    assert.match((await situacionDelCompita(m.compita.id, new Date(), CHAT)).texto, /Nada pendiente/)
  })
  test('una hora reservada vencida tampoco', async () => {
    const m = mundo(); db.seed('reservas_horario', { compita_id: m.compita.id, cliente_id: m.cliente.id, inicio: dentro(2000), fin: dentro(2020), estado: 'reservada', vence_en: hace(10) })
    assert.match((await situacionDelCompita(m.compita.id, new Date(), CHAT)).texto, /Nada pendiente/)
  })
  test('los pasos a medias de otro chat no se mezclan', async () => {
    const m = mundo(); estadoBot('555000', 'reporte:vvv:1:4')
    assert.match((await situacionDelCompita(m.compita.id, new Date(), CHAT)).texto, /Nada pendiente/)
  })
})

describe('por el bot, ninguna cuenta se queda sin respuesta', () => {
  const tocar = async (chat: string) => { const antes = tgPara(chat).length; await webhook(tgText(chat, '❓ ¿Qué me toca?')); return tgPara(chat).slice(antes) }
  test('compita activa: responde', async () => { mundo(); assert.ok((await tocar(CHAT)).length >= 1) })
  test('cuenta en revisión (sin verificar): le dice qué pasa y qué hacer', async () => {
    mundo({ verificado: false }); const r = await tocar(CHAT)
    assert.ok(r.length >= 1); assert.match(r[0].text, /en revisión/); assert.match(r[0].text, /\/perfil/)
  })
  test('cuenta inactiva: le responde', async () => { mundo({ estado: 'inactivo' }); assert.ok((await tocar(CHAT)).length >= 1) })
  test('cuenta bloqueada: le dice cómo contactarnos', async () => {
    mundo({ estado: 'bloqueado' }); const r = await tocar(CHAT); assert.ok(r.length >= 1); assert.match(r[0].text, /hola@micompaz\.com/)
  })
  test('alguien no vinculado: también recibe una respuesta (no se queda en silencio)', async () => {
    const r = await tocar('7770007'); assert.ok(r.length >= 1, 'debe responder algo')
  })
})
