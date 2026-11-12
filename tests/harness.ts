/* eslint-disable */
// Entorno de pruebas: variables, mock de red (Telegram / Resend / Daily) y utilidades de escenarios.
(process.env as any).NODE_ENV = process.env.NODE_ENV ?? 'test'
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: 'https://proyecto.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service',
  TELEGRAM_BOT_TOKEN: 'TESTBOTTOKEN:SECRETO', TELEGRAM_WEBHOOK_SECRET: 'whsecret', TELEGRAM_ADMIN_CHAT_ID: '999',
  TELEGRAM_BOT_USERNAME: 'compaz_bot',
  RESEND_API_KEY: 're_test', CRON_SECRET: 'cronsecret', DAILY_API_KEY: 'daily', DAILY_WEBHOOK_SECRET: Buffer.from('dailysecret-0123456789abcdef-xyz').toString('base64'),
  NEXT_PUBLIC_SITE_URL: 'https://micompaz.test', ADMIN_EMAILS: 'admin@compaz.test',
})
delete process.env.ANTHROPIC_API_KEY
delete process.env.PAGO_SIMULADO

import { limpiarCacheAjustes } from '@/lib/ajustes'
import { NextRequest } from 'next/server'
import { db, session } from './fake-supabase-server'
import { randomUUID, createHmac } from 'crypto'

export { db, session }

export type TgMsg = { chat: string; text: string; markup?: any }
export const net = {
  tg: [] as TgMsg[],
  emails: [] as { to: any; subject: string; html: string }[],
  rooms: [] as { name: string; url: string; props: any; privacy?: string }[],
  pases: [] as any[],
  /** chat ids a los que Telegram "falla" (devuelve 502) */
  tgFailFor: new Set<string>(),
  tgFailAll: false,
  resendFail: false,
  dailyFail: false,
  fotosDescargadas: 0,
  reset() {
    this.tg = []; this.emails = []; this.rooms = []; this.pases = []; this.tgFailFor.clear(); this.tgFailAll = false
    this.resendFail = false; this.dailyFail = false; this.fotosDescargadas = 0
  },
}

// blockquote (también con el atributo expandable) es HTML válido de Telegram desde la Bot API 7.4.
const TAG = /<\/?(b|i|u|s|a|code|pre|em|strong|blockquote)(\s[^>]*)?>/g
function parseaComoTelegram(text: string): boolean {
  // Telegram HTML: solo tags permitidos; cualquier "<" suelto rompe el parseo ("can't parse entities")
  const sinTags = text.replace(TAG, '')
  return !/</.test(sinTags)
}

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input.url
  const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

  if (url.startsWith('https://api.telegram.org/bot')) {
    const method = url.split('/').pop()!.split('?')[0]
    const body = init?.body ? JSON.parse(init.body) : {}
    if (method === 'sendMessage') {
      const chat = String(body.chat_id)
      if (net.tgFailAll || net.tgFailFor.has(chat)) return new Response('Bad Gateway', { status: 502 })
      if (!parseaComoTelegram(String(body.text))) return json({ ok: false, description: "Bad Request: can't parse entities" }, 400)
      net.tg.push({ chat, text: body.text, markup: body.reply_markup })
      return json({ ok: true, result: { message_id: net.tg.length } })
    }
    if (method === 'getFile') return json({ ok: true, result: { file_path: 'photos/file_1.jpg' } })
    return json({ ok: true, result: true })
  }
  if (url.startsWith('https://api.telegram.org/file/bot')) {
    net.fotosDescargadas++
    return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), { status: 200 })
  }
  if (url === 'https://api.resend.com/emails') {
    if (net.resendFail) return json({ name: 'application_error', message: 'servicio caído', statusCode: 500 }, 500)
    const b = JSON.parse(init.body)
    net.emails.push({ to: b.to, subject: b.subject, html: b.html })
    return json({ id: randomUUID() })
  }
  if (url.startsWith('https://api.daily.co/v1/webhooks')) {
    const m = init?.method ?? 'GET'
    ;(net as any).dailyWebhooks = (net as any).dailyWebhooks ?? []
    const lista = (net as any).dailyWebhooks as any[]
    if (m === 'GET') return json(lista)
    if (m === 'DELETE') { const id = url.split('/').pop(); const i = lista.findIndex((h) => h.uuid === id); if (i >= 0) lista.splice(i, 1); return json({ deleted: true }) }
    if ((net as any).dailyWebhookFail) return new Response('rechazado', { status: 400 })
    const b = JSON.parse(init.body); const h = { uuid: randomUUID(), ...b }; lista.push(h); return json(h)
  }
  if (url.startsWith('https://api.daily.co/v1/meeting-tokens')) {
    const b = JSON.parse(init.body); net.pases.push(b.properties)
    return json({ token: 'pase-' + randomUUID() })
  }
  if (url.startsWith('https://api.daily.co/v1/rooms')) {
    if (net.dailyFail) return new Response('daily caído', { status: 500 })
    if (init?.method === 'POST') {
      const b = JSON.parse(init.body)
      const room = { id: randomUUID(), name: b.name, url: `https://compaz.daily.co/${b.name}`, created_at: new Date().toISOString() }
      net.rooms.push({ name: b.name, url: room.url, props: b.properties, privacy: b.privacy })
      return json(room)
    }
    return json({ config: { exp: 0 } })
  }
  return realFetch(input, init)
}) as any

