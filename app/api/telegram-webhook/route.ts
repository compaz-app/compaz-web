import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import {
  validateTelegramWebhook,
  sendTelegramMessage,
  getTelegramFileUrl,
  TECLADO_INICIO,
  TECLADO_DURANTE_VISITA,
  TECLADO_CONFIRMAR_INICIO,
  TECLADO_CONFIRMAR_FIN,
  QUITAR_TECLADO,
} from '@/lib/telegram'
import { sendVisitaInicio, sendVisitaResumen } from '@/lib/resend'
import type { TelegramUpdate, Compita, Usuario, Visita, Mensaje } from '@/types'

// Estado persistido en Supabase (tabla telegram_estados) para sobrevivir serverless cold starts
async function getEstado(supabase: ReturnType<typeof createAdminSupabase>, chatId: string) {
  const { data } = await supabase.from('telegram_estados').select('*').eq('chat_id', chatId).maybeSingle()
  return data as { chat_id: string; registro_pendiente: boolean; pendiente_accion: string | null; pendiente_expira: string | null } | null
}
async function setRegistroPendiente(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, valor: boolean) {
  await supabase.from('telegram_estados').upsert({ chat_id: chatId, registro_pendiente: valor }, { onConflict: 'chat_id' })
}
async function setPendiente(supabase: ReturnType<typeof createAdminSupabase>, chatId: string, accion: 'iniciar' | 'terminar') {
  const expira = new Date(Date.now() + 60_000).toISOString()
  await supabase.from('telegram_estados').upsert({ chat_id: chatId, pendiente_accion: accion, pendiente_expira: expira }, { onConflict: 'chat_id' })
}
async function clearPendiente(supabase: ReturnType<typeof createAdminSupabase>, chatId: string) {
  await supabase.from('telegram_estados').upsert({ chat_id: chatId, pendiente_accion: null, pendiente_expira: null }, { onConflict: 'chat_id' })
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

  const message = update.message
  if (!message) return NextResponse.json({ ok: true })

  const chatId = String(message.chat.id)
  const text = message.text?.trim() ?? ''
  const supabase = createAdminSupabase()

  // Buscar compita por telegram_chat_id
  const { data: compita } = await supabase
    .from('compitas')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .single() as { data: Compita | null }

  // ── /reset — solo para pruebas, desvincula el chat_id ──────────────────────
  if (text === '/reset') {
    if (compita) {
      await supabase.from('compitas').update({ telegram_chat_id: null }).eq('id', compita.id)
      await sendTelegramMessage(chatId, `Cuenta desvinculada. Puedes volver a registrarte con /start.`, QUITAR_TECLADO)
    } else {
      await sendTelegramMessage(chatId, `No hay cuenta vinculada a este chat.`)
    }
    return NextResponse.json({ ok: true })
  }

  // ── /start — bienvenida y registro ──────────────────────────────────────────
  if (text === '/start' || text.startsWith('/start ')) {
    if (compita) {
      await sendTelegramMessage(
        chatId,
        `¡Hola de nuevo, <b>${compita.nombre}</b>! 👋\n\nTodo está listo. Cuando llegues a casa de tu cliente y vayas a comenzar, toca el botón <b>▶️ Iniciar visita</b> de abajo. Cuando termines y te vayas, toca <b>🔴 Terminar visita</b>.\n\nPuedes cerrar esta app — el botón te estará esperando aquí cuando lo necesites.`,
        TECLADO_INICIO,
      )
    } else {
      await setRegistroPendiente(supabase, chatId, true)
      await sendTelegramMessage(
        chatId,
        `¡Bienvenida a Compaz! 👋\n\nSoy el asistente que te acompañará en cada visita.\n\nPrimero necesito verificar tu cuenta. Escríbeme tu <b>nombre completo</b> tal como lo pusiste cuando te registraste.\n\n<i>Por ejemplo: María González</i>`,
        QUITAR_TECLADO,
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Vinculación por nombre ───────────────────────────────────────────────────
  const estado = !compita ? await getEstado(supabase, chatId) : null
  if (estado?.registro_pendiente && !compita) {
    await setRegistroPendiente(supabase, chatId, false)
    const { data: encontrada } = await supabase
      .from('compitas')
      .select('*')
      .ilike('nombre', text)
      .is('telegram_chat_id', null)
      .single() as { data: Compita | null }

    if (!encontrada) {
      await setRegistroPendiente(supabase, chatId, true) // dejar que intente de nuevo
      await sendTelegramMessage(
        chatId,
        `No encontré ninguna cuenta con ese nombre. 🤔\n\nVerifica que lo escribiste <b>exactamente igual</b> a como lo pusiste en el formulario de registro, incluyendo mayúsculas y tildes.\n\nIntenta de nuevo:`,
      )
    } else {
      await supabase.from('compitas').update({ telegram_chat_id: chatId }).eq('id', encontrada.id)
      await sendTelegramMessage(
        chatId,
        `✅ <b>¡Listo, ${encontrada.nombre}!</b> Tu cuenta ya está activa en Compaz.\n\n📌 <b>¿Cómo funciona esto?</b>\n\nCuando llegues a la casa de tu cliente y vayas a comenzar la visita, toca el botón <b>▶️ Iniciar visita</b> que ves abajo.\n\nCuando termines y te vayas, toca <b>🔴 Terminar visita</b>.\n\nEso es todo. Puedes cerrar esta app ahora — el botón te estará esperando aquí cada vez que lo necesites. 😊`,
        TECLADO_INICIO,
      )

      // Notificar al admin
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
      if (adminChatId) {
        try {
          await sendTelegramMessage(
            adminChatId,
            `🟢 <b>Nueva Compita vinculada</b>\n\n<b>${encontrada.nombre}</b> activó su cuenta en Telegram.\n\nRevisa su perfil en el panel admin y veríficala cuando esté lista.`,
          )
        } catch (e) { console.error('Error notificando admin:', e) }
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (!compita) {
    await sendTelegramMessage(
      chatId,
      `Tu cuenta no está vinculada todavía.\n\nToca aquí 👉 /start para comenzar el registro. Solo toma un minuto.`,
      QUITAR_TECLADO,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón / comando: Iniciar visita ─────────────────────────────────────────
  if (text === '▶️ Iniciar visita' || text === '/iniciar') {
    const { data: visitaActiva } = await supabase
      .from('visitas')
      .select('id')
      .eq('compita_id', compita.id)
      .eq('estado', 'en_curso')
      .single()

    if (visitaActiva) {
      await sendTelegramMessage(
        chatId,
        `Ya tienes una visita en curso. Cuando termines, toca el botón rojo. 👇`,
        TECLADO_DURANTE_VISITA,
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
    const usuario = usuarioCheck
    await sendTelegramMessage(
      chatId,
      `¿Vas a empezar la visita${usuario ? ` con <b>${usuario.nombre}</b>` : ''}?\n\nToca <b>✅ Sí, iniciar</b> para confirmar.`,
      TECLADO_CONFIRMAR_INICIO,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Botón / comando: Terminar visita ────────────────────────────────────────
  if (text === '🔴 Terminar visita' || text === '/terminar') {
    const { data: visita } = await supabase
      .from('visitas')
      .select('id')
      .eq('compita_id', compita.id)
      .eq('estado', 'en_curso')
      .single()

    if (!visita) {
      await sendTelegramMessage(
        chatId,
        `No tienes ninguna visita en curso en este momento.`,
        TECLADO_INICIO,
      )
      return NextResponse.json({ ok: true })
    }

    await setPendiente(supabase, chatId, 'terminar')
    await sendTelegramMessage(
      chatId,
      `¿Segura que quieres terminar la visita?\n\nToca <b>✅ Sí, terminar</b> para confirmar. Se le enviará un resumen a la familia.`,
      TECLADO_CONFIRMAR_FIN,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Cancelar ─────────────────────────────────────────────────────────────────
  if (text === '❌ Cancelar') {
    await clearPendiente(supabase, chatId)
    const { data: visitaActiva } = await supabase
      .from('visitas').select('id').eq('compita_id', compita.id).eq('estado', 'en_curso').single()
    await sendTelegramMessage(
      chatId,
      `Cancelado. No se hizo ningún cambio.`,
      visitaActiva ? TECLADO_DURANTE_VISITA : TECLADO_INICIO,
    )
    return NextResponse.json({ ok: true })
  }

  // ── Confirmación ─────────────────────────────────────────────────────────────
  if (text === '✅ Sí, iniciar' || text === '✅ Sí, terminar' || text === '/confirmar') {
    const estadoPendiente = await getEstado(supabase, chatId)
    const accionPendiente = estadoPendiente?.pendiente_accion as 'iniciar' | 'terminar' | null
    const expiraPendiente = estadoPendiente?.pendiente_expira ? new Date(estadoPendiente.pendiente_expira).getTime() : 0
    if (!accionPendiente || Date.now() > expiraPendiente) {
      await clearPendiente(supabase, chatId)
      await sendTelegramMessage(
        chatId,
        `El tiempo para confirmar expiró. Por favor intenta de nuevo.`,
        TECLADO_INICIO,
      )
      return NextResponse.json({ ok: true })
    }
    await clearPendiente(supabase, chatId)
    const pendiente = { accion: accionPendiente }

    // ── Confirmar inicio ───────────────────────────────────────────────────────
    if (pendiente.accion === 'iniciar') {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('*')
        .eq('compita_id', compita.id)
        .limit(1)
        .maybeSingle() as { data: Usuario | null }

      if (!usuario) {
        await sendTelegramMessage(
          chatId,
          `No tienes ningún cliente asignado todavía. Contacta al equipo de Compaz para que te asignen uno.`,
          TECLADO_INICIO,
        )
        return NextResponse.json({ ok: true })
      }

      const { data: visita, error } = await supabase
        .from('visitas')
        .insert({ compita_id: compita.id, usuario_id: usuario.id, estado: 'en_curso', inicio: new Date().toISOString() })
        .select()
        .single() as { data: Visita | null; error: unknown }

      if (error || !visita) {
        await sendTelegramMessage(chatId, `Hubo un error al iniciar la visita. Intenta de nuevo en un momento.`, TECLADO_INICIO)
        return NextResponse.json({ ok: true })
      }

      await sendTelegramMessage(
        chatId,
        `✅ <b>¡Visita iniciada!</b>\n\nEstás con <b>${usuario.nombre}</b>. La familia ya sabe que llegaste.\n\n📸 <b>Puedes mandar fotos y mensajes</b> desde aquí durante la visita — la familia los verá en tiempo real.\n\nCuando termines, toca el botón rojo de abajo. 👇`,
        TECLADO_DURANTE_VISITA,
      )

      try { await sendVisitaInicio(usuario, compita, visita) } catch (e) { console.error('Error correo inicio:', e) }
    }

    // ── Confirmar fin ─────────────────────────────────────────────────────────
    if (pendiente.accion === 'terminar') {
      const { data: visita } = await supabase
        .from('visitas')
        .select('*, usuario:usuarios(*)')
        .eq('compita_id', compita.id)
        .eq('estado', 'en_curso')
        .single() as { data: (Visita & { usuario: Usuario }) | null }

      if (!visita) {
        await sendTelegramMessage(chatId, `No hay visita activa para terminar.`, TECLADO_INICIO)
        return NextResponse.json({ ok: true })
      }

      const fin = new Date().toISOString()
      await supabase.from('visitas').update({ estado: 'terminada', fin, room_url: null }).eq('id', visita.id)
      await supabase.from('compitas').update({ visitas_realizadas: (compita.visitas_realizadas ?? 0) + 1 }).eq('id', compita.id)

      await sendTelegramMessage(
        chatId,
        `🔴 <b>Visita terminada.</b>\n\n¡Gracias por tu trabajo de hoy, ${compita.nombre}! 🤝\n\nSe le enviará un resumen a la familia con todo lo que compartiste durante la visita.\n\nHasta la próxima. 😊`,
        TECLADO_INICIO,
      )

      try {
        const { data: mensajes } = await supabase
          .from('mensajes').select('*').eq('visit_id', visita.id).order('created_at', { ascending: true }) as { data: Mensaje[] | null }
        await sendVisitaResumen(visita.usuario, compita, { ...visita, fin }, mensajes ?? [])
      } catch (e) { console.error('Error correo resumen:', e) }
    }

    return NextResponse.json({ ok: true })
  }

  // ── Mensajes y fotos durante visita activa ───────────────────────────────────
  const { data: visitaActiva } = await supabase
    .from('visitas').select('id').eq('compita_id', compita.id).eq('estado', 'en_curso').single() as { data: { id: string } | null }

  if (!visitaActiva) {
    await sendTelegramMessage(
      chatId,
      `No hay ninguna visita activa ahora mismo.\n\nCuando llegues donde tu cliente, toca el botón de abajo. 👇`,
      TECLADO_INICIO,
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

  // Texto — ignorar comandos desconocidos
  if (text.startsWith('/')) {
    await sendTelegramMessage(chatId, `No reconozco ese comando. Usa los botones de abajo. 👇`, TECLADO_DURANTE_VISITA)
    return NextResponse.json({ ok: true })
  }

  if (text) {
    await supabase.from('mensajes').insert({ visit_id: visitaActiva.id, origen: 'compita', tipo: 'texto', contenido: text })
  }

  return NextResponse.json({ ok: true })
}
