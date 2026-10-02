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
import { sendVisitaInicio, sendVisitaResumen, sendCodigoTelegram } from '@/lib/resend'
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

<b>¿Tienes dudas?</b>
Escribe <b>/menu</b> para volver a ver estas instrucciones.
O contacta al equipo de Compaz directamente.`

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
  const expira = new Date(Date.now() + 60_000).toISOString()
  await setEstado(supabase, chatId, { pendiente_accion: accion, pendiente_expira: expira })
}
async function clearPendiente(supabase: ReturnType<typeof createAdminSupabase>, chatId: string) {
  await setEstado(supabase, chatId, { pendiente_accion: null, pendiente_expira: null })
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
      await sendTelegramMessage(
        chatId,
        `✏️ <b>Edita tu perfil</b>\n\nAquí tienes tu enlace personal:\n\n<a href="${url}">${url}</a>\n\n⏳ El enlace es válido por <b>24 horas</b> y se puede usar <b>una sola vez</b>. Si necesitas uno nuevo, escribe /perfil de nuevo.`,
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
      await sendTelegramMessage(
        chatId,
        `¡Hola de nuevo, <b>${compita.nombre}</b>! 👋\n\nTodo está listo. Cuando llegues a casa de tu cliente y vayas a comenzar, toca el botón <b>▶️ Iniciar visita</b>. Cuando termines, toca <b>🔴 Terminar visita</b>.`,
        INLINE_INICIO,
      )
    } else {
      await setEstado(supabase, chatId, { registro_pendiente: true, pendiente_accion: null, pendiente_expira: null })
      await sendTelegramMessage(
        chatId,
        `¡Bienvenido a Compaz! 👋\n\nSoy el asistente que te acompañará en cada visita.\n\nPrimero necesito verificar tu cuenta. ✍️ Escríbeme tu <b>nombre completo</b> tal como lo pusiste cuando te registraste.\n\n<i>Por ejemplo: María González</i>`,
        QUITAR_TECLADO,
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Vinculación por nombre + código de verificación ─────────────────────────
  const estado = !compita ? await getEstado(supabase, chatId) : null

  // Paso 2: compita ingresó el código de 6 dígitos
  if (estado?.pendiente_accion?.startsWith('verificar:') && !compita) {
    const [, codigo, compitaId] = estado.pendiente_accion.split(':')
    const expirado = estado.pendiente_expira ? new Date(estado.pendiente_expira) < new Date() : true
    if (expirado) {
      await clearPendiente(supabase, chatId)
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(chatId, `El código expiró. ✍️ Escribe tu nombre de nuevo para obtener uno nuevo:`)
      return NextResponse.json({ ok: true })
    }
    if (text.trim() !== codigo) {
      await sendTelegramMessage(chatId, `Código incorrecto ❌\n\nRevisa el correo e inténtalo de nuevo. Si quieres empezar de cero, toca el botón. 👇`, INLINE_START)
      return NextResponse.json({ ok: true })
    }
    // Código correcto — vincular
    await clearPendiente(supabase, chatId)
    const { data: encontrada } = await supabase.from('compitas').select('nombre').eq('id', compitaId).single() as { data: Compita | null }
    await supabase.from('compitas').update({ telegram_chat_id: chatId }).eq('id', compitaId).is('telegram_chat_id', null)
    const nombre = encontrada?.nombre ?? 'Compita'
    await sendTelegramMessage(
      chatId,
      `✅ <b>¡Listo, ${nombre}!</b> Tu cuenta ya está activa en Compaz. Bienvenida al equipo. 🎉\n\nAhora te explico todo lo que puedes hacer desde este chat:`,
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
    await setRegistroPendiente(supabase, chatId, false)
    const { data: encontrada } = await supabase
      .from('compitas')
      .select('id, nombre, email, codigo')
      .ilike('nombre', `%${text.trim()}%`)
      .is('telegram_chat_id', null)
      .maybeSingle() as { data: Compita | null }

    if (!encontrada) {
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(
        chatId,
        `No encontré ninguna cuenta con ese nombre. 🤔\n\nVerifica que lo escribiste <b>exactamente igual</b> a como lo pusiste en el formulario de registro, incluyendo mayúsculas y tildes.\n\n✍️ Intenta de nuevo:`,
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

    // Solo permitir iniciar visita si hay al menos una solicitud completada para este compita
    const { data: solicitudCompletada } = await supabase
      .from('solicitudes')
      .select('id, cliente_id')
      .eq('compita_id', compita.id)
      .eq('estado', 'completada')
      .limit(1)
      .maybeSingle()

    if (!solicitudCompletada) {
      await sendTelegramMessage(
        chatId,
        `Todavía no tienes ningún cliente activo. 😊\n\nCuando un cliente confirme que quiere trabajar contigo, podrás iniciar visitas desde aquí.`,
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
      `¿Segura que quieres terminar la visita?\n\nToca <b>✅ Sí, terminar</b> para confirmar. Se le enviará un resumen a la familia.`,
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
    if (!accionPendiente || Date.now() > expiraPendiente) {
      await clearPendiente(supabase, chatId)
      await sendTelegramMessage(chatId, `El tiempo para confirmar expiró. Por favor intenta de nuevo.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }
    await clearPendiente(supabase, chatId)

    // ── Confirmar inicio ───────────────────────────────────────────────────────
    if (accionPendiente === 'iniciar') {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('*')
        .eq('compita_id', compita.id)
        .limit(1)
        .maybeSingle() as { data: Usuario | null }

      if (!usuario) {
        await sendTelegramMessage(chatId, `No tienes ningún cliente asignado todavía. Contacta al equipo de Compaz para que te asignen uno.`, INLINE_INICIO)
        return NextResponse.json({ ok: true })
      }

      const { data: visita, error } = await supabase
        .from('visitas')
        .insert({ compita_id: compita.id, usuario_id: usuario.id, estado: 'en_curso', inicio: new Date().toISOString() })
        .select()
        .single() as { data: Visita | null; error: unknown }

      if (error || !visita) {
        await sendTelegramMessage(chatId, `Hubo un error al iniciar la visita. Intenta de nuevo en un momento.`, INLINE_INICIO)
        return NextResponse.json({ ok: true })
      }

      await sendTelegramMessage(
        chatId,
        `✅ <b>¡Visita iniciada!</b>\n\nEstás con <b>${usuario.nombre}</b>. La familia ya sabe que llegaste.\n\n📸 <b>Puedes mandar fotos y mensajes</b> desde aquí durante la visita — la familia los verá en tiempo real.\n\nCuando termines, toca el botón rojo de abajo. 👇`,
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
        await sendTelegramMessage(chatId, `No hay visita activa para terminar.`, INLINE_INICIO)
        return NextResponse.json({ ok: true })
      }

      const fin = new Date().toISOString()
      await supabase.from('visitas').update({ estado: 'terminada', fin, room_url: null }).eq('id', visita.id)
      await supabase.from('compitas').update({ visitas_realizadas: (compita.visitas_realizadas ?? 0) + 1 }).eq('id', compita.id)

      await sendTelegramMessage(
        chatId,
        `🔴 <b>Visita terminada.</b>\n\n¡Gracias por tu trabajo de hoy, ${compita.nombre}! 🤝\n\nSe le enviará un resumen a la familia.\n\nHasta la próxima. 😊`,
        INLINE_INICIO,
      )

      try {
        const { data: mensajes } = await supabase
          .from('mensajes').select('*').eq('visit_id', visita.id).order('created_at', { ascending: true }) as { data: Mensaje[] | null }
        await sendVisitaResumen(visita.usuario, compita, { ...visita, fin }, mensajes ?? [])
      } catch (e) { console.error('Error correo resumen:', e) }
    }

    return NextResponse.json({ ok: true })
  }

  // ── Sugerencia de horarios alternativos tras rechazo ────────────────────────
  const estadoActual = await getEstado(supabase, chatId)
  if (estadoActual?.pendiente_accion?.startsWith('sugerir_horarios:') && !isCallback && text && !text.startsWith('/')) {
    const partes = estadoActual.pendiente_accion.split(':')
    // formato: sugerir_horarios:<solicitud_id>:<email>:<nombre> (nombre puede tener espacios pero fue el último segmento)
    const [, , clienteEmail, ...nombrePartes] = partes
    const clienteNombre = nombrePartes.join(':')
    const expirado = estadoActual.pendiente_expira ? new Date(estadoActual.pendiente_expira) < new Date() : true

    await clearPendiente(supabase, chatId)

    if (expirado) {
      await sendTelegramMessage(chatId, `El tiempo para sugerir horarios expiró. Contacta al equipo de Compaz si necesitas ayuda.`, INLINE_INICIO)
      return NextResponse.json({ ok: true })
    }

    // Enviar email al cliente con los horarios sugeridos
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
                <strong>${compita.nombre}</strong> no pudo en los horarios que propusiste, pero sugiere lo siguiente:
              </p>
              <blockquote style="background:#F5F0FF;border-left:4px solid #7C4DFF;border-radius:8px;padding:16px 20px;color:#1A0A3C;font-size:16px;line-height:1.6;margin:16px 0">
                ${text.replace(/\n/g, '<br>')}
              </blockquote>
              <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
                Si alguno te funciona, haz clic aquí para enviar una nueva solicitud directamente con ${compita.nombre}:
              </p>
              <a href="${SITE_URL}/compitas?compita=${compita.id}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:4px">
                Agendar con ${compita.nombre} →
              </a>
              <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
      } catch (e) { console.error('Email horarios alternativos:', e) }
    }

    await sendTelegramMessage(
      chatId,
      `✅ Listo. Le enviamos tus horarios a ${clienteNombre || 'el cliente'} por email.\n\nSi acepta, te llegará una nueva solicitud por aquí.`,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Mensajes y fotos durante visita activa ───────────────────────────────────
  // Solo procesar si no es un callback (los callbacks no tienen contenido multimedia)
  if (!isCallback) {
    const { data: visitaActiva } = await supabase
      .from('visitas').select('id').eq('compita_id', compita.id).eq('estado', 'en_curso').single() as { data: { id: string } | null }

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
    }
  }

  return NextResponse.json({ ok: true })
}
