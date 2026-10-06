import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import {
  validateTelegramWebhook,
  sendTelegramMessage,
  getTelegramFileUrl,
  answerCallbackQuery,
  editMessageReplyMarkup,
  INLINE_INICIO,
  INLINE_DURANTE,
  INLINE_CONFIRMAR_INICIO,
  INLINE_CONFIRMAR_FIN,
  INLINE_START,
  QUITAR_TECLADO,
  makeInlineKeyboard,
} from '@/lib/telegram'
import { generarTokenPerfil } from '@/lib/compita-tokens'
import { sendVisitaInicio, sendVisitaResumen, sendResumenConReporte, sendCodigoTelegram } from '@/lib/resend'
import { confirmarSlot } from '@/lib/solicitudes'
import { Resend } from 'resend'

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatSlotVE(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}
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
async function setPendiente(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, accion: 'iniciar' | 'terminar') {
  const expira = new Date(Date.now() + 300_000).toISOString()
  await setEstado(supabase, chatId, { pendiente_accion: accion, pendiente_expira: expira })
}
async function clearPendiente(supabase: ReturnType<typeof createAdminSupabase>, chatId: string) {
  await setEstado(supabase, chatId, { pendiente_accion: null, pendiente_expira: null })
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

  // Obtener visita con usuario
  const { data: visita } = await supabase
    .from('visitas')
    .select('*, usuario:usuarios(*)')
    .eq('id', visitaId)
    .single() as { data: (Visita & { usuario: Usuario }) | null }

  await clearPendiente(supabase, chatId)

  if (!visita || !visita.usuario) {
    await sendTelegramMessage(chatId, `Gracias. El cuestionario fue registrado. ¡Hasta la próxima! 😊`, INLINE_INICIO)
    return
  }

  // Reportes anteriores del mismo cliente (vía sus visitas)
  const { data: visitasCliente } = await supabase
    .from('visitas')
    .select('id')
    .eq('usuario_id', visita.usuario_id)
    .neq('id', visitaId)
    .eq('estado', 'terminada')

  type HistorialRow = { animo: number | null; fisico: number | null; participacion: number | null; entorno: number | null; created_at: string }
  let historial: HistorialRow[] = []
  if (visitasCliente && visitasCliente.length > 0) {
    const visitaIds = visitasCliente.map((v) => v.id)
    const { data: reportesPrevios } = await supabase
      .from('reportes_visita')
      .select('animo, fisico, participacion, entorno, created_at')
      .in('visita_id', visitaIds)
      .order('created_at', { ascending: true })
    historial = (reportesPrevios ?? []) as HistorialRow[]
  }

  // Guardar reporte en BD
  const { data: reporteGuardado, error: reporteError } = await supabase
    .from('reportes_visita')
    .insert({ visita_id: visitaId, ...reporte })
    .select('id')
    .single()

  if (reporteError || !reporteGuardado) {
    console.error('Error guardando reporte_visita:', reporteError)
    await sendTelegramMessage(chatId, `Hubo un problema guardando el cuestionario. Por favor escríbenos a hola@micompaz.com para que lo registremos manualmente.`, INLINE_INICIO)
    return
  }

  // Enviar segundo email con indicadores de bienestar y resumen IA
  try {
    const { data: mensajes } = await supabase
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
    if (reporteGuardado?.id && resumenIA) {
      await supabase.from('reportes_visita').update({ resumen_ia: resumenIA }).eq('id', reporteGuardado.id)
    }
  } catch (e) { console.error('Error correo resumen con reporte:', e) }

  await sendTelegramMessage(
    chatId,
    `✅ <b>¡Listo!</b> El cuestionario fue guardado y se le envió el resumen a la familia.\n\n¡Gracias por tu trabajo, ${compita.nombre}! 💙`,
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
    .single() as { data: Compita | null }

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
          `¡Hola de nuevo, <b>${compita.nombre}</b>! 👋\n\nTodo está listo. Cuando llegues a casa de tu cliente y vayas a comenzar, toca el botón <b>▶️ Iniciar visita</b>. Cuando termines, toca <b>🔴 Terminar visita</b>.`,
          INLINE_INICIO,
        )
      } else {
        await sendTelegramMessage(
          chatId,
          `¡Hola de nuevo, <b>${compita.nombre}</b>! 👋\n\nTu cuenta está activa. Todavía no tienes un cliente asignado, pero cuando eso cambie te avisaremos aquí.\n\nMientras tanto, puedes actualizar tu perfil con <b>/perfil</b> para que las familias te conozcan mejor.`,
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
      .ilike('email', `${text.trim()}%`) as { data: Compita[] | null }

    if (!candidatas || candidatas.length === 0) {
      await setRegistroPendiente(supabase, chatId, true)
      await clearPendiente(supabase, chatId)
      await sendTelegramMessage(chatId, `No encontré ninguna cuenta con esas letras de correo. 🤔\n\nEscríbenos a hola@micompaz.com y te ayudamos a activar tu cuenta.\n\n✍️ O escribe tu nombre de nuevo para intentarlo:`, QUITAR_TECLADO)
    } else if (candidatas.length > 1) {
      await clearPendiente(supabase, chatId)
      await sendTelegramMessage(chatId, `No pude identificarte con esa información. Por favor escríbenos a hola@micompaz.com y te activamos la cuenta manualmente.`, QUITAR_TECLADO)
    } else {
      const encontrada = candidatas[0]
      const codigo = String(Math.floor(100000 + Math.random() * 900000))
      const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      await setEstado(supabase, chatId, { pendiente_accion: `verificar:${codigo}:${encontrada.id}`, pendiente_expira: expira })
      if (encontrada.email) {
        try { await sendCodigoTelegram(encontrada.email, encontrada.nombre, codigo) } catch (e) { console.error('Error enviando código:', e) }
        await sendTelegramMessage(chatId, `Encontré tu cuenta 👀\n\nTe enviamos un <b>código de 6 dígitos</b> al correo <b>${encontrada.email}</b>.\n\n✍️ Escríbelo aquí cuando lo recibas:`, QUITAR_TECLADO)
      } else {
        const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
        if (adminChatId) { try { await sendTelegramMessage(adminChatId, `🔐 <b>Verificación de Compita</b>\n\n<b>${encontrada.nombre}</b> quiere activar su cuenta.\n\nCódigo: <code>${codigo}</code>\n\nExpira en 15 minutos.`) } catch (e) { console.error(e) } }
        await sendTelegramMessage(chatId, `Encontré tu cuenta 👀\n\nPor seguridad, te enviamos un <b>código de 6 dígitos</b> a través del admin de Compaz.\n\n✍️ Escríbelo aquí cuando lo recibas:`, QUITAR_TECLADO)
      }
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
    await supabase.from('compitas').update({ telegram_chat_id: chatId }).eq('id', compitaId).is('telegram_chat_id', null)
    const nombre = encontrada?.nombre ?? 'Compita'
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
      .ilike('nombre', `%${text.trim()}%`)
      .is('telegram_chat_id', null)
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
      const codigo = String(Math.floor(100000 + Math.random() * 900000))
      const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      await setEstado(supabase, chatId, { pendiente_accion: `verificar:${codigo}:${encontrada.id}`, pendiente_expira: expira })

      if (encontrada.email) {
        try {
          await sendCodigoTelegram(encontrada.email, encontrada.nombre, codigo)
        } catch (e) { console.error('Error enviando código por email:', e) }
        await sendTelegramMessage(
          chatId,
          `Encontré tu cuenta 👀\n\nTe enviamos un <b>código de 6 dígitos</b> al correo <b>${encontrada.email}</b>.\n\n✍️ Escríbelo aquí cuando lo recibas:`,
          QUITAR_TECLADO,
        )
      } else {
        const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
        if (adminChatId) {
          try {
            await sendTelegramMessage(
              adminChatId,
              `🔐 <b>Verificación de Compita</b>\n\n<b>${encontrada.nombre}</b> quiere activar su cuenta en Telegram.\n\nCódigo: <code>${codigo}</code>\n\nExpira en 15 minutos.`,
            )
          } catch (e) { console.error('Error notificando admin:', e) }
        }
        await sendTelegramMessage(
          chatId,
          `Encontré tu cuenta 👀\n\nPor seguridad, te enviamos un <b>código de 6 dígitos</b> a través del admin de Compaz.\n\n✍️ Escríbelo aquí cuando lo recibas:`,
          QUITAR_TECLADO,
        )
      }
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

  // ── Botón: Iniciar visita ────────────────────────────────────────────────────
  if (text === '▶️ Iniciar visita') {
    const { data: visitaActiva } = await supabase
      .from('visitas')
      .select('id')
      .eq('compita_id', compita.id)
      .eq('estado', 'en_curso')
      .single()

    if (visitaActiva) {
      await sendTelegramMessage(chatId, `Ya tienes una visita en curso. Cuando termines, toca el botón rojo. 👇`, INLINE_DURANTE)
      return NextResponse.json({ ok: true })
    }

    // Solo permitir iniciar visita si hay al menos una solicitud completada o contratada para este compita
    const { data: solicitudActiva } = await supabase
      .from('solicitudes')
      .select('id, cliente_id')
      .eq('compita_id', compita.id)
      .in('estado', ['completada', 'contratada'])
      .limit(1)
      .maybeSingle()

    if (!solicitudActiva) {
      await sendTelegramMessage(
        chatId,
        `No encontré ninguna visita programada para ti en este momento.\n\nEsto puede pasar si el cliente aún no ha confirmado la contratación, o si hubo un problema con tu cuenta.\n\nSi crees que es un error, escríbenos a hola@micompaz.com y te ayudamos a resolverlo.`,
        INLINE_INICIO,
      )
      return NextResponse.json({ ok: true })
    }

    const { data: usuarioCheck } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('compita_id', compita.id)
      .limit(1)
      .maybeSingle() as { data: { nombre: string } | null }

    await setPendiente(supabase, chatId, 'iniciar')
    await sendTelegramMessage(
      chatId,
      `¿Vas a empezar la visita${usuarioCheck ? ` con <b>${usuarioCheck.nombre}</b>` : ''}?\n\nToca <b>✅ Sí, iniciar</b> para confirmar.`,
      INLINE_CONFIRMAR_INICIO,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Terminar visita ───────────────────────────────────────────────────
  if (text === '🔴 Terminar visita') {
    const { data: visita } = await supabase
      .from('visitas')
      .select('id')
      .eq('compita_id', compita.id)
      .eq('estado', 'en_curso')
      .single()

    if (!visita) {
      await sendTelegramMessage(chatId, `No tienes ninguna visita en curso en este momento.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }

    await setPendiente(supabase, chatId, 'terminar')
    await sendTelegramMessage(
      chatId,
      `¿Confirmas que quieres terminar la visita?\n\nToca <b>✅ Sí, terminar</b> para confirmar. Se le enviará un resumen a la familia.`,
      INLINE_CONFIRMAR_FIN,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Cancelar ──────────────────────────────────────────────────────────
  if (text === '❌ Cancelar') {
    await clearPendiente(supabase, chatId)
    const { data: visitaActiva } = await supabase
      .from('visitas').select('id').eq('compita_id', compita.id).eq('estado', 'en_curso').single()
    await sendTelegramMessage(
      chatId,
      `Cancelado. No se hizo ningún cambio.`,
      visitaActiva ? INLINE_DURANTE : INLINE_INICIO,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Emergencia ────────────────────────────────────────────────────────
  if (isCallback && text === 'emergencia') {
    const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID

    // Buscar visita en curso para obtener datos del cliente
    const { data: visitaEmergencia } = await supabase
      .from('visitas')
      .select('id, usuario:usuarios(nombre, email, zona, familiar_nombre, familiar_condicion)')
      .eq('compita_id', compita.id)
      .eq('estado', 'en_curso')
      .maybeSingle() as { data: { id: string; usuario: { nombre: string; email: string; zona: string | null; familiar_nombre: string | null; familiar_condicion: string | null } | null } | null }

    const u = visitaEmergencia?.usuario
    const infoCliente = u
      ? [
          `<b>Cliente:</b> ${u.nombre} (${u.email})`,
          u.zona ? `<b>Zona:</b> ${u.zona}` : null,
          u.familiar_nombre ? `<b>Familiar:</b> ${u.familiar_nombre}` : null,
          u.familiar_condicion ? `<b>Condición:</b> ${u.familiar_condicion}` : null,
        ].filter(Boolean).join('\n')
      : 'No hay visita activa registrada.'

    if (adminTg) {
      try {
        await sendTelegramMessage(
          adminTg,
          [
            `🚨 <b>EMERGENCIA</b>`,
            ``,
            `<b>${compita.nombre}</b> activó el botón de emergencia durante una visita.`,
            ``,
            infoCliente,
            ``,
            `Contáctalos de inmediato.`,
          ].join('\n'),
        )
      } catch (e) { console.error('Telegram emergencia admin:', e) }
    }

    await sendTelegramMessage(
      chatId,
      `🚨 <b>Alerta enviada.</b>\n\nEl equipo de Compaz fue notificado ahora mismo y te contactará de inmediato.\n\nSi hay peligro inmediato, llama al <b>911</b>.`,
      INLINE_DURANTE,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Solicitud: aceptar slot ──────────────────────────────────────────────────
  if (isCallback && text.startsWith('slot:')) {
    const partes = text.split(':')
    const slotIndex = parseInt(partes[1], 10)
    const token = partes.slice(2).join(':')

    const solicitud = await confirmarSlot(token, slotIndex)
    if (!solicitud) {
      await sendTelegramMessage(chatId, `Este enlace ya fue usado o no existe.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }

    const slotLabel = formatSlotVE(solicitud.slot_confirmado!)
    const resend = new Resend(process.env.RESEND_API_KEY)
    const adminSupa = createAdminSupabase()

    // Traer datos del cliente
    const { data: cliente } = await adminSupa
      .from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()

    // Email al cliente — sin link, llega 1h antes por el cron de recordatorios
    if (cliente?.email) {
      try {
        await resend.emails.send({
          from: 'Compaz <visitas@micompaz.com>',
          to: cliente.email,
          subject: `Tu llamada con ${compita.nombre} está confirmada`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">¡Llamada confirmada!</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                <strong>${compita.nombre}</strong> confirmó la llamada para el:<br>
                <strong>${slotLabel}</strong>
              </p>
              <p style="color:#4A3B6B;background:#F5F0E8;border:2px solid #D4C9E8;border-radius:12px;padding:14px;font-size:14px">
                📩 Te enviaremos el link de acceso a la llamada <strong>1 hora antes</strong>.
              </p>
              <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
      } catch (e) { console.error('Email cliente confirmación:', e) }
    }

    // Telegram al admin
    const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (adminTg) {
      try {
        await sendTelegramMessage(
          adminTg,
          [`📞 <b>Entrevista confirmada</b>`, ``, `<b>Cliente:</b> ${cliente?.nombre ?? ''} (${cliente?.email ?? ''})`, `<b>Compita:</b> ${compita.nombre}`, `<b>Fecha:</b> ${slotLabel}`, ``, `🔗 El link de sala se generará y enviará 1 hora antes.`].join('\n'),
        )
      } catch (e) { console.error('Telegram admin confirmación:', e) }
    }

    await sendTelegramMessage(
      chatId,
      `✅ <b>Llamada confirmada</b>\n\n<b>Cliente:</b> ${cliente?.nombre ?? 'Cliente'}\n<b>Fecha y hora:</b> ${slotLabel}\n\n📩 Te enviaremos el link de acceso <b>1 hora antes</b> de la llamada.`,
      INLINE_INICIO,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Solicitud: rechazar ──────────────────────────────────────────────────────
  if (isCallback && text.startsWith('rechazar:')) {
    const token = text.slice('rechazar:'.length)
    const solicitud = await confirmarSlot(token, -1)
    if (!solicitud) {
      await sendTelegramMessage(chatId, `Este enlace ya fue usado o no existe.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }

    // Notificar al admin
    const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (adminTg) {
      try {
        await sendTelegramMessage(adminTg, `❌ <b>${compita.nombre}</b> rechazó una solicitud de entrevista.`)
      } catch (e) { console.error('Telegram rechazo admin:', e) }
    }

    // Guardar estado para capturar los horarios alternativos
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
      `Entendido. ¿Puedes sugerir otros horarios que sí te funcionen?\n\n✍️ <b>Escríbelos aquí</b> y se los haremos llegar a ${clienteNombre} por email.\n\n📅 <i>Recuerda incluir el día y la hora exacta de cada opción. Por ejemplo: lunes 6 de octubre a las 3:00pm.</i>`,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón: Confirmar (iniciar o terminar) ────────────────────────────────────
  if (text === '✅ Sí, iniciar' || text === '✅ Sí, terminar') {
    const estadoPendiente = await getEstado(supabase, chatId)
    const accionPendiente = estadoPendiente?.pendiente_accion as 'iniciar' | 'terminar' | null
    const expiraPendiente = estadoPendiente?.pendiente_expira ? new Date(estadoPendiente.pendiente_expira).getTime() : 0
    if (!accionPendiente || (accionPendiente !== 'iniciar' && accionPendiente !== 'terminar') || Date.now() > expiraPendiente) {
      await clearPendiente(supabase, chatId)
      await sendTelegramMessage(chatId, `El tiempo para confirmar expiró. Por favor intenta de nuevo.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }
    await clearPendiente(supabase, chatId)

    // ── Confirmar inicio ───────────────────────────────────────────────────────
    if (accionPendiente === 'iniciar') {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('*, familiar_nombre, familiar_edad, familiar_condicion, familiar_notas')
        .eq('compita_id', compita.id)
        .limit(1)
        .maybeSingle() as { data: Usuario | null }

      if (!usuario) {
        await sendTelegramMessage(chatId, `No tienes ningún cliente asignado todavía. Contacta al equipo de Compaz para que te asignen uno.`, INLINE_INICIO)
        return NextResponse.json({ ok: true })
      }

      // Intentar promover pre_visita existente; si no hay, crear nueva
      const ahora = new Date().toISOString()
      const { data: preVisita } = await supabase
        .from('visitas')
        .select('id')
        .eq('compita_id', compita.id)
        .eq('usuario_id', usuario.id)
        .eq('estado', 'pre_visita')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let visita: Visita | null = null
      let visitaError: unknown = null

      if (preVisita) {
        const { data: updated, error } = await supabase
          .from('visitas')
          .update({ estado: 'en_curso', inicio: ahora })
          .eq('id', preVisita.id)
          .select()
          .single() as { data: Visita | null; error: unknown }
        visita = updated
        visitaError = error
      } else {
        const { data: inserted, error } = await supabase
          .from('visitas')
          .insert({ compita_id: compita.id, usuario_id: usuario.id, estado: 'en_curso', inicio: ahora })
          .select()
          .single() as { data: Visita | null; error: unknown }
        visita = inserted
        visitaError = error
      }

      if (visitaError || !visita) {
        await sendTelegramMessage(chatId, `Hubo un error al iniciar la visita. Intenta de nuevo en un momento.`, INLINE_INICIO)
        return NextResponse.json({ ok: true })
      }

      // Construir perfil del familiar si existe
      const perfilLineas: string[] = []
      if (usuario.familiar_nombre) perfilLineas.push(`<b>Nombre:</b> ${usuario.familiar_nombre}`)
      if (usuario.familiar_edad) perfilLineas.push(`<b>Edad:</b> ${usuario.familiar_edad} años`)
      if (usuario.familiar_condicion) perfilLineas.push(`<b>Condición:</b> ${usuario.familiar_condicion}`)
      if (usuario.familiar_notas) perfilLineas.push(`<b>Notas:</b> ${usuario.familiar_notas}`)

      const perfilTexto = perfilLineas.length > 0
        ? `\n\n👤 <b>Perfil del familiar:</b>\n${perfilLineas.join('\n')}`
        : ''

      await sendTelegramMessage(
        chatId,
        `✅ <b>¡Visita iniciada!</b>\n\nEstás con <b>${usuario.nombre}</b>. La familia ya sabe que llegaste.${perfilTexto}\n\n📸 <b>Puedes mandar fotos y mensajes</b> desde aquí durante la visita — la familia los verá en tiempo real.\n\nCuando termines, toca el botón rojo de abajo. 👇`,
        INLINE_DURANTE,
      )

      try { await sendVisitaInicio(usuario, compita, visita) } catch (e) { console.error('Error correo inicio:', e) }
    }

    // ── Confirmar fin ─────────────────────────────────────────────────────────
    if (accionPendiente === 'terminar') {
      const { data: visita } = await supabase
        .from('visitas')
        .select('*, usuario:usuarios(*)')
        .eq('compita_id', compita.id)
        .eq('estado', 'en_curso')
        .single() as { data: (Visita & { usuario: Usuario }) | null }

      if (!visita) {
        await sendTelegramMessage(chatId, `No hay ninguna visita en curso que puedas terminar ahora mismo.\n\nSi crees que es un error, escríbenos a hola@micompaz.com.`, INLINE_INICIO)
        return NextResponse.json({ ok: true })
      }

      const fin = new Date().toISOString()
      await supabase.from('visitas').update({ estado: 'terminada', fin, room_url: null }).eq('id', visita.id)
      await supabase.from('compitas').update({ visitas_realizadas: (compita.visitas_realizadas ?? 0) + 1 }).eq('id', compita.id)

      // Enviar email básico inmediatamente (sin esperar el cuestionario)
      try {
        const { data: mensajes } = await supabase
          .from('mensajes').select('*').eq('visit_id', visita.id).order('created_at', { ascending: true }) as { data: import('@/types').Mensaje[] | null }
        await sendVisitaResumen(visita.usuario, compita, { ...visita, fin }, mensajes ?? [])
      } catch (e) { console.error('Error correo básico al terminar:', e) }

      // Iniciar cuestionario de bienestar (enriquece con un segundo email si se completa)
      await setEstado(supabase, chatId, {
        pendiente_accion: `reporte:${visita.id}:0:`,
        pendiente_expira: new Date(Date.now() + 30 * 60_000).toISOString(),
      })

      await sendTelegramMessage(
        chatId,
        `🔴 <b>Visita terminada.</b>\n\n¡Gracias por tu trabajo de hoy, ${compita.nombre}! 🤝\n\nYa le enviamos el resumen básico a la familia. Ahora tómate un minuto para registrar cómo estuvo el familiar — ellos lo verán como una actualización. 📋`,
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
  if (esSugerir && !isCallback && text && !text.startsWith('/')) {
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
      const resend = new Resend(process.env.RESEND_API_KEY)
      try {
        await resend.emails.send({
          from: 'Compaz <visitas@micompaz.com>',
          to: clienteEmail,
          subject: `${compita.nombre} te propone otros horarios`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">Nuevos horarios disponibles</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                <strong>${escapeHtml(compita.nombre)}</strong> no pudo en los horarios que propusiste, pero sugiere lo siguiente:
              </p>
              <blockquote style="background:#F5F0FF;border-left:4px solid #7C4DFF;border-radius:8px;padding:16px 20px;color:#1A0A3C;font-size:16px;line-height:1.6;margin:16px 0">
                ${escapeHtml(text).replace(/\n/g, '<br>')}
              </blockquote>
              <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
                Si alguno te funciona, haz clic aquí para enviar una nueva solicitud directamente con ${escapeHtml(compita.nombre)}:
              </p>
              <a href="${SITE_URL}/compitas?compita=${compita.id}&reagendar=${solicitudId}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:4px">
                Agendar con ${escapeHtml(compita.nombre)} →
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
        `✅ Listo. Le enviamos tus horarios a ${clienteNombre || 'el cliente'} por email.\n\nSi acepta, te llegará una nueva solicitud por aquí.`,
      )
    } else {
      await sendTelegramMessage(
        chatId,
        `⚠️ No pudimos enviarle tus horarios al cliente porque no tenemos su correo registrado. Por favor escríbenos a hola@micompaz.com y lo resolvemos manualmente.`,
        INLINE_INICIO,
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Reanudar cuestionario desde recordatorio ────────────────────────────────
  if (isCallback && text === 'reanudar_reporte') {
    const estadoReanuda = await getEstado(supabase, chatId)
    const accionReanuda = estadoReanuda?.pendiente_accion ?? ''
    if (!accionReanuda.startsWith('reporte:') && !accionReanuda.startsWith('reporte_novedad:')) {
      await sendTelegramMessage(chatId, `Ya no hay un cuestionario pendiente.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }
    // Extender expiración otros 30 min y re-mostrar la pregunta actual
    await supabase.from('telegram_estados').update({ pendiente_expira: new Date(Date.now() + 30 * 60_000).toISOString() }).eq('chat_id', chatId)
    if (accionReanuda.startsWith('reporte_novedad:')) {
      await sendTelegramMessage(chatId, `📝 <b>¿Hay algo que quieras contarle a la familia?</b>\n\nEscríbelo aquí — puede ser una anécdota, un avance que notaste, algo que le gustó especialmente, o cualquier detalle que creas que les daría paz o alegría.`, QUITAR_TECLADO)
    } else {
      const partes = accionReanuda.split(':')
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
    const accion = estadoActualRR?.pendiente_accion ?? ''
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
    // Buscar visita en_curso o pre_visita
    const { data: visitaActiva } = await supabase
      .from('visitas')
      .select('id, estado')
      .eq('compita_id', compita.id)
      .in('estado', ['en_curso', 'pre_visita'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { id: string; estado: string } | null }

    if (!visitaActiva) {
      await sendTelegramMessage(
        chatId,
        `No hay ninguna visita activa ahora mismo.\n\nCuando llegues donde tu cliente, toca el botón de abajo. 👇`,
        INLINE_INICIO,
      )
      return NextResponse.json({ ok: true })
    }

    // Foto
    if (message.photo && message.photo.length > 0) {
      const photo = message.photo[message.photo.length - 1]
      try {
        const fileUrl = await getTelegramFileUrl(photo.file_id)
        await supabase.from('mensajes').insert({ visit_id: visitaActiva.id, origen: 'compita', tipo: 'foto', contenido: fileUrl })
      } catch (e) { console.error('Error guardando foto:', e) }
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

    if (text) {
      await supabase.from('mensajes').insert({ visit_id: visitaActiva.id, origen: 'compita', tipo: 'texto', contenido: text })

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
  }

  return NextResponse.json({ ok: true })
}
