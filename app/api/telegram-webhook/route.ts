import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import {
  validateTelegramWebhook,
  sendTelegramMessage,
  avisarAdmin,
  answerCallbackQuery,
  editMessageReplyMarkup,
  INLINE_INICIO,
  INLINE_DURANTE,
  INLINE_CONFIRMAR_INICIO,
  INLINE_CONFIRMAR_FIN,
  INLINE_START,
  INLINE_REAGENDAR_VISITA,
  INLINE_INICIAR_O_REAGENDAR,
  QUITAR_TECLADO,
  makeInlineKeyboard,
} from '@/lib/telegram'
import { generarTokenPerfil } from '@/lib/compita-tokens'
import { sendVisitaInicio, sendVisitaResumen, sendResumenConReporte, sendCodigoTelegram } from '@/lib/resend'
import { responderSolicitud } from '@/lib/solicitudes'
import { sendEmail, SITE_URL as SITE_URL_PUBLICA } from '@/lib/email'
import { esc, escLike } from '@/lib/html'
import { formatSlotVE, formatFechaVE, hoyVE } from '@/lib/format'
import { randomInt } from 'crypto'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

const GUIA_COMPITA = `📖 <b>Todo lo que puedes hacer desde este chat</b>

Hola 👋 Este es tu asistente de Compaz. Desde aquí manejas todo tu trabajo. Te explico cómo funciona, paso a paso:

━━━━━━━━━━━━━━━━━━━

<b>1. Cuando llegues donde tu cliente</b>
Toca el botón que dice <b>▶️ Iniciar visita</b>.
Así la familia sabe que ya llegaste. Si no tocas ese botón, la familia no se entera de que estás ahí.

<b>2. Durante la visita</b>
Puedes <b>mandar fotos</b> o <b>escribir mensajes</b> en este mismo chat. La familia los ve en tiempo real en su celular o computadora. Por ejemplo: una foto del almuerzo que preparaste, o un mensaje diciéndole cómo está el adulto mayor.

<b>3. Cuando te vayas</b>
Toca el botón que dice <b>🔴 Terminar visita</b>. La familia recibe automáticamente un resumen de la visita por correo.

━━━━━━━━━━━━━━━━━━━

<b>4. Cuando un cliente quiere conocerte</b>
Recibirás un mensaje aquí con la solicitud. Te propondrán unos horarios para hacer una llamada de video. Tú eliges el que te funcione o dices que ninguno sirve y propones otros. Nosotros le avisamos al cliente.

━━━━━━━━━━━━━━━━━━━

<b>5. Para actualizar tu perfil</b>
Escribe <b>/perfil</b> (así, con la barra adelante).
Te llegará un enlace. Ábrelo en tu celular y podrás:
• Cambiar tu foto
• Escribir una descripción tuya
• Elegir qué servicios ofreces
• Poner tus horarios disponibles
• Agregar un video de YouTube donde te presentes

━━━━━━━━━━━━━━━━━━━

<b>6. Si hay una emergencia durante la visita</b>
Toca el botón <b>🚨 Emergencia</b>. El equipo de Compaz recibe una alerta inmediata con tus datos y los del cliente, y te contactamos enseguida. Para peligro inmediato, llama al <b>911</b>.

━━━━━━━━━━━━━━━━━━━

<b>¿Tienes dudas?</b>
Escribe <b>/menu</b> para volver a ver estas instrucciones.
O escríbenos a <b>hola@micompaz.com</b> y te ayudamos.`

const PREGUNTAS_REPORTE = [
  { emoji: '😊', label: 'Ánimo', texto: '¿Cómo estaba el <b>ánimo</b> de la persona durante la visita?' },
  { emoji: '💪', label: 'Condición física', texto: '¿Cómo notaste su <b>condición física</b>?' },
  { emoji: '🤝', label: 'Participación', texto: '¿Qué tan <b>receptiva o activa</b> estuvo durante la visita?' },
  { emoji: '🏠', label: 'Ambiente y entorno', texto: '¿Cómo estaba el <b>ambiente y entorno</b> donde se encontraba?' },
]

function makeReporteKeyboard() {
  return makeInlineKeyboard([
    [
      { text: '1', callback_data: 'rr:1' },
      { text: '2', callback_data: 'rr:2' },
      { text: '3', callback_data: 'rr:3' },
      { text: '4', callback_data: 'rr:4' },
      { text: '5', callback_data: 'rr:5' },
    ],
    [{ text: 'N/A — No aplica', callback_data: 'rr:N' }],
  ])
}

const escapeHtml = esc

import type { TelegramUpdate, Compita, Usuario, Visita, Mensaje } from '@/types'

// Estado persistido en Supabase (tabla telegram_estados) para sobrevivir serverless cold starts
async function getEstado(supabase: ReturnType<typeof createAdminSupabase>, chatId: string) {
  const { data } = await supabase.from('telegram_estados').select('*').eq('chat_id', chatId).maybeSingle()
  return data as { chat_id: string; registro_pendiente: boolean; pendiente_accion: string | null; pendiente_expira: string | null } | null
}

async function setEstado(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, campos: { registro_pendiente?: boolean; pendiente_accion?: string | null; pendiente_expira?: string | null }) {
  const actual = await getEstado(supabase, chatId)
  if (actual) {
    await supabase.from('telegram_estados').update(campos).eq('chat_id', chatId)
  } else {
    await supabase.from('telegram_estados').insert({ chat_id: chatId, registro_pendiente: false, pendiente_accion: null, pendiente_expira: null, ...campos })
  }
}

async function setRegistroPendiente(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, valor: boolean) {
  await setEstado(supabase, chatId, { registro_pendiente: valor, pendiente_accion: null, pendiente_expira: null })
}
async function clearPendiente(supabase: ReturnType<typeof createAdminSupabase>, chatId: string) {
  await setEstado(supabase, chatId, { pendiente_accion: null, pendiente_expira: null })
}

// Confirmaciones de iniciar/terminar viven en su propia fila (conf:<chat>) para no pisar
// el cuestionario de bienestar ni la sugerencia de horarios, que usan la fila principal.
type Confirmacion = { accion: 'iniciar' | 'terminar'; visitaId: string }
async function setConfirmacion(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, accion: 'iniciar' | 'terminar', visitaId: string) {
  const fila = `conf:${chatId}`
  const campos = { pendiente_accion: `${accion}:${visitaId}`, pendiente_expira: new Date(Date.now() + 300_000).toISOString(), registro_pendiente: false }
  const { error } = await supabase.from('telegram_estados').upsert({ chat_id: fila, ...campos }, { onConflict: 'chat_id' })
  if (error) throw new Error(`setConfirmacion: ${error.message}`)
}
async function takeConfirmacion(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, esperada: 'iniciar' | 'terminar'): Promise<Confirmacion | null> {
  // Consume de forma atómica: solo una entrega concurrente obtiene la fila.
  const { data } = await supabase
    .from('telegram_estados')
    .delete()
    .eq('chat_id', `conf:${chatId}`)
    .like('pendiente_accion', `${esperada}:%`)
    .select('pendiente_accion, pendiente_expira')
    .maybeSingle()
  if (!data?.pendiente_accion || !data.pendiente_expira || new Date(data.pendiente_expira).getTime() < Date.now()) return null
  const [accion, visitaId] = data.pendiente_accion.split(':')
  if ((accion !== 'iniciar' && accion !== 'terminar') || !visitaId) return null
  return { accion, visitaId }
}
async function clearConfirmacion(supabase: ReturnType<typeof createAdminSupabase>, chatId: string) {
  await supabase.from('telegram_estados').delete().eq('chat_id', `conf:${chatId}`)
}