// ── Utilidades ─────────────────────────────────────────────────────────────────
export const SITE = 'https://micompaz.test'
export function req(path: string, init: { method?: string; json?: any; headers?: Record<string, string>; body?: any } = {}) {
  const headers = new Headers(init.headers)
  let body = init.body
  if (init.json !== undefined) { body = JSON.stringify(init.json); headers.set('content-type', 'application/json') }
  return new NextRequest(new URL(path, SITE), { method: init.method ?? (body ? 'POST' : 'GET'), headers, body })
}

let updateId = 1000
export function tgReq(update: any) {
  return req('/api/telegram-webhook', { json: { update_id: ++updateId, ...update }, headers: { 'x-telegram-bot-api-secret-token': 'whsecret' } })
}
export const tgText = (chat: string | number, text: string, extra: any = {}) =>
  tgReq({ message: { message_id: 1, from: { id: Number(chat), first_name: 'x' }, chat: { id: Number(chat), type: 'private' }, date: 0, text, ...extra } })
export const tgBtn = (chat: string | number, data: string) =>
  tgReq({ callback_query: { id: randomUUID(), from: { id: Number(chat), first_name: 'x' }, data, message: { message_id: 7, from: { id: 1, first_name: 'bot' }, chat: { id: Number(chat), type: 'private' }, date: 0 } } })
export const tgFoto = (chat: string | number, extra: any = {}) =>
  tgReq({ message: { message_id: 1, from: { id: Number(chat), first_name: 'x' }, chat: { id: Number(chat), type: 'private' }, date: 0, photo: [{ file_id: 'ABC', file_unique_id: 'u', width: 1, height: 1 }], ...extra } })

export const cron = (path: string, secret: string | null = 'cronsecret') =>
  req(`/api/cron/${path}`, { method: 'POST', headers: secret === null ? {} : { 'x-cron-secret': secret } })

export const ultimoTg = (chat: string | number) => [...net.tg].reverse().find((m) => m.chat === String(chat))
export const tgPara = (chat: string | number) => net.tg.filter((m) => m.chat === String(chat))
export const emailsA = (to: string) => net.emails.filter((e) => (Array.isArray(e.to) ? e.to.includes(to) : e.to === to))

// ── Mundo de prueba ────────────────────────────────────────────────────────────
export function limpiar() {
  db.reset(); net.reset(); session.user = null
  // Las pruebas del flujo anterior (iniciar visita sin foto de llegada) corren con ese ajuste apagado; las del flujo nuevo lo encienden.
  limpiarCacheAjustes()
  db.seed('ajustes', { clave: 'llegada_foto_obligatoria', valor: 0, actualizado_por: 'pruebas' })
}
export const ahoraMas = (min: number) => new Date(Date.now() + min * 60_000).toISOString()

