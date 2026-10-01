// GET /api/solicitud/seguimiento?token=xxx&respuesta=si|no
// El cliente responde si quiere contratar al compita después de la llamada
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudPorToken } from '@/lib/solicitudes'
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
  const respuesta = searchParams.get('respuesta')

  if (!token || (respuesta !== 'si' && respuesta !== 'no')) {
    return html('Enlace inválido', 'Este enlace no es válido.')
  }

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) {
    return html('Enlace inválido', 'No encontramos esta solicitud.')
  }

  const admin = createAdminSupabase()
  const { data: cliente } = await admin
    .from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()

  const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID

  if (respuesta === 'si') {
    // Actualizar estado a completada
    await admin.from('solicitudes').update({ estado: 'completada' }).eq('id', solicitud.id)

    // Notificar al admin por email
    try {
      await resend.emails.send({
        from: 'Compaz <visitas@micompaz.com>',
        to: 'juantenreiro@gmail.com',
        subject: `🎉 ${cliente?.nombre ?? 'Un cliente'} quiere contratar a ${solicitud.compita_nombre}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464">¡Contratación confirmada!</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
              <strong>${cliente?.nombre ?? 'Un cliente'}</strong> (${cliente?.email ?? ''}) quiere contratar a <strong>${solicitud.compita_nombre}</strong>.
            </p>
            <p style="color:#4A3B6B;font-size:15px">Coordina los próximos pasos con ambas partes.</p>
          </div>
        `,
      })
    } catch (e) { console.error('Email admin contratación:', e) }

    // Notificar al admin por Telegram
    if (adminTg) {
      try {
        await sendTelegramMessage(
          adminTg,
          `🎉 <b>¡Contratación!</b>\n\n<b>${cliente?.nombre ?? 'Un cliente'}</b> (${cliente?.email ?? ''}) quiere contratar a <b>${solicitud.compita_nombre}</b>.\n\nCoordina los próximos pasos.`,
        )
      } catch (e) { console.error('Telegram admin contratación:', e) }
    }

    // Notificar al compita por Telegram
    const { data: compita } = await admin
      .from('compitas').select('telegram_chat_id').eq('id', solicitud.compita_id).single()
    if (compita?.telegram_chat_id) {
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          `🎉 <b>¡Buenas noticias!</b>\n\n<b>${cliente?.nombre ?? 'El cliente'}</b> quiere contratarte. El equipo Compaz te contactará pronto para coordinar todo.\n\n¡Sigue así! 🤝`,
        )
      } catch (e) { console.error('Telegram compita contratación:', e) }
    }

    return html(
      '¡Perfecto!',
      `El equipo Compaz te contactará pronto para coordinar todo con <strong>${solicitud.compita_nombre}</strong>. ¡Gracias por confiar en nosotros! 🤝`,
    )
  }

  // respuesta === 'no'
  // Notificar al compita con mensaje empático
  const { data: compitaNo } = await admin
    .from('compitas').select('telegram_chat_id').eq('id', solicitud.compita_id).single()
  if (compitaNo?.telegram_chat_id) {
    try {
      await sendTelegramMessage(
        compitaNo.telegram_chat_id,
        `Hola 💙\n\nEsta vez el cliente decidió no continuar. No pasa nada — a veces simplemente no es el momento o no era la persona indicada, y eso no tiene nada que ver con tu talento ni tu valor como compita.\n\nSigue adelante con la misma actitud. Tu próxima oportunidad está más cerca de lo que crees. 🌟\n\n<i>Si quieres, puedes mejorar tu perfil para que más familias te conozcan.</i>`,
      )
    } catch (e) { console.error('Telegram compita rechazo:', e) }
  }

  return html(
    'Gracias por tu tiempo',
    `Entendemos. Cuando estés listo, puedes explorar otros compitas disponibles.`,
    { texto: 'Ver otros compitas →', href: `${SITE_URL}/compitas` },
  )
}
