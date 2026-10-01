// GET /api/solicitud/responder?token=xxx&slot=0|-1
// El compita toca este link desde Telegram para confirmar un slot o rechazar
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { confirmarSlot, guardarRoomUrl } from '@/lib/solicitudes'
import { createEntrevistaRoom } from '@/lib/daily'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

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

function html(titulo: string, cuerpo: string) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${titulo} — Compaz</title>
    <style>body{font-family:Inter,sans-serif;background:#FDFAF6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
    .card{background:white;border:2px solid #E8E0D4;border-radius:24px;padding:40px;max-width:480px;text-align:center}
    h2{color:#1A0A3C;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:22px;margin-bottom:12px}
    p{color:#4A3B6B;line-height:1.6}</style></head>
    <body><div class="card"><h2>${titulo}</h2><p>${cuerpo}</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const token = searchParams.get('token')
  const slotParam = searchParams.get('slot')

  if (!token || slotParam === null) {
    return html('Enlace inválido', 'Este enlace no es válido.')
  }

  const slotIndex = parseInt(slotParam, 10)

  const solicitud = await confirmarSlot(token, slotIndex)
  if (!solicitud) {
    return html('Enlace inválido', 'Este enlace ya fue usado o no existe.')
  }

  if (solicitud.estado === 'rechazada') {
    const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID

    // Notificar al admin
    if (adminTg) {
      try {
        await sendTelegramMessage(
          adminTg,
          `❌ <b>${solicitud.compita_nombre}</b> rechazó la solicitud de entrevista.\nEsperando que sugiera horarios alternativos.`,
        )
      } catch (e) { console.error('Telegram rechazo admin:', e) }
    }

    // Traer email del cliente para usarlo en el estado pendiente
    const adminSupa = createAdminSupabase()
    const { data: clienteRechazado } = await adminSupa
      .from('usuarios')
      .select('nombre, email')
      .eq('id', solicitud.cliente_id)
      .single()

    // Pedir al compita que sugiera horarios alternativos por Telegram
    if (solicitud.compita_id) {
      const { data: compitaRechazada } = await adminSupa
        .from('compitas')
        .select('telegram_chat_id')
        .eq('id', solicitud.compita_id)
        .single()

      if (compitaRechazada?.telegram_chat_id) {
        const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        const clienteEmail = clienteRechazado?.email ?? ''
        const clienteNombre = clienteRechazado?.nombre ?? 'el cliente'
        const accion = `sugerir_horarios:${solicitud.id}:${clienteEmail}:${clienteNombre}`
        await adminSupa.from('telegram_estados').upsert(
          { chat_id: compitaRechazada.telegram_chat_id, registro_pendiente: false, pendiente_accion: accion, pendiente_expira: expira },
          { onConflict: 'chat_id' },
        )
        try {
          await sendTelegramMessage(
            compitaRechazada.telegram_chat_id,
            `Entendido. ¿Puedes sugerir otros horarios que sí te funcionen?\n\n✍️ <b>Escríbelos aquí</b> y se los haremos llegar a ${clienteNombre} por email.\n\n📅 <i>Recuerda incluir el día y la hora exacta de cada opción. Por ejemplo: lunes 6 de octubre a las 3:00pm.</i>`,
          )
        } catch (e) { console.error('Telegram pedir horarios:', e) }
      }
    }

    return html('Respuesta registrada', 'Gracias. Te llegará un mensaje por Telegram para que puedas sugerir otros horarios.')
  }

  // Solicitud aceptada — crear sala Daily.co
  const slotDate = new Date(solicitud.slot_confirmado!)
  let roomUrl = ''
  try {
    const room = await createEntrevistaRoom(solicitud.id, slotDate)
    roomUrl = room.url
    await guardarRoomUrl(solicitud.id, roomUrl)
  } catch (e) {
    console.error('Error creando sala Daily:', e)
    return html('Error', 'Ocurrió un error al crear la sala. Contacta al equipo Compaz.')
  }

  const slotLabel = formatSlotVE(solicitud.slot_confirmado!)
  const recordatorio20min = '⏱️ Recuerda: la llamada tiene un límite de <strong>20 minutos</strong>. La sala se cierra automáticamente a los 23 min.'

  // Traer datos del cliente para el email
  const admin = createAdminSupabase()
  const { data: cliente } = await admin
    .from('usuarios')
    .select('nombre, email')
    .eq('id', solicitud.cliente_id)
    .single()

  const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID

  // ── Email al cliente ──────────────────────────────────────────────────────
  if (cliente) {
    try {
      await resend.emails.send({
        from: 'Compaz <visitas@micompaz.com>',
        to: cliente.email,
        subject: `Tu llamada con ${solicitud.compita_nombre} está confirmada`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">¡Llamada confirmada!</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
              <strong>${solicitud.compita_nombre}</strong> confirmó la llamada para el:<br>
              <strong>${slotLabel}</strong>
            </p>
            <p style="color:#C84B0E;background:#FFF3E8;border:2px solid #FF6B2B;border-radius:12px;padding:14px;font-size:14px">
              ${recordatorio20min}
            </p>
            <a href="${roomUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:8px">
              Entrar a la llamada →
            </a>
            <p style="color:#6B5C90;font-size:13px;margin-top:24px">
              El link estará activo desde 5 minutos antes hasta 23 minutos después de la hora indicada.<br>
              Compaz — <em>Cerca aunque estés lejos</em>
            </p>
          </div>
        `,
      })
    } catch (e) { console.error('Email cliente confirmación:', e) }
  }

  // ── Telegram al compita ───────────────────────────────────────────────────
  if (solicitud.compita_id) {
    const { data: compita } = await admin
      .from('compitas')
      .select('telegram_chat_id')
      .eq('id', solicitud.compita_id)
      .single()

    if (compita?.telegram_chat_id) {
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          [
            `✅ <b>Llamada confirmada</b>`,
            ``,
            `<b>Cliente:</b> ${cliente?.nombre ?? 'Cliente'}`,
            `<b>Fecha y hora:</b> ${slotLabel}`,
            ``,
            `⏱️ <b>La llamada es de 20 minutos.</b> La sala se cierra automáticamente a los 23 min.`,
            ``,
            `<a href="${roomUrl}">Entrar a la llamada →</a>`,
          ].join('\n'),
        )
      } catch (e) { console.error('Telegram compita confirmación:', e) }
    }
  }

  // ── Telegram al admin ─────────────────────────────────────────────────────
  if (adminTg) {
    try {
      await sendTelegramMessage(
        adminTg,
        [
          `📞 <b>Entrevista confirmada</b>`,
          ``,
          `<b>Cliente:</b> ${cliente?.nombre ?? 'Cliente'} (${cliente?.email ?? ''})`,
          `<b>Compita:</b> ${solicitud.compita_nombre}`,
          `<b>Fecha y hora:</b> ${slotLabel}`,
          ``,
          `⏱️ Llamada de 20 minutos. Puedes unirte como supervisor:`,
          `<a href="${roomUrl}">Entrar a la sala →</a>`,
        ].join('\n'),
      )
    } catch (e) { console.error('Telegram admin confirmación:', e) }
  }

  return html(
    'Llamada confirmada',
    `Confirmaste la llamada para el <strong>${slotLabel}</strong>. Te llegará el link por Telegram.`,
  )
}