export function mkCompita(o: Record<string, any> = {}) {
  return db.seed('compitas', { nombre: 'María Pérez', zona: 'Caracas', email: `maria${Math.random().toString(36).slice(2, 6)}@mail.test`, estado: 'activo', verificado: true, telegram_chat_id: String(Math.floor(Math.random() * 1e9)), ...o })
}
export function mkCliente(o: Record<string, any> = {}) {
  const id = randomUUID()
  // Por defecto con la ficha completa y los términos aceptados; las pruebas de ficha incompleta lo ponen en null.
  return db.seed('usuarios', { id, nombre: 'Carlos Ruiz', email: `carlos${Math.random().toString(36).slice(2, 6)}@mail.test`, familiar_nombre: 'Elena', telefono: '+58 412 000 0000', terminos_aceptados_en: new Date().toISOString(), ...o })
}
export function mkSolicitud(cliente: any, compita: any, o: Record<string, any> = {}) {
  return db.seed('solicitudes', { cliente_id: cliente.id, compita_id: compita.id, mensaje: 'Mi mamá necesita compañía', slots_propuestos: [ahoraMas(120), ahoraMas(240), ahoraMas(360)], ...o })
}
export function mkVisita(cliente: any, compita: any, o: Record<string, any> = {}) {
  return db.seed('visitas', { usuario_id: cliente.id, compita_id: compita.id, estado: 'pre_visita', ...o })
}
export const hoyVEstr = (off = 0) => new Date(Date.now() - 4 * 3600_000 + off * 86400_000).toISOString().slice(0, 10)

export function firmaDaily(body: string, ts = Math.floor(Date.now() / 1000)) {
  const key = Buffer.from(process.env.DAILY_WEBHOOK_SECRET!, 'base64')
  return { 'x-webhook-timestamp': String(ts), 'x-webhook-signature': createHmac('sha256', key).update(`${ts}.${body}`).digest('base64') }
}

/** El cliente confirma en su panel que el compita llegó (confirmando_inicio → en_curso), como en producción. */
export async function confirmarLlegada() {
  const { POST } = await import('@/app/api/visita/confirmar-inicio/route')
  const previo = session.user
  for (const v of db.rows('visitas').filter((x) => x.estado === 'confirmando_inicio')) {
    const cli = db.rows('usuarios').find((u) => u.id === v.usuario_id)
    session.user = { id: cli!.id, email: cli!.email }
    await POST(req('/api/visita/confirmar-inicio', { json: { visitaId: v.id } }))
  }
  session.user = previo
}

/**
 * Todo lo que se le avisó al equipo, por el canal que sea y SIN duplicar: las urgencias salen por Telegram al dueño; las tareas y lo
 * informativo quedan en el registro de actividad del panel (no suenan). Las pruebas que solo quieren saber "¿se le avisó al admin?"
 * usan esto; las de la política (qué suena y qué no) miran cada canal por separado.
 */
export const avisosAdmin = () => [
  ...net.tg.filter((m) => m.chat === '999'),
  ...db.rows('actividad_admin').filter((r) => r.nivel !== 'urgente').map((r) => ({ chat: '999', text: String(r.resumen), markup: undefined as any })),
]

/**
 * El compita confirma la hora que el cliente propuso para la visita. Desde que la cita SIEMPRE se confirma, elegir la fecha deja una propuesta
 * y la visita se programa al confirmar: las pruebas que necesitan la visita ya programada llaman a esto después de elegir la fecha.
 */
export async function confirmarPropuesta(visitaId: string): Promise<boolean> {
  const v = db.rows('visitas').find((x: any) => x.id === visitaId)
  if (!v?.cita_propuesta_en) return false
  const { confirmarCita, versionCita } = await import('@/lib/citas')
  return (await confirmarCita(visitaId, v.compita_id, versionCita(v.cita_propuesta_en))) === 'ok'
}
