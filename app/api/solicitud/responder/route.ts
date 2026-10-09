// /api/solicitud/responder?token=&slot=0|1|2|-1&quien=compita&s=<firma>
// Botones URL de Telegram usados en el reagendado. GET muestra confirmación; POST ejecuta.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { responderSolicitud } from '@/lib/solicitudes'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { formatSlotVE } from '@/lib/format'
import { qRol, rolValido } from '@/lib/links'
import { pagina, puertaConfirmacion } from '@/lib/confirm'

function leer(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const token = sp.get('token')
  const slot = parseInt(sp.get('slot') ?? '', 10)
  if (!token || !Number.isInteger(slot) || slot < -1 || slot > 2 || !rolValido(token, sp.get('quien'), sp.get('s')) || sp.get('quien') !== 'compita') return null
  return { token, slot }
}

export async function GET(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)
  return puertaConfirmacion(
    req,
    p.slot === -1 ? '¿No puedes en ninguno?' : 'Confirmar horario',
    p.slot === -1 ? 'Rechazarás la propuesta y podrás sugerir otros horarios.' : 'Confirmarás este horario para la llamada.',
    p.slot === -1 ? 'No puedo en ninguno' : 'Confirmar horario',
  )
}

export async function POST(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)

  const r = await responderSolicitud(p.token, p.slot)
  if (!r.ok) {
    return pagina('Enlace inválido', r.motivo === 'slot_pasado' ? 'Ese horario ya pasó. Pide al cliente que proponga otros.' : 'Este enlace ya fue usado o no existe.', 410)
  }
  const solicitud = r.solicitud
  const admin = createAdminSupabase()
  const [{ data: cliente }, { data: compita }] = await Promise.all([
    admin.from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single(),
    admin.from('compitas').select('telegram_chat_id').eq('id', solicitud.compita_id).single(),
  ])

  if (solicitud.estado === 'rechazada') {
    await avisarAdmin(`❌ <b>${esc(solicitud.compita_nombre)}</b> rechazó la solicitud de entrevista.\nEsperando que sugiera horarios alternativos.`)
    if (compita?.telegram_chat_id) {
      await admin.from('telegram_estados').upsert(
        { chat_id: compita.telegram_chat_id, registro_pendiente: false, pendiente_accion: `sugerir_horarios:${solicitud.id}:${cliente?.email ?? ''}:${cliente?.nombre ?? 'el cliente'}`, pendiente_expira: new Date(Date.now() + 24 * 3600_000).toISOString() },
        { onConflict: 'chat_id' },
      )
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          `Entendido. ¿Puedes sugerir otros horarios que sí te funcionen?\n\n✍️ <b>Responde a este mensaje</b> y se los haremos llegar a ${esc(cliente?.nombre ?? 'el cliente')} por email.\n\n📅 <i>Incluye el día y la hora exacta. Por ejemplo: lunes 6 de octubre a las 3:00pm.</i>`,
        )
      } catch (e) { console.error('Telegram pedir horarios:', e) }
    }
    return pagina('Respuesta registrada', 'Gracias. Te llegará un mensaje por Telegram para que puedas sugerir otros horarios.')
  }

  const slotLabel = formatSlotVE(solicitud.slot_confirmado!)
  let emailOk = !cliente?.email
  if (cliente?.email) {
    try {
      await sendEmail({
        to: cliente.email,
        subject: `Tu llamada con ${solicitud.compita_nombre} está confirmada`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">¡Llamada confirmada!</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
              <strong>${esc(solicitud.compita_nombre)}</strong> confirmó la llamada para el:<br><strong>${esc(slotLabel)}</strong>
            </p>
            <p style="color:#4A3B6B;background:#F5F0E8;border:2px solid #D4C9E8;border-radius:12px;padding:14px;font-size:14px">
              📩 Te enviaremos el link de acceso a la llamada <strong>1 hora antes</strong>.
            </p>
            <p style="color:#6B5C90;font-size:14px;line-height:1.6;margin-top:24px">¿Surgió algo y necesitas cambiar la fecha? Puedes proponer nuevos horarios desde aquí:</p>
            <a href="${SITE_URL}/reagendar/${encodeURIComponent(solicitud.token_respuesta)}" style="display:inline-block;background:#6B5C90;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:14px;margin-top:4px">🔄 Reagendar llamada</a>
            <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>`,
      })
      emailOk = true
    } catch (e) { console.error('Email cliente confirmación:', e) }
  }

  if (compita?.telegram_chat_id) {
    try {
      await sendTelegramMessage(
        compita.telegram_chat_id,
        [`✅ <b>Llamada confirmada</b>`, ``, `<b>Cliente:</b> ${esc(cliente?.nombre ?? 'Cliente')}`, `<b>Fecha y hora:</b> ${esc(slotLabel)}`, ``, `📩 Te enviaremos el link de acceso <b>1 hora antes</b> de la llamada.`, ``, `Si surge algo y necesitas cambiar la fecha, toca el botón de abajo.`].join('\n'),
        { inline_keyboard: [[{ text: '🔄 Reagendar llamada', url: `${SITE_URL}/api/solicitud/reagendar-compita?token=${solicitud.token_respuesta}&${qRol(solicitud.token_respuesta, 'compita')}` }]] },
      )
    } catch (e) { console.error('Telegram compita confirmación:', e) }
  }

  await avisarAdmin([
    `📞 <b>Entrevista confirmada</b>`, ``,
    `<b>Cliente:</b> ${esc(cliente?.nombre ?? 'Cliente')} (${esc(cliente?.email ?? '')})`,
    `<b>Compita:</b> ${esc(solicitud.compita_nombre)}`,
    `<b>Fecha y hora:</b> ${esc(slotLabel)}`, ``,
    emailOk ? `🔗 El link de sala se generará y enviará 1 hora antes.` : `⚠️ No se pudo enviar el correo de confirmación al cliente.`,
  ].join('\n'))

  return pagina('Llamada confirmada', `Confirmaste la llamada para el ${slotLabel}. Te llegará el link por Telegram.`)
}
