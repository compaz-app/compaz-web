// GET /api/solicitud/resultado-llamada?token=xxx&resultado=contratar|reagendar|no_contratar&quien=cliente|compita
// El cliente o compita toca este link desde el email/Telegram post-llamada.
import { NextRequest, NextResponse } from 'next/server'
import { getSolicitudPorToken, iniciarReagendadoPorCompita } from '@/lib/solicitudes'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function html(titulo: string, cuerpo: string, boton?: { texto: string; href: string }) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${titulo} — Compaz</title>
    <style>body{font-family:Inter,sans-serif;background:#FDFAF6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
    .card{background:white;border:2px solid #E8E0D4;border-radius:24px;padding:40px;max-width:480px;width:100%;text-align:center}
    h2{color:#1A0A3C;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:22px;margin-bottom:12px}
    p{color:#4A3B6B;line-height:1.6;font-size:15px}
    a.btn{display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:20px}</style></head>
    <body><div class="card"><h2>${titulo}</h2><p>${cuerpo}</p>${boton ? `<a class="btn" href="${boton.href}">${boton.texto}</a>` : ''}</div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin
  const { searchParams } = req.nextUrl
  const token = searchParams.get('token')
  const resultado = searchParams.get('resultado') as 'contratar' | 'reagendar' | 'no_contratar' | 'bien' | null
  const quien = (searchParams.get('quien') ?? 'cliente') as 'cliente' | 'compita'

  if (!token || !resultado) return html('Enlace inválido', 'Este enlace no es válido.')

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return html('Enlace inválido', 'No encontramos esta solicitud.')

  // Guardia de idempotencia: si ya se procesó el resultado, no reprocesar
  if (resultado !== 'bien' && resultado !== 'reagendar') {
    if (solicitud.estado === 'contratada') {
      return html('Ya registrado', 'Ya registramos que querías contratar a ' + (solicitud.compita_nombre ?? 'tu compita') + '. El equipo de Compaz está coordinando los detalles.')
    }
    if (solicitud.estado === 'rechazada' && resultado === 'no_contratar') {
      return NextResponse.redirect(`${origin}/compitas`, 303)
    }
    if (solicitud.estado === 'rechazada' && resultado === 'contratar') {
      return html('Enlace vencido', 'Esta sesión ya cerró. Si tienes alguna duda escríbenos a hola@micompaz.com.')
    }
  }

  const admin = createAdminSupabase()
  const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID

  const { data: cliente } = await admin
    .from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()
  const { data: compita } = await admin
    .from('compitas').select('telegram_chat_id, nombre').eq('id', solicitud.compita_id).single()

  // ── Compita reporta que estuvo bien — avisar que esperamos decisión del cliente ──
  if (quien === 'compita' && resultado === 'bien') {
    if (compita?.telegram_chat_id) {
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          `✅ <b>Llamada registrada</b>\n\nGracias por tu tiempo. Ahora esperamos que la familia nos confirme su decisión. Te avisamos en cuanto sepamos. ¡Gracias por ser parte de Compaz!`,
        )
      } catch (e) { console.error('Telegram bien compita:', e) }
    }
    return html('¡Gracias!', 'Registramos que la llamada fue bien. Estaremos en contacto según lo que decida la familia.')
  }

  // ── Reagendar (cliente o compita) ─────────────────────────────────────────
  if (resultado === 'reagendar') {
    if (quien === 'compita') {
      // Reusar el flujo existente de reagendar por compita
      const reagendado = await iniciarReagendadoPorCompita(token)
      if (!reagendado) return html('Error', 'No pudimos procesar el reagendado.')

      if (compita?.telegram_chat_id) {
        const clienteEmail = cliente?.email ?? ''
        const clienteNombre = cliente?.nombre ?? 'el cliente'
        const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        await admin.from('telegram_estados').upsert(
          { chat_id: compita.telegram_chat_id, registro_pendiente: false, pendiente_accion: `sugerir_r:${solicitud.id}:${clienteEmail}:${clienteNombre}`, pendiente_expira: expira },
          { onConflict: 'chat_id' },
        )
        try {
          await sendTelegramMessage(
            compita.telegram_chat_id,
            `🔄 <b>Reagendado iniciado</b>\n\n¿Cuándo puedes repetir la llamada con ${clienteNombre}?\n\n✍️ <b>Escribe los horarios que te funcionen</b> y se los haremos llegar por email.\n\n📅 <i>Incluye el día y la hora exacta. Por ejemplo: lunes 13 de octubre a las 3:00pm.</i>`,
          )
        } catch (e) { console.error('Telegram reagendar compita:', e) }
      }

      if (cliente?.email) {
        try {
          await resend.emails.send({
            from: 'Compaz <visitas@micompaz.com>',
            to: cliente.email,
            subject: `${solicitud.compita_nombre} necesita reagendar la llamada`,
            html: `
              <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
                <h2 style="color:#2D1464;font-size:22px">Reagendando la llamada</h2>
                <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                  <strong>${solicitud.compita_nombre}</strong> tuvo un problema técnico y necesita reagendar.
                  En breve recibirás un correo con nuevos horarios disponibles.
                </p>
                <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
              </div>
            `,
          })
        } catch (e) { console.error('Email reagendar al cliente desde compita:', e) }
      }

      return html('Reagendado iniciado', 'Escríbenos en Telegram los nuevos horarios y se los haremos llegar al cliente.')
    }

    // Cliente quiere reagendar → redirigir al marketplace con reagendar param
    return NextResponse.redirect(`${origin}/compitas?compita=${solicitud.compita_id}&reagendar=${solicitud.id}`, 303)
  }

  // ── Cliente contrata ──────────────────────────────────────────────────────
  if (resultado === 'contratar') {
    const { error: errUpdate } = await admin.from('solicitudes')
      .update({ estado: 'contratada', confirmacion_cliente: true, confirmacion_compita: true })
      .eq('id', solicitud.id)
    if (errUpdate) {
      console.error('Error guardando contratación:', errUpdate)
      return html('Error al guardar', 'No pudimos registrar tu decisión. Por favor escríbenos a hola@micompaz.com.')
    }

    // Notificar al compita
    if (compita?.telegram_chat_id) {
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          `🎉 <b>¡Felicitaciones!</b>\n\n<b>${cliente?.nombre ?? 'La familia'}</b> decidió contratarte.\n\nEl equipo de Compaz se pondrá en contacto para coordinar los próximos pasos.`,
        )
      } catch (e) { console.error('Telegram contratada compita:', e) }
    }

    // Notificar al admin
    if (adminTg) {
      try {
        await sendTelegramMessage(
          adminTg,
          `🎉 <b>¡Contratación!</b>\n\n<b>Cliente:</b> ${cliente?.nombre ?? ''} (${cliente?.email ?? ''})\n<b>Compita:</b> ${solicitud.compita_nombre}\n\nEl cliente confirmó que quiere contratar.`,
        )
      } catch (e) { console.error('Telegram admin contratada:', e) }
    }

    return html(
      '¡Genial!',
      `El equipo de Compaz se pondrá en contacto contigo pronto para coordinar los detalles con <strong>${solicitud.compita_nombre}</strong>.`,
    )
  }

  // ── Cliente no contrata ───────────────────────────────────────────────────
  if (resultado === 'no_contratar') {
    const { error: errUpdate } = await admin.from('solicitudes')
      .update({ confirmacion_cliente: false, estado: 'rechazada' })
      .eq('id', solicitud.id)
    if (errUpdate) console.error('Error guardando no_contratar:', errUpdate)

    // Notificar al compita con cierre amable y consejos para mejorar perfil
    if (compita?.telegram_chat_id) {
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          `👋 <b>Gracias por tu dedicación</b>\n\nLa familia decidió no seguir adelante en esta ocasión. No es un reflejo de tu valor. A veces simplemente no encajan las necesidades o la química. Pasa, y no hay que desanimarse.\n\nMientras tanto, hay cosas que pueden ayudarte a destacar más:\n\n1. Agrega un video de presentación o mejora el que ya tienes. Las familias confían mucho más cuando te ven hablar.\n2. Actualiza o mejora la foto que tienes en tu perfil.\n3. Describe con más detalle tu experiencia específica (adultos mayores, niños, enfermedades crónicas, etc.).\n\nEl equipo de Compaz está trabajando para conectarte con nuevas familias. ¡Tú puedes!`,
        )
      } catch (e) { console.error('Telegram no_contratar compita:', e) }
    }

    // Notificar al admin
    if (adminTg) {
      try {
        await sendTelegramMessage(
          adminTg,
          `ℹ️ <b>${cliente?.nombre ?? 'Un cliente'}</b> decidió no contratar a <b>${solicitud.compita_nombre}</b> después de la llamada.`,
        )
      } catch (e) { console.error('Telegram admin no contratar:', e) }
    }

    return NextResponse.redirect(`${origin}/compitas`, 303)
  }

  return html('Enlace inválido', 'Opción no reconocida.')
}
