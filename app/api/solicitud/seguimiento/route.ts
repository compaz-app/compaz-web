// GET /api/solicitud/seguimiento?token=xxx&respuesta=si|no
// El cliente responde si quiere contratar al compita después de la llamada
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudPorToken } from '@/lib/solicitudes'
import { sendTelegramMessage, makeInlineKeyboard } from '@/lib/telegram'
import { generarTokenPerfil } from '@/lib/compita-tokens'

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

  // Idempotencia: bloquear si ya pasó a estado terminal (completada=sí, contratada=ya pagó)
  // NO usar respondido_at como señal del cliente: confirmarSlot lo setea cuando el compita
  // acepta el slot, por lo que siempre es no-nulo en solicitudes aceptadas.
  if (solicitud.estado === 'completada' || solicitud.estado === 'contratada') {
    return html('Ya registramos tu respuesta', 'Ya habías respondido a esta encuesta. ¡Gracias!')
  }

  // TTL: el link expira 72 horas después del slot confirmado
  if (solicitud.slot_confirmado) {
    const expira = new Date(new Date(solicitud.slot_confirmado).getTime() + 72 * 60 * 60 * 1000)
    if (new Date() > expira) {
      return html('Enlace expirado', 'Este enlace ya no está activo. Si tienes dudas, escríbenos directamente.')
    }
  }

  const admin = createAdminSupabase()
  const { data: cliente } = await admin
    .from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()

  const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID

  if (respuesta === 'si') {
    // Verificar que no haya respondido ya (idempotencia)
    const { data: claimed } = await admin
      .from('solicitudes')
      .select('id')
      .eq('id', solicitud.id)
      .eq('estado', 'aceptada')
      .single()
    if (!claimed) return html('Ya registramos tu respuesta', 'Ya habías respondido a esta encuesta. ¡Gracias!')

    // Redirigir al flujo de pago — es donde se formaliza la contratación
    return NextResponse.redirect(`${SITE_URL}/pago?solicitud=${solicitud.id}`, { status: 302 })
  }

  // respuesta === 'no'
  // Marcar seguimiento2_enviado para suprimir el recordatorio de 24h (el cliente ya respondió)
  await admin.from('solicitudes').update({
    respondido_at: new Date().toISOString(),
    seguimiento2_enviado: true,
  }).eq('id', solicitud.id)

  // Notificar al compita con mensaje empático
  const { data: compitaNo } = await admin
    .from('compitas').select('id, telegram_chat_id').eq('id', solicitud.compita_id).single()
  if (compitaNo?.telegram_chat_id) {
    try {
      // Generar link de perfil personalizado
      let perfilUrl = `${SITE_URL}/compita/perfil`
      try {
        const token = await generarTokenPerfil(compitaNo.id)
        perfilUrl = `${SITE_URL}/compita/perfil?token=${token}`
      } catch (e) { console.error('Error generando token perfil:', e) }

      const teclado = makeInlineKeyboard([
        [{ text: '✏️ Mejorar mi perfil', url: perfilUrl }],
        [{ text: '📋 Ver mis opciones', callback_data: 'cmd_menu' }],
      ])

      await sendTelegramMessage(
        compitaNo.telegram_chat_id,
        [
          `Hola 💙`,
          ``,
          `Esta vez el cliente decidió no continuar. No pasa nada — a veces simplemente no es el momento o no era la persona indicada, y eso no tiene nada que ver con tu talento ni tu valor como compita.`,
          ``,
          `Sigue adelante con la misma actitud. Tu próxima oportunidad está más cerca de lo que crees. 🌟`,
          ``,
          `━━━━━━━━━━━━━━━━━━━`,
          ``,
          `💡 <b>¿Sabías que puedes mejorar tu perfil?</b>`,
          `Desde tu perfil puedes:`,
          `• 📸 Cambiar tu foto`,
          `• ✍️ Actualizar tu descripción`,
          `• 🛎️ Agregar o quitar servicios que ofreces`,
          `• 🕐 Poner tus horarios disponibles`,
          `• 🎥 Subir un video de presentación`,
          ``,
          `Un perfil completo atrae más familias. Toca el botón aquí abajo para editarlo ahora. 👇`,
          ``,
          `<i>También puedes escribir /perfil en cualquier momento para obtener un nuevo enlace, o /menu para ver todo lo que puedes hacer desde aquí.</i>`,
        ].join('\n'),
        teclado,
      )
    } catch (e) { console.error('Telegram compita rechazo:', e) }
  }

  return html(
    'Gracias por tu tiempo',
    `Entendemos. Cuando estés listo, puedes explorar otros compitas disponibles.`,
    { texto: 'Ver otros compitas →', href: `${SITE_URL}/compitas` },
  )
}
