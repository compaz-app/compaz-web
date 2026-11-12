// Anuncio de una entrevista confirmada: correo al cliente, aviso al administrador y mensaje al compita con su botón de
// reagendar. Lo usan el camino anterior (el compita toca un horario propuesto) y el nuevo (el compita confirma la hora
// reservada), para que los dos hagan exactamente lo mismo.
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendEmail, SITE_URL as SITE_URL_PUBLICA } from '@/lib/email'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { esc } from '@/lib/html'
import { formatSlotVE } from '@/lib/format'
import { qRol } from '@/lib/links'
import type { Solicitud } from '@/types'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

export async function anunciarEntrevistaConfirmada(i: { solicitud: Solicitud; compita: { nombre: string }; chatId: string }): Promise<void> {
  const { solicitud, compita, chatId } = i
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
              Te enviaremos el link de acceso a la llamada <strong>1 hora antes</strong>.
            </p>
            <p style="color:#6B5C90;font-size:14px;line-height:1.6;margin-top:24px">¿Surgió algo y necesitas cambiar la fecha? Puedes proponer nuevos horarios desde aquí:</p>
            <a href="${SITE_URL_PUBLICA}/reagendar/${encodeURIComponent(solicitud.token_respuesta)}" style="display:inline-block;background:#6B5C90;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:14px;margin-top:4px">Reagendar llamada</a>
            <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>
        `,
      })
      emailOk = true
    } catch (e) { console.error('Email cliente confirmación:', e) }
  }

  await alertaAdmin('actividad', [
    `<b>Entrevista confirmada</b>`, ``,
    `<b>Cliente:</b> ${esc(cliente?.nombre ?? '')} (${esc(cliente?.email ?? '')})`,
    `<b>Compita:</b> ${esc(compita.nombre)}`,
    `<b>Fecha:</b> ${esc(slotLabel)}`, ``,
    emailOk ? `El link de sala se generará y enviará 1 hora antes.` : `No se pudo enviar el correo de confirmación al cliente. Avísale manualmente.`,
  ].join('\n'))

  await sendTelegramMessage(
    chatId,
    `<b>Llamada confirmada</b>\n\n<b>Cliente:</b> ${esc(cliente?.nombre ?? 'Cliente')}\n<b>Fecha y hora:</b> ${esc(slotLabel)}\n\nTe enviaremos el link de acceso <b>1 hora antes</b> de la llamada.\n\nSi necesitas cambiar la fecha, toca el botón de abajo.`,
    { inline_keyboard: [[{ text: 'Reagendar llamada', url: `${SITE_URL}/api/solicitud/reagendar-compita?token=${solicitud.token_respuesta}&${qRol(solicitud.token_respuesta, 'compita')}` }]] },
  )
}
