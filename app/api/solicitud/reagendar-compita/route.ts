// GET /api/solicitud/reagendar-compita?token=xxx
// El compita toca este link desde Telegram para iniciar un reagendado.
// Marca la solicitud como rechazada y le pide al compita que sugiera nuevos horarios.
import { NextRequest, NextResponse } from 'next/server'
import { iniciarReagendadoPorCompita } from '@/lib/solicitudes'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

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
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return html('Enlace inválido', 'Este enlace no es válido.')

  const solicitud = await iniciarReagendadoPorCompita(token)
  if (!solicitud) return html('Enlace inválido', 'Este enlace ya no es válido o la solicitud está cerrada.')

  const admin = createAdminSupabase()

  // Traer datos del cliente para el email
  const { data: cliente } = await admin
    .from('usuarios')
    .select('nombre, email')
    .eq('id', solicitud.cliente_id)
    .single()

  // Traer telegram_chat_id del compita
  const { data: compita } = await admin
    .from('compitas')
    .select('telegram_chat_id, nombre')
    .eq('id', solicitud.compita_id)
    .single()

  // Poner al compita en modo sugerir_horarios para que escriba los nuevos slots
  if (compita?.telegram_chat_id) {
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const clienteEmail = cliente?.email ?? ''
    const clienteNombre = cliente?.nombre ?? 'el cliente'
    await admin.from('telegram_estados').upsert(
      {
        chat_id: compita.telegram_chat_id,
        registro_pendiente: false,
        pendiente_accion: `sugerir_r:${solicitud.id}:${clienteEmail}:${clienteNombre}`,
        pendiente_expira: expira,
      },
      { onConflict: 'chat_id' },
    )
    try {
      await sendTelegramMessage(
        compita.telegram_chat_id,
        `🔄 <b>Reagendado iniciado</b>\n\n¿Cuándo puedes tener la llamada con ${clienteNombre}?\n\n✍️ <b>Escribe los horarios que te funcionen</b> y se los haremos llegar por email.\n\n📅 <i>Incluye el día y la hora exacta. Por ejemplo: lunes 13 de octubre a las 3:00pm.</i>`,
      )
    } catch (e) { console.error('Telegram reagendar compita:', e) }
  }

  // Notificar al cliente por email que el compita necesita cambiar la fecha
  if (cliente) {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    try {
      await resend.emails.send({
        from: 'Compaz <visitas@micompaz.com>',
        to: cliente.email,
        subject: `${solicitud.compita_nombre} necesita cambiar la fecha de la llamada`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">Cambio de fecha</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
              <strong>${solicitud.compita_nombre}</strong> tuvo una eventualidad y necesita cambiar la fecha de la llamada.
            </p>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
              En breve recibirás un correo con los nuevos horarios disponibles para que puedas elegir el que mejor te quede.
            </p>
            <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>
        `,
      })
    } catch (e) { console.error('Email cliente reagendar:', e) }
  }

  // Notificar al admin
  const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (adminTg) {
    try {
      await sendTelegramMessage(
        adminTg,
        `🔄 <b>Reagendado por compita</b>\n\n<b>Compita:</b> ${solicitud.compita_nombre}\n<b>Cliente:</b> ${cliente?.nombre ?? ''}\n\nEl compita inició un reagendado desde el email de confirmación.`,
      )
    } catch (e) { console.error('Telegram admin reagendar:', e) }
  }

  return html(
    'Reagendado iniciado',
    'Recibimos tu solicitud. Escríbenos en Telegram los nuevos horarios que te funcionen y se los haremos llegar al cliente.',
  )
}
