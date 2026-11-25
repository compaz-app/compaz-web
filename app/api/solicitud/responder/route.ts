// /api/solicitud/responder?token=&slot=0|1|2|-1&quien=compita&s=<firma>
// Botones URL de Telegram usados en el reagendado. GET muestra confirmación; POST ejecuta.
import { novedadEntrevistaConfirmada } from '@/lib/entrevista-confirmada'
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { responderSolicitud } from '@/lib/solicitudes'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { notificar } from '@/lib/avisos'
import { formatSlotVE } from '@/lib/format'
import { qRol, rolValido } from '@/lib/links'
import { pagina as paginaSola, paginaPara, puertaConfirmacion } from '@/lib/confirm'
// Esta ruta la ve siempre el compita: sus páginas de éxito vuelven a donde él trabaja (ver botonDe).
const pagina = (titulo: string, texto: string, status = 200, boton?: { texto: string; href: string }) => (boton ? paginaSola(titulo, texto, status, boton) : paginaPara('compita', titulo, texto, status))

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
    p.slot === -1 ? 'Le diremos al cliente que elija a otro compita.' : 'Confirmarás este horario para la llamada.',
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
    await alertaAdmin('actividad', `❌ <b>${esc(solicitud.compita_nombre)}</b> rechazó la solicitud de entrevista.`)
    // El cliente se entera al instante; el compita no escribe horas: sus horas viven en su perfil.
    await notificar({
      plantilla: 'solicitud_rechazada_cliente', canal: 'correo', destinatario: { tipo: 'cliente', id: solicitud.cliente_id },
      variables: { solicitudId: solicitud.id }, entidad: 'solicitud', entidadId: solicitud.id, paso: 6, claveUnica: `solicitud_rechazada:${solicitud.id}`,
    })
    return pagina('Respuesta registrada', 'Gracias por avisar. Le decimos al cliente que elija a otro compita. Si tus horas cambian, escribe /horas en Telegram.')
  }

  const slotLabel = formatSlotVE(solicitud.slot_confirmado!)
  await novedadEntrevistaConfirmada(solicitud, solicitud.compita_nombre ?? 'Tu compita')
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
             Te enviaremos el link de acceso a la llamada <strong>1 hora antes</strong>.
            </p>
            <p style="color:#6B5C90;font-size:14px;line-height:1.6;margin-top:24px">¿Surgió algo y necesitas cambiar la fecha? Puedes proponer nuevos horarios desde aquí:</p>
            <a href="${SITE_URL}/reagendar/${encodeURIComponent(solicitud.token_respuesta)}" style="display:inline-block;background:#6B5C90;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:14px;margin-top:4px">Reagendar llamada</a>
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

  await alertaAdmin('actividad', [
    `📞 <b>Entrevista confirmada</b>`, ``,
    `<b>Cliente:</b> ${esc(cliente?.nombre ?? 'Cliente')} (${esc(cliente?.email ?? '')})`,
    `<b>Compita:</b> ${esc(solicitud.compita_nombre)}`,
    `<b>Fecha y hora:</b> ${esc(slotLabel)}`, ``,
    emailOk ? `🔗 El link de sala se generará y enviará 1 hora antes.` : `⚠️ No se pudo enviar el correo de confirmación al cliente.`,
  ].join('\n'))

  return pagina('Llamada confirmada', `Confirmaste la llamada para el ${slotLabel}. Te llegará el link por Telegram.`)
}