async function guardarReporteYEnviarEmail(
  supabase: ReturnType<typeof createAdminSupabase>,
  chatId: string,
  compita: Compita,
  accion: string,
  novedad: string | null,
) {
  // formato: reporte_novedad:{visita_id}:{ans0},{ans1},{ans2},{ans3}
  const partes = accion.split(':')
  const visitaId = partes[1]
  const answers = (partes[2] ?? '').split(',')

  function parseAns(v: string | undefined): number | null {
    if (!v || v === 'N') return null
    const n = parseInt(v, 10)
    return isNaN(n) ? null : n
  }

  const reporte = {
    animo: parseAns(answers[0]),
    fisico: parseAns(answers[1]),
    participacion: parseAns(answers[2]),
    entorno: parseAns(answers[3]),
    novedad: novedad?.trim() || null,
  }

  // Todas las queries usan admin para saltarse RLS (compita no tiene sesión de Auth)
  const adminReporte = createAdminSupabase()

  // Obtener visita con usuario
  const { data: visita } = await adminReporte
    .from('visitas')
    .select('*, usuario:usuarios(*)')
    .eq('id', visitaId)
    .single() as { data: (Visita & { usuario: Usuario }) | null }

  await clearPendiente(supabase, chatId)

  if (visita && visita.compita_id !== compita.id) {
    await sendTelegramMessage(chatId, `Ese cuestionario no corresponde a tu cuenta.`, INLINE_INICIO)
    return
  }

  // Idempotencia: un solo reporte por visita (doble toque / reintento de Telegram)
  const { count: yaExiste } = await adminReporte
    .from('reportes_visita').select('id', { count: 'exact', head: true }).eq('visita_id', visitaId)
  if ((yaExiste ?? 0) > 0) {
    await sendTelegramMessage(chatId, `Ese cuestionario ya fue registrado. ¡Gracias! 💙`, INLINE_INICIO)
    return
  }

  if (!visita || !visita.usuario) {
    await sendTelegramMessage(chatId, `Hubo un problema al recuperar los datos de la visita. No pudimos guardar el cuestionario ni enviar el resumen a la familia. Escríbenos a hola@micompaz.com y lo resolvemos.`, INLINE_INICIO)
    return
  }

  // Reportes anteriores del mismo cliente (vía sus visitas)
  const { data: visitasCliente } = await adminReporte
    .from('visitas')
    .select('id')
    .eq('usuario_id', visita.usuario_id)
    .neq('id', visitaId)
    .eq('estado', 'terminada')

  type HistorialRow = { animo: number | null; fisico: number | null; participacion: number | null; entorno: number | null; created_at: string }
  let historial: HistorialRow[] = []
  if (visitasCliente && visitasCliente.length > 0) {
    const visitaIds = visitasCliente.map((v) => v.id)
    const { data: reportesPrevios } = await adminReporte
      .from('reportes_visita')
      .select('animo, fisico, participacion, entorno, created_at')
      .in('visita_id', visitaIds)
      .order('created_at', { ascending: true })
    historial = (reportesPrevios ?? []) as HistorialRow[]
  }

  // Guardar reporte en BD
  const { data: reporteGuardado, error: reporteError } = await adminReporte
    .from('reportes_visita')
    .insert({ visita_id: visitaId, ...reporte })
    .select('id')
    .single()

  if (reporteError?.code === '23505') {
    // Otro toque simultáneo ya registró el cuestionario: no es un error para la compita
    await sendTelegramMessage(chatId, `Ese cuestionario ya fue registrado. ¡Gracias! 💙`, INLINE_INICIO)
    return
  }

  if (reporteError || !reporteGuardado) {
    console.error('Error guardando reporte_visita:', reporteError)
    await sendTelegramMessage(chatId, `Hubo un problema guardando el cuestionario. Por favor escríbenos a hola@micompaz.com para que lo registremos manualmente.`, INLINE_INICIO)
    return
  }

  // Enviar segundo email con indicadores de bienestar y resumen IA
  let emailEnviado = false
  try {
    const { data: mensajes } = await adminReporte
      .from('mensajes').select('*').eq('visit_id', visitaId).order('created_at', { ascending: true }) as { data: import('@/types').Mensaje[] | null }

    const resumenIA = await sendResumenConReporte(
      visita.usuario,
      compita,
      visita,
      mensajes ?? [],
      reporte,
      historial,
      true, // esActualizacion — el email básico ya fue enviado al terminar
    )

    // Guardar resumen IA en el reporte
    emailEnviado = true
    if (reporteGuardado?.id && resumenIA) {
      await adminReporte.from('reportes_visita').update({ resumen_ia: resumenIA }).eq('id', reporteGuardado.id)
    }
  } catch (e) {
    console.error('Error correo resumen con reporte:', e)
    await avisarAdmin(`⚠️ El cuestionario de <b>${esc(compita.nombre)}</b> se guardó pero no se pudo enviar el correo a <b>${esc(visita.usuario.nombre)}</b> (${esc(visita.usuario.email)}).`)
  }

  await sendTelegramMessage(
    chatId,
    emailEnviado
      ? `✅ <b>¡Listo!</b> El cuestionario fue guardado y se le envió el resumen a la familia.\n\n¡Gracias por tu trabajo, ${esc(compita.nombre)}! 💙`
      : `✅ El cuestionario fue guardado. Tuvimos un problema enviando el correo a la familia; el equipo de Compaz lo enviará.\n\n¡Gracias por tu trabajo, ${esc(compita.nombre)}! 💙`,
    INLINE_INICIO,
  )
}

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token')
  if (!validateTelegramWebhook(secretHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await req.json() as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Idempotencia: Telegram reintenta si tardamos o respondemos 5xx. Reclamar update_id es atómico (PK).
  if (typeof update.update_id === 'number') {
    const { error: dupError } = await createAdminSupabase()
      .from('telegram_estados')
      .insert({ chat_id: `upd:${update.update_id}`, registro_pendiente: false })
    if (dupError?.code === '23505') return NextResponse.json({ ok: true, duplicado: true })
  }

  // Nunca devolver 5xx: provocaría reintentos en bucle. Se registra y se avisa al usuario.
  try {
    return await procesarUpdate(update)
  } catch (e) {
    console.error('[telegram-webhook] error no controlado:', e)
    const chat = update.message?.chat.id ?? update.callback_query?.message?.chat.id
    if (chat) {
      await sendTelegramMessage(String(chat), 'Ocurrió un error inesperado. Intenta de nuevo en un momento; si persiste escríbenos a hola@micompaz.com.').catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }
}

function enmascarar(email: string): string {
  const [u, d] = email.split('@')
  if (!d) return '***'
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`
}

/** Genera y envía el código de verificación. Límite: 1 código por minuto y compita. */
async function iniciarVerificacion(
  supabase: ReturnType<typeof createAdminSupabase>,
  chatId: string,
  c: Pick<Compita, 'id' | 'nombre' | 'email'>,
): Promise<void> {
  const key = `cod:${c.id}`
  const { data: prev } = await supabase.from('telegram_estados').select('updated_at').eq('chat_id', key).maybeSingle()
  if (prev && Date.now() - new Date(prev.updated_at).getTime() < 60_000) {
    await setRegistroPendiente(supabase, chatId, true)
    await sendTelegramMessage(chatId, `Ya enviamos un código hace un momento. Espera un minuto antes de pedir otro. ✍️ Escribe tu nombre de nuevo cuando quieras reintentar:`, QUITAR_TECLADO)
    return
  }
  await supabase.from('telegram_estados').upsert({ chat_id: key, registro_pendiente: false, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })

  const codigo = String(randomInt(100000, 1000000))
  const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await setEstado(supabase, chatId, { registro_pendiente: false, pendiente_accion: `verificar:${codigo}:${c.id}`, pendiente_expira: expira })

  if (c.email) {
    try {
      await sendCodigoTelegram(c.email, c.nombre, codigo)
    } catch (e) {
      console.error('Error enviando código por email:', e)
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(chatId, `No pudimos enviar el correo con tu código. Escríbenos a hola@micompaz.com y te activamos la cuenta. ✍️ O intenta de nuevo escribiendo tu nombre:`, QUITAR_TECLADO)
      return
    }
    await sendTelegramMessage(chatId, `Encontré tu cuenta 👀\n\nTe enviamos un <b>código de 6 dígitos</b> al correo <b>${esc(enmascarar(c.email))}</b>.\n\n✍️ Escríbelo aquí cuando lo recibas:`, QUITAR_TECLADO)
  } else {
    const entregado = await avisarAdmin(`🔐 <b>Verificación de Compita</b>\n\n<b>${esc(c.nombre)}</b> quiere activar su cuenta.\n\nCódigo: <code>${codigo}</code>\n\nExpira en 15 minutos.`)
    if (!entregado) {
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(chatId, `No pudimos generar tu código. Escríbenos a hola@micompaz.com. ✍️ O intenta de nuevo escribiendo tu nombre:`, QUITAR_TECLADO)
      return
    }
    await sendTelegramMessage(chatId, `Encontré tu cuenta 👀\n\nPor seguridad, te enviamos un <b>código de 6 dígitos</b> a través del admin de Compaz.\n\n✍️ Escríbelo aquí cuando lo recibas:`, QUITAR_TECLADO)
  }
}

type VisitaObj = {
  id: string; usuario_id: string; estado: string
  fecha_programada: string | null; hora_inicio_programada: string | null; hora_fin_programada: string | null
  usuario: { nombre: string; email: string } | null
}

/** Visita sobre la que actúa la compita: la de hoy/ayer, si no la próxima con fecha, si no una sin fecha. */
async function visitaObjetivo(supabase: ReturnType<typeof createAdminSupabase>, compitaId: string): Promise<VisitaObj | null> {
  const { data } = await supabase
    .from('visitas')
    .select('id, usuario_id, estado, fecha_programada, hora_inicio_programada, hora_fin_programada, usuario:usuarios(nombre, email)')
    .eq('compita_id', compitaId)
    .in('estado', ['programada', 'pre_visita'])
    .order('fecha_programada', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false }) as { data: VisitaObj[] | null }
  const lista = data ?? []
  const hoy = hoyVE(), ayer = hoyVE(-1)
  return lista.find((v) => v.fecha_programada === hoy)
    ?? lista.find((v) => v.fecha_programada === ayer)
    ?? lista.find((v) => v.fecha_programada && v.fecha_programada > hoy)
    ?? lista.find((v) => v.fecha_programada)
    ?? lista[0]
    ?? null
}

async function procesarUpdate(update: TelegramUpdate): Promise<NextResponse> {

  // Extraer chatId y text tanto de message como de callback_query
  const isCallback = !!update.callback_query
  const callbackId = update.callback_query?.id
  const message = update.message ?? update.callback_query?.message
  if (!message) return NextResponse.json({ ok: true })

  const chatId = String(message.chat.id)
  const text = isCallback
    ? (update.callback_query?.data?.trim() ?? '')
    : (message.text?.trim() ?? '')

  const supabase = createAdminSupabase()

  // Si es callback, responder inmediatamente para quitar el "cargando" del botón
  if (isCallback && callbackId) {
    await answerCallbackQuery(callbackId)
    // Quitar los botones del mensaje original para evitar doble toque
    if (message.message_id) {
      await editMessageReplyMarkup(chatId, message.message_id, null).catch(() => {})
    }
  }

  // Buscar compita por telegram_chat_id
  const { data: compita } = await supabase
    .from('compitas')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .maybeSingle() as { data: Compita | null }

  // Cuenta bloqueada: no puede usar nada del bot (salvo /reset del admin).
  if (compita?.estado === 'bloqueado' && text !== '/reset') {
    await sendTelegramMessage(chatId, `Tu cuenta está suspendida. Escríbenos a hola@micompaz.com.`)
    return NextResponse.json({ ok: true })
  }

  // ── /menu — guía de funcionalidades ─────────────────────────────────────────
  if (text === '/menu' || text === '/ayuda' || text === 'cmd_menu') {
    if (!compita) {
      await sendTelegramMessage(chatId, `Tu cuenta no está vinculada. Toca el botón para comenzar. 👇`, INLINE_START)
      return NextResponse.json({ ok: true })
    }
    await sendTelegramMessage(chatId, GUIA_COMPITA, INLINE_INICIO)
    return NextResponse.json({ ok: true })
  }

  // ── /perfil — editar perfil ───────────────────────────────────────────────
  if (text === '/perfil') {
    if (!compita) {
      await sendTelegramMessage(chatId, `Tu cuenta no está vinculada. Toca el botón para comenzar. 👇`, INLINE_START)
      return NextResponse.json({ ok: true })
    }
    try {
      const token = await generarTokenPerfil(compita.id)
      const url = `${SITE_URL}/compita/perfil?token=${token}`
      const venceEn = new Date(Date.now() + 24 * 60 * 60_000)
      const venceLabel = venceEn.toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
      await sendTelegramMessage(
        chatId,
        `✏️ <b>Edita tu perfil</b>\n\nAquí tienes tu enlace personal:\n\n<a href="${url}">${url}</a>\n\n⏳ Este enlace vence el <b>${venceLabel}</b> y solo funciona una vez. Si lo abres y lo dejas a medias, vuelve a escribir /perfil para obtener uno nuevo.\n\nSi tienes algún problema, escríbenos a hola@micompaz.com.`,
        INLINE_INICIO,
      )
    } catch (e) {
      console.error('Error generando token de perfil:', e)
      await sendTelegramMessage(chatId, `Hubo un error al generar tu enlace. Intenta de nuevo en un momento.`, INLINE_INICIO)
    }
    return NextResponse.json({ ok: true })
  }

  // ── /reset — solo admin ──────────────────────────────────────────────────────
  if (text === '/reset') {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (chatId !== adminChatId) return NextResponse.json({ ok: true })
    if (compita) {
      await supabase.from('compitas').update({ telegram_chat_id: null }).eq('id', compita.id)
    }
    await setEstado(supabase, chatId, { registro_pendiente: false, pendiente_accion: null, pendiente_expira: null })
    await sendTelegramMessage(chatId, `Cuenta desvinculada. Toca el botón para comenzar de nuevo.`, INLINE_START)
    return NextResponse.json({ ok: true })
  }

  // ── /start — bienvenida y registro ──────────────────────────────────────────
  if (text === '/start' || text.startsWith('/start ')) {
    if (compita) {
      // Verificar si tiene cliente asignado
      const { data: clienteAsignado } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('compita_id', compita.id)
        .limit(1)
        .maybeSingle() as { data: { nombre: string } | null }

      if (clienteAsignado) {
        await sendTelegramMessage(
          chatId,
          `¡Hola de nuevo, <b>${esc(compita.nombre)}</b>! 👋\n\nTodo está listo. Cuando llegues a casa de tu cliente y vayas a comenzar, toca el botón <b>▶️ Iniciar visita</b>. Cuando termines, toca <b>🔴 Terminar visita</b>.`,
          INLINE_INICIO,
        )
      } else {
        await sendTelegramMessage(
          chatId,
          `¡Hola de nuevo, <b>${esc(compita.nombre)}</b>! 👋\n\nTu cuenta está activa. Todavía no tienes un cliente asignado, pero cuando eso cambie te avisaremos aquí.\n\nMientras tanto, puedes actualizar tu perfil con <b>/perfil</b> para que las familias te conozcan mejor.`,
          INLINE_INICIO,
        )
      }
    } else {
      await setEstado(supabase, chatId, { registro_pendiente: true, pendiente_accion: null, pendiente_expira: null })
      await sendTelegramMessage(
        chatId,
        `¡Bienvenido a Compaz! 👋\n\nSoy el asistente que te acompañará en cada visita.\n\nPrimero necesito verificar tu cuenta. ✍️ Escríbeme tu <b>nombre completo</b> tal como lo pusiste cuando te registraste. No importa si usas mayúsculas o no.\n\n<i>Por ejemplo: María González</i>`,
        QUITAR_TECLADO,
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Vinculación por nombre + código de verificación ─────────────────────────
  const estado = !compita ? await getEstado(supabase, chatId) : null

  // Paso 1b: desambiguación por email cuando hay múltiples cuentas con el mismo nombre
  // formato estado: desambiguar:{id1},{id2},...
  if (estado?.pendiente_accion?.startsWith('desambiguar:') && !compita) {
    if (!text.trim()) return NextResponse.json({ ok: true })
    const expirado = estado.pendiente_expira ? new Date(estado.pendiente_expira) < new Date() : true
    if (expirado) {
      await clearPendiente(supabase, chatId)
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(chatId, `El tiempo expiró. ✍️ Escribe tu nombre de nuevo para intentarlo:`, QUITAR_TECLADO)
      return NextResponse.json({ ok: true })
    }
    const ids = estado.pendiente_accion.slice('desambiguar:'.length).split(',').filter(Boolean)
    const { data: candidatas } = await supabase
      .from('compitas')
      .select('id, nombre, email, codigo')
      .in('id', ids)
      .ilike('email', `${escLike(text.trim())}%`) as { data: Compita[] | null }

    if (!candidatas || candidatas.length === 0) {
      await setRegistroPendiente(supabase, chatId, true)
      await clearPendiente(supabase, chatId)
      await sendTelegramMessage(chatId, `No encontré ninguna cuenta con esas letras de correo. 🤔\n\nEscríbenos a hola@micompaz.com y te ayudamos a activar tu cuenta.\n\n✍️ O escribe tu nombre de nuevo para intentarlo:`, QUITAR_TECLADO)
    } else if (candidatas.length > 1) {
      await clearPendiente(supabase, chatId)
      await sendTelegramMessage(chatId, `No pude identificarte con esa información. Por favor escríbenos a hola@micompaz.com y te activamos la cuenta manualmente.`, QUITAR_TECLADO)
    } else {
      await iniciarVerificacion(supabase, chatId, candidatas[0])
    }
    return NextResponse.json({ ok: true })
  }

  // Paso 2: compita ingresó el código de 6 dígitos
  // formato estado: verificar:{codigo}:{compitaId}:{intentos_fallidos}
  if (estado?.pendiente_accion?.startsWith('verificar:') && !compita) {
    const partesCodigo = estado.pendiente_accion.split(':')
    const [, codigo, compitaId] = partesCodigo
    const intentosFallidos = parseInt(partesCodigo[3] ?? '0', 10)
    if (!text.trim()) return NextResponse.json({ ok: true })
    const expirado = estado.pendiente_expira ? new Date(estado.pendiente_expira) < new Date() : true
    if (expirado) {
      await clearPendiente(supabase, chatId)
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(chatId, `El código expiró. ✍️ Escribe tu nombre de nuevo para obtener uno nuevo:`)
      return NextResponse.json({ ok: true })
    }
    if (text.trim() !== codigo) {
      const nuevosIntentos = intentosFallidos + 1
      if (nuevosIntentos >= 5) {
        // Bloquear: invalidar el código y pedir que empiece de nuevo
        await clearPendiente(supabase, chatId)
        await setRegistroPendiente(supabase, chatId, true)
        await sendTelegramMessage(
          chatId,
          `Demasiados intentos incorrectos ❌\n\nPor seguridad, el código fue invalidado. ✍️ Escribe tu nombre de nuevo para recibir uno nuevo:`,
          QUITAR_TECLADO,
        )
      } else {
        // Registrar intento fallido en el estado
        await setEstado(supabase, chatId, {
          pendiente_accion: `verificar:${codigo}:${compitaId}:${nuevosIntentos}`,
        })
        const restantes = 5 - nuevosIntentos
        await sendTelegramMessage(
          chatId,
          `Código incorrecto ❌\n\nRevisa el correo e inténtalo de nuevo. Te quedan <b>${restantes}</b> intento${restantes !== 1 ? 's' : ''}.`,
          QUITAR_TECLADO,
        )
      }
      return NextResponse.json({ ok: true })
    }
    // Código correcto — vincular
    await clearPendiente(supabase, chatId)
    const { data: encontrada } = await supabase.from('compitas').select('nombre').eq('id', compitaId).single() as { data: Compita | null }
    const { error: errVinculo } = await supabase.from('compitas').update({ telegram_chat_id: chatId }).eq('id', compitaId)
    if (errVinculo) {
      console.error('Error vinculando Telegram:', errVinculo)
      await sendTelegramMessage(chatId, `No pudimos vincular tu cuenta. Escríbenos a hola@micompaz.com.`, QUITAR_TECLADO)
      return NextResponse.json({ ok: true })
    }
    const nombre = esc(encontrada?.nombre ?? 'Compita')
    await sendTelegramMessage(
      chatId,
      `✅ <b>¡Listo, ${nombre}!</b> Tu cuenta ya está activa en Compaz. ¡Ya eres parte del equipo! 🎉\n\nAhora te explico todo lo que puedes hacer desde este chat:`,
      QUITAR_TECLADO,
    )
    await sendTelegramMessage(chatId, GUIA_COMPITA, INLINE_INICIO)
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (adminChatId) {
      try {
        await sendTelegramMessage(adminChatId, `🟢 <b>Nueva Compita vinculada</b>\n\n<b>${nombre}</b> activó su cuenta en Telegram.\n\nRevisa su perfil en el panel admin y veríficala cuando esté lista.`)
      } catch (e) { console.error('Error notificando admin:', e) }
    }
    return NextResponse.json({ ok: true })
  }

  // Paso 1: compita ingresó su nombre → buscar y enviar código al email
  if (estado?.registro_pendiente && !compita) {
    if (!text.trim()) return NextResponse.json({ ok: true })
    await setRegistroPendiente(supabase, chatId, false)
    const { data: resultados } = await supabase
      .from('compitas')
      .select('id, nombre, email, codigo')
      .ilike('nombre', `%${escLike(text.trim().slice(0, 80))}%`)
      .limit(5) as { data: Compita[] | null }

    const encontrada = resultados?.length === 1 ? resultados[0] : null
    const ambiguo = (resultados?.length ?? 0) > 1

    if (ambiguo) {
      const ids = (resultados ?? []).map((r) => r.id).join(',')
      const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      await setEstado(supabase, chatId, { pendiente_accion: `desambiguar:${ids}`, pendiente_expira: expira })
      await sendTelegramMessage(
        chatId,
        `Encontré más de una cuenta con ese nombre. Para identificarte, escribe las <b>primeras letras de tu correo</b>.\n\nPor ejemplo, si tu correo es <i>maria.garcia@gmail.com</i>, escribe <b>maria</b>.`,
        QUITAR_TECLADO,
      )
    } else if (!encontrada) {
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(
        chatId,
        `No encontré ninguna cuenta con ese nombre. 🤔\n\nIntenta escribirlo de otra forma. Por ejemplo, si te registraste como "María" prueba con "Maria", o si pusiste solo el primer nombre prueba con el nombre completo.\n\nSi el problema continúa, escríbenos a hola@micompaz.com y te ayudamos.\n\n✍️ Intenta de nuevo:`,
        QUITAR_TECLADO,
      )
    } else {
      await iniciarVerificacion(supabase, chatId, encontrada)
    }
    return NextResponse.json({ ok: true })
  }

  if (!compita) {
    await sendTelegramMessage(
      chatId,
      `Tu cuenta no está vinculada todavía. 👇\n\nToca el botón para comenzar. Solo toma un minuto.`,
      INLINE_START,
    )
    return NextResponse.json({ ok: true })
  }

  // Cuenta inactiva o aún sin verificar: puede usar /perfil y /menu, pero no operar visitas ni solicitudes.
  if (compita.estado !== 'activo' || !compita.verificado) {
    await sendTelegramMessage(
      chatId,
      `Tu cuenta todavía está en revisión. Mientras tanto puedes completar tu perfil con /perfil. Te avisaremos por aquí cuando esté verificada.`,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Iniciar visita ────────────────────────────────────────────────────
  if (text === '▶️ Iniciar visita') {
    const { data: visitaEnCurso } = await supabase
      .from('visitas').select('id').eq('compita_id', compita.id).eq('estado', 'en_curso').limit(1).maybeSingle()
    if (visitaEnCurso) {
      await sendTelegramMessage(chatId, `Ya tienes una visita en curso. Cuando termines, toca el botón rojo. 👇`, INLINE_DURANTE)
      return NextResponse.json({ ok: true })
    }

    const objetivo = await visitaObjetivo(supabase, compita.id)
    if (!objetivo) {
      await sendTelegramMessage(
        chatId,
        `No encontré ninguna visita programada para ti en este momento.\n\nEsto ocurre cuando el cliente todavía no ha registrado la fecha de la visita en el sistema. Una vez que lo haga, podrás iniciarla desde aquí.\n\nSi crees que es un error, escríbenos a hola@micompaz.com.`,
        INLINE_INICIO,
      )
      return NextResponse.json({ ok: true })
    }

    const clienteNombre = esc(objetivo.usuario?.nombre ?? 'tu cliente')
    if (!objetivo.fecha_programada) {
      await sendTelegramMessage(
        chatId,
        `⚠️ <b>La fecha de la visita aún no está confirmada</b>\n\n${clienteNombre} todavía no registró la fecha en el sistema. Escríbele desde este mismo chat para coordinarla. Una vez que la confirme, podrás iniciar la visita desde aquí.`,
        INLINE_INICIO,
      )
      return NextResponse.json({ ok: true })
    }

    const fechaLabel = formatFechaVE(objetivo.fecha_programada)
    // Solo se puede iniciar el día pautado (hoy o, por cruce de medianoche, ayer).
    if (objetivo.fecha_programada !== hoyVE() && objetivo.fecha_programada !== hoyVE(-1)) {
      await sendTelegramMessage(
        chatId,
        objetivo.fecha_programada > hoyVE()
          ? `Tu próxima visita con <b>${clienteNombre}</b> es el <b>${fechaLabel}</b>. Podrás iniciarla ese día.\n\nSi necesitas cambiarla, toca el botón de abajo.`
          : `La visita con <b>${clienteNombre}</b> estaba pautada para el <b>${fechaLabel}</b> y ya pasó. Pídele que registre una nueva fecha o escríbenos a hola@micompaz.com.`,
        INLINE_REAGENDAR_VISITA,
      )
      return NextResponse.json({ ok: true })
    }

    const horarioLabel = objetivo.hora_inicio_programada && objetivo.hora_fin_programada
      ? `${esc(objetivo.hora_inicio_programada)} – ${esc(objetivo.hora_fin_programada)}`
      : null

    await setConfirmacion(supabase, chatId, 'iniciar', objetivo.id)
    await sendTelegramMessage(
      chatId,
      [
        `¿Vas a empezar la visita con <b>${clienteNombre}</b>?`,
        ``,
        `📅 <b>${fechaLabel}</b>`,
        horarioLabel ? `🕐 <b>${horarioLabel}</b>` : '',
        ``,
        `Toca <b>✅ Sí, iniciar</b> para confirmar. La familia sabrá que ya llegaste.`,
        ``,
        `Si surgió algún imprevisto, puedes reagendar tocando el botón de abajo.`,
      ].filter(Boolean).join('\n'),
      INLINE_INICIAR_O_REAGENDAR,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Terminar visita ───────────────────────────────────────────────────
  if (text === '🔴 Terminar visita') {
    const { data: visita } = await supabase
      .from('visitas').select('id').eq('compita_id', compita.id).eq('estado', 'en_curso')
      .order('inicio', { ascending: false }).limit(1).maybeSingle()

    if (!visita) {
      await sendTelegramMessage(chatId, `No tienes ninguna visita en curso en este momento.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }

    await setConfirmacion(supabase, chatId, 'terminar', visita.id)
    await sendTelegramMessage(
      chatId,
      `¿Confirmas que quieres terminar la visita?\n\nToca <b>✅ Sí, terminar</b> para confirmar. Se le enviará un resumen a la familia.`,
      INLINE_CONFIRMAR_FIN,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Cancelar ──────────────────────────────────────────────────────────
  if (text === '❌ Cancelar') {
    await clearConfirmacion(supabase, chatId)
    const { data: visitaActiva } = await supabase
      .from('visitas').select('id').eq('compita_id', compita.id).eq('estado', 'en_curso').limit(1).maybeSingle()
    await sendTelegramMessage(
      chatId,
      `Cancelado. No se hizo ningún cambio.`,
      visitaActiva ? INLINE_DURANTE : INLINE_INICIO,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Emergencia ────────────────────────────────────────────────────────
  if (isCallback && text === 'emergencia') {
    const { data: visitaEmergencia } = await supabase
      .from('visitas')
      .select('id, usuario:usuarios(nombre, email, zona, familiar_nombre, familiar_condicion)')
      .eq('compita_id', compita.id)
      .eq('estado', 'en_curso')
      .order('inicio', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { id: string; usuario: { nombre: string; email: string; zona: string | null; familiar_nombre: string | null; familiar_condicion: string | null } | null } | null }

    const u = visitaEmergencia?.usuario
    const infoCliente = u
      ? [
          `<b>Cliente:</b> ${esc(u.nombre)} (${esc(u.email)})`,
          u.zona ? `<b>Zona:</b> ${esc(u.zona)}` : null,
          u.familiar_nombre ? `<b>Familiar:</b> ${esc(u.familiar_nombre)}` : null,
          u.familiar_condicion ? `<b>Condición:</b> ${esc(u.familiar_condicion)}` : null,
        ].filter(Boolean).join('\n')
      : 'No hay visita activa registrada.'

    const aviso = [`🚨 <b>EMERGENCIA</b>`, ``, `<b>${esc(compita.nombre)}</b> activó el botón de emergencia durante una visita.`, ``, infoCliente, ``, `Contáctalos de inmediato.`].join('\n')

    // Telegram primero; si falla, email al admin como respaldo. Solo se dice "enviada" si realmente salió.
    let notificado = await avisarAdmin(aviso)
    if (!notificado) {
      const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)
      if (admins.length) {
        try { await sendEmail({ to: admins, subject: '🚨 EMERGENCIA en una visita de Compaz', html: `<pre style="font-family:inherit;white-space:pre-wrap">${esc(aviso.replace(/<[^>]+>/g, ''))}</pre>` }); notificado = true }
        catch (e) { console.error('Emergencia: email respaldo falló:', e) }
      }
    }

    await sendTelegramMessage(
      chatId,
      notificado
        ? `🚨 <b>Alerta enviada.</b>\n\nEl equipo de Compaz fue notificado ahora mismo y te contactará de inmediato.\n\nSi hay peligro inmediato, llama al <b>911</b>.`
        : `⚠️ <b>No pudimos avisar al equipo.</b>\n\nLlama ahora al <b>911</b> y escribe a hola@micompaz.com. Intenta tocar el botón de nuevo en unos segundos.`,
      INLINE_DURANTE,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Reagendar visita ──────────────────────────────────────────────────
  if (isCallback && text === 'reagendar_visita') {
    const objetivo = await visitaObjetivo(supabase, compita.id)
    if (!objetivo) {
      await sendTelegramMessage(chatId, `No encontré ninguna visita activa para reagendar.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }

    const fechaAnterior = objetivo.fecha_programada ? formatFechaVE(objetivo.fecha_programada) : null
    const { data: reseteada, error: errReset } = await supabase
      .from('visitas')
      .update({ estado: 'pre_visita', fecha_programada: null })
      .eq('id', objetivo.id)
      .in('estado', ['pre_visita', 'programada'])
      .select('id')
      .maybeSingle()
    if (errReset || !reseteada) {
      console.error('Error reagendando visita:', errReset)
      await sendTelegramMessage(chatId, `No pudimos reagendar la visita. Intenta de nuevo en un momento.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }

    const clienteNombre = esc(objetivo.usuario?.nombre ?? 'El cliente')
    const clienteEmail = objetivo.usuario?.email
    let emailEnviado = false
    if (clienteEmail) {
      try {
        await sendEmail({
          to: clienteEmail,
          subject: `${compita.nombre} necesita reagendar la visita`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px;margin-bottom:12px">🔄 La visita necesita reagendarse</h2>
              <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
                <strong>${esc(compita.nombre)}</strong> tuvo un imprevisto y necesita cambiar la fecha${fechaAnterior ? ` del <strong>${esc(fechaAnterior)}</strong>` : ''}.
              </p>
              <p style="color:#4A3B6B;font-size:14px;line-height:1.6">
                Entra al dashboard y coordinen juntos una nueva fecha por el chat.
              </p>
              <a href="${SITE_URL_PUBLICA}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:14px;margin-top:8px">
                Ir al chat →
              </a>
              <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
        emailEnviado = true
      } catch (e) { console.error('Email reagendar compita→cliente:', e) }
    }

    await sendTelegramMessage(
      chatId,
      [
        `🔄 <b>Visita reagendada</b>`,
        ``,
        emailEnviado
          ? `Le avisamos a <b>${clienteNombre}</b> que necesitas cambiar la fecha${fechaAnterior ? ` del ${esc(fechaAnterior)}` : ''}.`
          : `Registramos el cambio de fecha${fechaAnterior ? ` del ${esc(fechaAnterior)}` : ''}, pero no pudimos enviar el correo a <b>${clienteNombre}</b>. Escríbele desde este chat para avisarle.`,
        ``,
        `Escríbele desde este mismo chat para acordar un nuevo día. Ellos lo verán en su portal.`,
      ].join('\n'),
      INLINE_INICIO,
    )

    // Alerta al admin si esta visita acumula 3+ reagendados
    try {
      const { count: totalReagendados } = await supabase
        .from('mensajes').select('id', { count: 'exact', head: true })
        .eq('visit_id', objetivo.id).eq('origen', 'admin').like('contenido', 'reagendado:%')
      const nuevo = (totalReagendados ?? 0) + 1
      await supabase.from('mensajes').insert({ visit_id: objetivo.id, origen: 'admin', tipo: 'texto', contenido: `reagendado:compita` })
      if (nuevo >= 3) {
        await avisarAdmin([`⚠️ <b>Visita con ${nuevo} reagendados</b>`, ``, `<b>Cliente:</b> ${clienteNombre}`, `<b>Compita:</b> ${esc(compita.nombre)}`, `<b>Iniciador:</b> compita`, ``, `Puede indicar un problema de coordinación. Considera intervenir.`].join('\n'))
      }
    } catch (e) { console.error('Alerta reagendados admin (compita):', e) }

    return NextResponse.json({ ok: true })
  }

  // ── Solicitud: aceptar slot ──────────────────────────────────────────────────
  if (isCallback && text.startsWith('slot:')) {
    const partes = text.split(':')
    const slotIndex = parseInt(partes[1], 10)
    const token = partes.slice(2).join(':')

    const r = await responderSolicitud(token, slotIndex, compita.id)
    if (!r.ok) {
      await sendTelegramMessage(
        chatId,
        r.motivo === 'slot_pasado'
          ? `Ese horario ya pasó o está por empezar. Pídele al cliente que proponga nuevos horarios o usa otra opción.`
          : r.motivo === 'no_autorizada'
            ? `Esta solicitud no es tuya.`
            : `Este enlace ya fue usado o no existe.`,
        INLINE_INICIO,
      )
      return NextResponse.json({ ok: true })
    }
    const solicitud = r.solicitud

    const slotLabel = formatSlotVE(solicitud.slot_confirmado!)
    const adminSupa = createAdminSupabase()
    const { data: cliente } = await adminSupa
      .from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()

    let emailOk = !cliente?.email
    if (cliente?.email) {
      try {
        await sendEmail({
          to: cliente.email,
          subject: `Tu llamada con ${compita.nombre} está confirmada`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">¡Llamada confirmada!</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                <strong>${esc(compita.nombre)}</strong> confirmó la llamada para el:<br>
                <strong>${esc(slotLabel)}</strong>
              </p>
              <p style="color:#4A3B6B;background:#F5F0E8;border:2px solid #D4C9E8;border-radius:12px;padding:14px;font-size:14px">
                📩 Te enviaremos el link de acceso a la llamada <strong>1 hora antes</strong>.
              </p>
              <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
        emailOk = true
      } catch (e) { console.error('Email cliente confirmación:', e) }
    }

    await avisarAdmin([
      `📞 <b>Entrevista confirmada</b>`, ``,
      `<b>Cliente:</b> ${esc(cliente?.nombre ?? '')} (${esc(cliente?.email ?? '')})`,
      `<b>Compita:</b> ${esc(compita.nombre)}`,
      `<b>Fecha:</b> ${esc(slotLabel)}`, ``,
      emailOk ? `🔗 El link de sala se generará y enviará 1 hora antes.` : `⚠️ No se pudo enviar el correo de confirmación al cliente. Avísale manualmente.`,
    ].join('\n'))

    await sendTelegramMessage(
      chatId,
      `✅ <b>Llamada confirmada</b>\n\n<b>Cliente:</b> ${esc(cliente?.nombre ?? 'Cliente')}\n<b>Fecha y hora:</b> ${esc(slotLabel)}\n\n📩 Te enviaremos el link de acceso <b>1 hora antes</b> de la llamada.`,
      INLINE_INICIO,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Solicitud: rechazar ──────────────────────────────────────────────────────
  if (isCallback && text.startsWith('rechazar:')) {
    const token = text.slice('rechazar:'.length)
    const r = await responderSolicitud(token, -1, compita.id)
    if (!r.ok) {
      await sendTelegramMessage(chatId, `Este enlace ya fue usado o no existe.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }
    const solicitud = r.solicitud

    await avisarAdmin(`❌ <b>${esc(compita.nombre)}</b> rechazó una solicitud de entrevista.`)

    const adminSupa = createAdminSupabase()
    const { data: clienteRechazado } = await adminSupa
      .from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()
    const clienteEmail = clienteRechazado?.email ?? ''
    const clienteNombre = clienteRechazado?.nombre ?? 'el cliente'
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await setEstado(supabase, chatId, {
      pendiente_accion: `sugerir_horarios:${solicitud.id}:${clienteEmail}:${clienteNombre}`,
      pendiente_expira: expira,
    })

    await sendTelegramMessage(
      chatId,
      `Entendido. ¿Puedes sugerir otros horarios que sí te funcionen?\n\n✍️ <b>Responde a este mensaje</b> con los horarios y se los haremos llegar a ${esc(clienteNombre)} por email.\n\n📅 <i>Incluye el día y la hora exacta de cada opción. Por ejemplo: lunes 6 de octubre a las 3:00pm.</i>`,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Confirmar (iniciar o terminar) ────────────────────────────────────
  if (text === '✅ Sí, iniciar' || text === '✅ Sí, terminar') {
    const esperada = text === '✅ Sí, iniciar' ? 'iniciar' : 'terminar'
    const conf = await takeConfirmacion(supabase, chatId, esperada)
    if (!conf) {
      await sendTelegramMessage(chatId, `El tiempo para confirmar expiró o ya se procesó. Si hace falta, intenta de nuevo.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }

    // ── Confirmar inicio ───────────────────────────────────────────────────────
    if (conf.accion === 'iniciar') {
      const ahora = new Date().toISOString()
      // Reclamo atómico: solo pasa si sigue programada/pre_visita, con fecha confirmada y de esta compita.
      const { data: visita, error: errInicio } = await supabase
        .from('visitas')
        .update({ estado: 'en_curso', inicio: ahora })
        .eq('id', conf.visitaId)
        .eq('compita_id', compita.id)
        .in('estado', ['programada', 'pre_visita'])
        .not('fecha_programada', 'is', null)
        .select('*, usuario:usuarios(*)')
        .maybeSingle() as { data: (Visita & { usuario: Usuario | null }) | null; error: { code?: string } | null }

      if (errInicio || !visita || !visita.usuario) {
        console.error('Error iniciando visita:', errInicio)
        await sendTelegramMessage(
          chatId,
          errInicio?.code === '23505'
            ? `Ya tienes una visita en curso. Termínala antes de iniciar otra.`
            : `No pudimos iniciar la visita (puede que la fecha ya no esté confirmada). Intenta de nuevo o escríbenos a hola@micompaz.com.`,
          INLINE_INICIO,
        )
        return NextResponse.json({ ok: true })
      }
      const usuario = visita.usuario

      const perfilLineas: string[] = []
      if (usuario.familiar_nombre) perfilLineas.push(`<b>Nombre:</b> ${esc(usuario.familiar_nombre)}`)
      if (usuario.familiar_edad) perfilLineas.push(`<b>Edad:</b> ${esc(usuario.familiar_edad)} años`)
      if (usuario.familiar_condicion) perfilLineas.push(`<b>Condición:</b> ${esc(usuario.familiar_condicion)}`)
      if (usuario.familiar_notas) perfilLineas.push(`<b>Notas:</b> ${esc(usuario.familiar_notas)}`)
      const perfilTexto = perfilLineas.length > 0 ? `\n\n👤 <b>Perfil del familiar:</b>\n${perfilLineas.join('\n')}` : ''

      await sendTelegramMessage(
        chatId,
        `✅ <b>¡Visita iniciada!</b>\n\nEstás con <b>${esc(usuario.nombre)}</b>. La familia ya sabe que llegaste.${perfilTexto}\n\n📸 <b>Puedes mandar fotos y mensajes</b> desde aquí durante la visita — la familia los verá en tiempo real.\n\nCuando termines, toca el botón rojo de abajo. 👇`,
        INLINE_DURANTE,
      )

      try { await sendVisitaInicio(usuario, compita, visita) }
      catch (e) {
        console.error('Error correo inicio:', e)
        await avisarAdmin(`⚠️ No se pudo enviar el correo de inicio de visita a <b>${esc(usuario.nombre)}</b> (${esc(usuario.email)}).`)
      }

      const horaInicio = new Date(ahora).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas', hour12: true })
      await avisarAdmin(`▶️ <b>Visita iniciada</b>\n\n<b>Compita:</b> ${esc(compita.nombre)}\n<b>Cliente:</b> ${esc(usuario.nombre)}\n<b>Hora:</b> ${horaInicio}`)
    }

    // ── Confirmar fin ─────────────────────────────────────────────────────────
    if (conf.accion === 'terminar') {
      const fin = new Date().toISOString()
      const { data: visita, error: errFin } = await supabase
        .from('visitas')
        .update({ estado: 'terminada', fin, room_url: null })
        .eq('id', conf.visitaId)
        .eq('compita_id', compita.id)
        .eq('estado', 'en_curso')
        .select('*, usuario:usuarios(*)')
        .maybeSingle() as { data: (Visita & { usuario: Usuario | null }) | null; error: unknown }

      if (errFin || !visita) {
        await sendTelegramMessage(chatId, `No hay ninguna visita en curso que puedas terminar ahora mismo.\n\nSi crees que es un error, escríbenos a hola@micompaz.com.`, INLINE_INICIO)
        return NextResponse.json({ ok: true })
      }

      // Contador: lectura fresca (la copia de `compita` puede estar desactualizada).
      const { data: fresca } = await supabase.from('compitas').select('visitas_realizadas').eq('id', compita.id).single()
      await supabase.from('compitas').update({ visitas_realizadas: (fresca?.visitas_realizadas ?? 0) + 1 }).eq('id', compita.id)

      const duracionMin = Math.round((new Date(fin).getTime() - new Date(visita.inicio!).getTime()) / 60000)
      const duracion = duracionMin >= 60 ? `${Math.floor(duracionMin / 60)}h ${duracionMin % 60}min` : `${duracionMin} min`
      await avisarAdmin(`✅ <b>Visita terminada</b>\n\n<b>Compita:</b> ${esc(compita.nombre)}\n<b>Cliente:</b> ${esc(visita.usuario?.nombre ?? '—')}\n<b>Duración:</b> ${duracion}`)

      if (visita.usuario) {
        try {
          const { data: mensajes } = await supabase
            .from('mensajes').select('*').eq('visit_id', visita.id).order('created_at', { ascending: true }) as { data: Mensaje[] | null }
          await sendVisitaResumen(visita.usuario, compita, { ...visita, fin }, mensajes ?? [])
        } catch (e) {
          console.error('Error correo básico al terminar:', e)
          await avisarAdmin(`⚠️ No se pudo enviar el resumen de visita a <b>${esc(visita.usuario.nombre)}</b> (${esc(visita.usuario.email)}). Reenvíalo manualmente.`)
        }
      }

      await setEstado(supabase, chatId, {
        pendiente_accion: `reporte:${visita.id}:0:`,
        pendiente_expira: new Date(Date.now() + 30 * 60_000).toISOString(),
      })

      await sendTelegramMessage(
        chatId,
        `🔴 <b>Visita terminada.</b>\n\n¡Gracias por tu trabajo de hoy, ${esc(compita.nombre)}! 🤝\n\nYa le enviamos el resumen básico a la familia. Ahora tómate un minuto para registrar cómo estuvo el familiar — ellos lo verán como una actualización. 📋`,
      )
      await sendTelegramMessage(
        chatId,
        `1 de 4 — ${PREGUNTAS_REPORTE[0].emoji} <b>${PREGUNTAS_REPORTE[0].label}</b>\n\n${PREGUNTAS_REPORTE[0].texto}\n\n<i>1 = muy bajo, 5 = excelente</i>`,
        makeReporteKeyboard(),
      )
    }

    return NextResponse.json({ ok: true })
  }

  // ── Sugerencia de horarios alternativos tras rechazo ────────────────────────
  const estadoActual = await getEstado(supabase, chatId)
  const accionSugerir = estadoActual?.pendiente_accion
  const esSugerir = accionSugerir?.startsWith('sugerir_horarios:') || accionSugerir?.startsWith('sugerir_r:')
  let capturaSugerencia = false
  if (esSugerir && !isCallback && text && !text.startsWith('/')) {
    // Si la compita tiene visitas activas, solo se captura si responde al mensaje del bot;
    // así un mensaje normal de visita no se filtra por email a otro cliente.
    const { count: activas } = await supabase
      .from('visitas').select('id', { count: 'exact', head: true })
      .eq('compita_id', compita.id).in('estado', ['en_curso', 'pre_visita', 'programada'])
    capturaSugerencia = !!message.reply_to_message || (activas ?? 0) === 0
  }
  if (capturaSugerencia) {
    const prefijo = accionSugerir!.startsWith('sugerir_r:') ? 'sugerir_r:' : 'sugerir_horarios:'
    const partes = accionSugerir!.slice(prefijo.length).split(':')
    // formato: <solicitud_id>:<email>:<nombre> (nombre puede tener espacios pero fue el último segmento)
    const [solicitudId, clienteEmail, ...nombrePartes] = partes
    const clienteNombre = nombrePartes.join(':')
    const expirado = estadoActual?.pendiente_expira ? new Date(estadoActual.pendiente_expira) < new Date() : true

    await clearPendiente(supabase, chatId)

    if (expirado) {
      await sendTelegramMessage(chatId, `El tiempo para sugerir horarios expiró. Contacta al equipo de Compaz si necesitas ayuda.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }

    // Enviar email al cliente con los horarios sugeridos
    let emailHorarioEnviado = false
    if (clienteEmail) {
      try {
        await sendEmail({
          to: clienteEmail,
          subject: `${compita.nombre} te propone otros horarios`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">Nuevos horarios disponibles</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                <strong>${esc(compita.nombre)}</strong> no pudo en los horarios que propusiste, pero sugiere lo siguiente:
              </p>
              <blockquote style="background:#F5F0FF;border-left:4px solid #7C4DFF;border-radius:8px;padding:16px 20px;color:#1A0A3C;font-size:16px;line-height:1.6;margin:16px 0">
                ${esc(text.slice(0, 1500)).replace(/\n/g, '<br>')}
              </blockquote>
              <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
                Si alguno te funciona, haz clic aquí para enviar una nueva solicitud directamente con ${esc(compita.nombre)}:
              </p>
              <a href="${SITE_URL}/compitas?compita=${encodeURIComponent(compita.id)}&reagendar=${encodeURIComponent(solicitudId)}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:4px">
                Agendar con ${esc(compita.nombre)} →
              </a>
              <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
        emailHorarioEnviado = true
      } catch (e) { console.error('Email horarios alternativos:', e) }
    }

    if (emailHorarioEnviado) {
      await sendTelegramMessage(
        chatId,
        `✅ Listo. Le enviamos tus horarios a ${esc(clienteNombre || 'el cliente')} por email.\n\nSi acepta, te llegará una nueva solicitud por aquí.`,
      )
    } else {
      await sendTelegramMessage(
        chatId,
        `⚠️ No pudimos enviarle tus horarios al cliente (sin correo registrado o el envío falló). Por favor escríbenos a hola@micompaz.com y lo resolvemos manualmente.`,
        INLINE_INICIO,
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Reanudar cuestionario desde recordatorio ────────────────────────────────
  if (isCallback && text === 'reanudar_reporte') {
    const estadoReanuda = await getEstado(supabase, chatId)
    const accionReanuda = estadoReanuda?.pendiente_accion ?? ''
    if (!accionReanuda.startsWith('reporte:') && !accionReanuda.startsWith('reporte_r:') && !accionReanuda.startsWith('reporte_novedad:')) {
      await sendTelegramMessage(chatId, `Ya no hay un cuestionario pendiente.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }
    // Extender expiración otros 30 min y restaurar prefijo reporte: (si estaba como reporte_r:)
    const accionRestaurada = accionReanuda.replace('reporte_r:', 'reporte:')
    await supabase.from('telegram_estados').update({ pendiente_accion: accionRestaurada, pendiente_expira: new Date(Date.now() + 30 * 60_000).toISOString() }).eq('chat_id', chatId)
    if (accionRestaurada.startsWith('reporte_novedad:')) {
      await sendTelegramMessage(chatId, `📝 <b>¿Hay algo que quieras contarle a la familia?</b>\n\nEscríbelo aquí — puede ser una anécdota, un avance que notaste, algo que le gustó especialmente, o cualquier detalle que creas que les daría paz o alegría.`, QUITAR_TECLADO)
    } else {
      const partes = accionRestaurada.split(':')
      const step = parseInt(partes[2] ?? '0', 10)
      if (step < PREGUNTAS_REPORTE.length) {
        const pregunta = PREGUNTAS_REPORTE[step]
        await sendTelegramMessage(
          chatId,
          `${step + 1} de 4 — ${pregunta.emoji} <b>${pregunta.label}</b>\n\n${pregunta.texto}\n\n<i>1 = muy bajo, 5 = excelente</i>`,
          makeReporteKeyboard(),
        )
      } else {
        await clearPendiente(supabase, chatId)
        await sendTelegramMessage(chatId, `Ya no hay un cuestionario pendiente.`, INLINE_INICIO)
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── Respuesta a cuestionario de bienestar (callback rr:value) ───────────────
  if (isCallback && text.startsWith('rr:')) {
    const estadoActualRR = await getEstado(supabase, chatId)
    const accionRaw = estadoActualRR?.pendiente_accion ?? ''
    const accion = accionRaw.replace('reporte_r:', 'reporte:') // normalizar si llegó marcado
    if (!accion.startsWith('reporte:')) {
      await sendTelegramMessage(chatId, `Ya no hay un cuestionario activo.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }
    const partes = accion.split(':')
    // formato: reporte:{visita_id}:{step}:{answers_csv}
    const visitaId = partes[1]
    const step = parseInt(partes[2], 10)
    const answersSoFar = partes[3] ?? ''
    const valor = text.slice(3) // '1'..'5' or 'N'

    const newAnswers = answersSoFar ? `${answersSoFar},${valor}` : valor
    const nextStep = step + 1

    if (nextStep < PREGUNTAS_REPORTE.length) {
      // Siguiente pregunta
      await setEstado(supabase, chatId, {
        pendiente_accion: `reporte:${visitaId}:${nextStep}:${newAnswers}`,
        pendiente_expira: new Date(Date.now() + 30 * 60_000).toISOString(),
      })
      const q = PREGUNTAS_REPORTE[nextStep]
      await sendTelegramMessage(
        chatId,
        `${nextStep + 1} de 4 — ${q.emoji} <b>${q.label}</b>\n\n${q.texto}\n\n<i>1 = muy bajo, 5 = excelente</i>`,
        makeReporteKeyboard(),
      )
    } else {
      // Últimas respuesta (entorno) — pasar a novedad
      await setEstado(supabase, chatId, {
        pendiente_accion: `reporte_novedad:${visitaId}:${newAnswers}`,
        pendiente_expira: new Date(Date.now() + 30 * 60_000).toISOString(),
      })
      await sendTelegramMessage(
        chatId,
        `✍️ <b>Por último:</b> ¿Hubo alguna novedad importante que la familia deba saber?\n\nEscríbela aquí, o toca el botón si no hay nada que reportar.`,
        makeInlineKeyboard([[{ text: 'Sin novedad', callback_data: 'rn:skip' }]]),
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Sin novedad (callback rn:skip) ───────────────────────────────────────────
  if (isCallback && text === 'rn:skip') {
    const estadoRN = await getEstado(supabase, chatId)
    const accion = estadoRN?.pendiente_accion ?? ''
    if (accion.startsWith('reporte_novedad:')) {
      await guardarReporteYEnviarEmail(supabase, chatId, compita, accion, null)
    } else {
      await sendTelegramMessage(chatId, `Ya no hay un cuestionario activo.`, INLINE_INICIO)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Texto de novedad (estado reporte_novedad) ─────────────────────────────────
  {
    const estadoNov = await getEstado(supabase, chatId)
    if (!isCallback && estadoNov?.pendiente_accion?.startsWith('reporte_novedad:') && text && !text.startsWith('/')) {
      const expiradoNov = estadoNov.pendiente_expira ? new Date(estadoNov.pendiente_expira) < new Date() : true
      if (expiradoNov) {
        await clearPendiente(supabase, chatId)
        await sendTelegramMessage(chatId, `El tiempo para completar el cuestionario expiró. Si quieres registrarlo de todas formas, escríbenos a hola@micompaz.com.`, INLINE_INICIO)
        return NextResponse.json({ ok: true })
      }
      await guardarReporteYEnviarEmail(supabase, chatId, compita, estadoNov.pendiente_accion, text)
      return NextResponse.json({ ok: true })
    }
  }

  // ── Mensajes y fotos durante visita activa o coordinación pre-visita ──────────
  // Solo procesar si no es un callback (los callbacks no tienen contenido multimedia)
  if (!isCallback) {
    const { data: activas } = await supabase
      .from('visitas')
      .select('id, estado')
      .eq('compita_id', compita.id)
      .in('estado', ['en_curso', 'pre_visita', 'programada'])
      .order('created_at', { ascending: false }) as { data: { id: string; estado: string }[] | null }
    // La visita en curso tiene prioridad; si no, la más reciente en coordinación.
    const visitaActiva = (activas ?? []).find((v) => v.estado === 'en_curso') ?? (activas ?? [])[0] ?? null

    if (!visitaActiva) {
      await sendTelegramMessage(
        chatId,
        `No hay ninguna visita activa ahora mismo.\n\nCuando llegues donde tu cliente, toca el botón de abajo. 👇`,
        INLINE_INICIO,
      )
      return NextResponse.json({ ok: true })
    }

    // Foto: se guarda solo el file_id ("tg:<id>"). La imagen se sirve por /api/foto/[id];
    // NUNCA guardar la URL de descarga de Telegram porque contiene el token del bot.
    if (message.photo && message.photo.length > 0) {
      const photo = message.photo[message.photo.length - 1]
      const { error: errFoto } = await supabase
        .from('mensajes')
        .insert({ visit_id: visitaActiva.id, origen: 'compita', tipo: 'foto', contenido: `tg:${photo.file_id}` })
      if (errFoto) {
        console.error('Error guardando foto:', errFoto)
        await sendTelegramMessage(chatId, `No pudimos guardar la foto. Intenta enviarla de nuevo.`)
        return NextResponse.json({ ok: true })
      }
      if (message.caption?.trim()) {
        await supabase.from('mensajes').insert({ visit_id: visitaActiva.id, origen: 'compita', tipo: 'texto', contenido: message.caption.trim().slice(0, 1000) })
      }
      return NextResponse.json({ ok: true })
    }

    // Texto — ignorar comandos desconocidos (excepto /perfil y /menu)
    if (text.startsWith('/')) {
      if (text === '/menu' || text === '/ayuda' || text === 'cmd_menu') {
        await sendTelegramMessage(chatId, GUIA_COMPITA, INLINE_DURANTE)
      } else if (text === '/perfil') {
        try {
          const token = await generarTokenPerfil(compita.id)
          const url = `${SITE_URL}/compita/perfil?token=${token}`
          await sendTelegramMessage(chatId, `✏️ <a href="${url}">Editar mi perfil</a> — válido 24 h, un solo uso.`, INLINE_DURANTE)
        } catch { await sendTelegramMessage(chatId, `Error generando enlace. Intenta de nuevo.`, INLINE_DURANTE) }
      } else {
        await sendTelegramMessage(chatId, `No reconozco ese comando. Usa los botones de abajo. 👇`, INLINE_DURANTE)
      }
      return NextResponse.json({ ok: true })
    }

    if (!text) {
      // Voz, video, documentos, stickers: no se reenvían. Avisar para que no crea que llegaron.
      await sendTelegramMessage(chatId, `Por ahora solo puedo reenviar <b>texto y fotos</b> a la familia. Ese archivo no se envió.`)
      return NextResponse.json({ ok: true })
    }

    const contenido = text.slice(0, 1000)
    const { error: errMsg } = await supabase
      .from('mensajes')
      .insert({ visit_id: visitaActiva.id, origen: 'compita', tipo: 'texto', contenido })
    if (errMsg) {
      console.error('Error guardando mensaje de compita:', errMsg)
      await sendTelegramMessage(chatId, `No pudimos entregar tu mensaje. Intenta enviarlo de nuevo.`)
      return NextResponse.json({ ok: true })
    }
    if (text.length > 1000) {
      await sendTelegramMessage(chatId, `Tu mensaje era muy largo: se envió solo la primera parte (1000 caracteres).`)
    }

    // Email al cliente cuando la compita escribe — throttling: 1 email cada 10 min por visita
    if (visitaActiva.estado === 'programada' || visitaActiva.estado === 'en_curso') {
      try {
        const hace10min = new Date(Date.now() - 10 * 60_000).toISOString()
        const { count: emailsRecientes } = await supabase
          .from('mensajes')
          .select('id', { count: 'exact', head: true })
          .eq('visit_id', visitaActiva.id)
          .eq('origen', 'admin')
          .eq('contenido', 'email_notif_mensaje')
          .gt('created_at', hace10min)

        if ((emailsRecientes ?? 0) === 0) {
          const { data: clienteMensaje } = await supabase
            .from('visitas')
            .select('usuario:usuarios(nombre, email)')
            .eq('id', visitaActiva.id)
            .single() as { data: { usuario: { nombre: string; email: string } | null } | null }
          const emailCliente = clienteMensaje?.usuario?.email
          if (emailCliente) {
            const { error: throttleError } = await supabase.from('mensajes').insert({
              visit_id: visitaActiva.id, origen: 'admin', tipo: 'texto', contenido: 'email_notif_mensaje',
            })
            if (!throttleError) {
              try {
                await sendEmail({
                  to: emailCliente,
                  subject: `${compita.nombre} te escribió en Compaz`,
                  html: `
                    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
                      <h2 style="color:#2D1464;font-size:20px;margin-bottom:12px">💬 Nuevo mensaje de ${esc(compita.nombre)}</h2>
                      <div style="background:#F5F0FF;border-left:4px solid #7C4DFF;border-radius:8px;padding:16px 20px;margin:16px 0;color:#1A0A3C;font-size:15px;line-height:1.6">
                        ${esc(contenido).replace(/\n/g, '<br>')}
                      </div>
                      <a href="${SITE_URL_PUBLICA}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:14px;margin-top:8px">
                        Ver en el dashboard →
                      </a>
                      <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
                    </div>
                  `,
                })
              } catch (e) {
                // Si el email falló, soltar el marcador para que el próximo mensaje reintente.
                console.error('Email compita→cliente en mensaje:', e)
                await supabase.from('mensajes').delete().eq('visit_id', visitaActiva.id).eq('origen', 'admin').eq('contenido', 'email_notif_mensaje').gt('created_at', hace10min)
              }
            }
          }
        }
      } catch (e) { console.error('Email compita→cliente en mensaje:', e) }
    }

    // Recordatorio anti-fuga cada 5 mensajes durante pre_visita
    if (visitaActiva.estado === 'pre_visita') {
      const { count } = await supabase
        .from('mensajes')
        .select('id', { count: 'exact', head: true })
        .eq('visit_id', visitaActiva.id)
        .eq('origen', 'compita')
      if (count && count % 5 === 0) {
        await sendTelegramMessage(
          chatId,
          `💙 <i>Recuerda que toda la comunicación con tu cliente debe mantenerse dentro de Compaz. Coordinar servicios fuera de la plataforma va contra las condiciones de uso y puede resultar en la suspensión de tu cuenta. ¡Sabemos que estás haciendo un gran trabajo!</i>`,
        )
      }
    }
  }

  return NextResponse.json({ ok: true })
}
