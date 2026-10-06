// GET /api/solicitud/confirmacion-llamada?token=xxx&quien=cliente|compita&respuesta=si|no
// Registra si la llamada ocurrió. Si ambos confirman ✅, el cron enviará "¿quieres contratar?".
// Si alguien dice ❌, redirige al cliente a la página de reagendado.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudPorToken, registrarConfirmacion } from '@/lib/solicitudes'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

function html(titulo: string, cuerpo: string, boton?: { texto: string; href: string }) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${titulo} — Compaz</title>
    <style>
      body{font-family:Inter,sans-serif;background:#FDFAF6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box}
      .card{background:white;border:2px solid #E8E0D4;border-radius:24px;padding:40px 32px;max-width:480px;width:100%;text-align:center}
      h2{color:#1A0A3C;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:22px;margin-bottom:12px}
      p{color:#4A3B6B;line-height:1.6;font-size:15px}
      a.btn{display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:20px}
    </style></head>
    <body><div class="card">
      <h2>${titulo}</h2>
      <p>${cuerpo}</p>
      ${boton ? `<a class="btn" href="${boton.href}">${boton.texto}</a>` : ''}
    </div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const token = searchParams.get('token')
  const quien = searchParams.get('quien') as 'cliente' | 'compita' | null
  const respuesta = searchParams.get('respuesta')

  if (!token || (quien !== 'cliente' && quien !== 'compita') || (respuesta !== 'si' && respuesta !== 'no')) {
    return html('Enlace inválido', 'Este enlace no es válido.')
  }

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return html('Enlace inválido', 'No encontramos esta solicitud.')

  if (solicitud.estado === 'completada' || solicitud.estado === 'contratada') {
    return html('Ya registramos tu respuesta', 'Ya habías respondido. ¡Gracias!')
  }

  const ocurrio = respuesta === 'si'
  const actualizada = await registrarConfirmacion(solicitud.id, quien, ocurrio)
  if (!actualizada) return html('Error', 'No pudimos registrar tu respuesta. Intenta de nuevo.')

  const admin = createAdminSupabase()
  const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID

  // ── Si dice que NO ocurrió → notificar al admin y redirigir a reagendado ──
  if (!ocurrio) {
    const { data: cliente } = await admin
      .from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()

    // Notificar al admin
    if (adminTg) {
      try {
        await sendTelegramMessage(
          adminTg,
          [
            `⚠️ <b>Llamada no ocurrió</b>`,
            ``,
            `<b>${quien === 'cliente' ? 'El cliente' : 'El compita'}</b> reportó que la llamada con <b>${solicitud.compita_nombre}</b>${quien === 'compita' ? ` y <b>${cliente?.nombre ?? 'el cliente'}</b>` : ''} no se realizó.`,
            ``,
            `El cliente recibirá un link para proponer nuevos horarios.`,
          ].join('\n'),
        )
      } catch (e) { console.error('Telegram admin llamada no ocurrió:', e) }
    }

    // Si quien reporta es el compita, enviar email al cliente con link de reagendado
    if (quien === 'compita' && cliente?.email) {
      const reagendarUrl = `${SITE_URL}/reagendar/${token}`
      try {
        await resend.emails.send({
          from: 'Compaz <visitas@micompaz.com>',
          to: cliente.email,
          subject: `${solicitud.compita_nombre} propone reagendar la llamada`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">Reagendar con ${solicitud.compita_nombre}</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                Parece que la llamada no pudo realizarse. Elige nuevos horarios y ${solicitud.compita_nombre} confirmará el que mejor le quede.
              </p>
              <a href="${reagendarUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:16px">
                Proponer nuevos horarios →
              </a>
              <p style="color:#6B5C90;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
      } catch (e) { console.error('Email reagendar al cliente:', e) }
    }

    // Si es el cliente quien reporta, redirigir directamente a reagendado
    if (quien === 'cliente') {
      return NextResponse.redirect(`${SITE_URL}/reagendar/${token}`, 303)
    }

    return html(
      'Gracias por avisarnos',
      'Entendemos. Le enviaremos al cliente un enlace para que proponga nuevos horarios.',
    )
  }

  // ── Si dice que SÍ ocurrió ──────────────────────────────────────────────────
  const mensajeCliente = quien === 'cliente'
    ? '¡Perfecto! Ya registramos que la llamada fue bien. En un momento te preguntaremos si quieres contratar a ' + solicitud.compita_nombre + '.'
    : '¡Gracias! Ya registramos tu confirmación. Seguimos en contacto.'

  return html('¡Confirmado!', mensajeCliente)
}
