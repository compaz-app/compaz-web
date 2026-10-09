// /api/solicitud/reagendar-compita?token=&quien=compita&s=<firma>
// La compita inicia un reagendado desde Telegram. GET confirma; POST ejecuta.
import { NextRequest } from 'next/server'
import { iniciarReagendadoPorCompita } from '@/lib/solicitudes'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { sendEmail } from '@/lib/email'
import { esc } from '@/lib/html'
import { rolValido } from '@/lib/links'
import { pagina, puertaConfirmacion } from '@/lib/confirm'

function leer(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const token = sp.get('token')
  if (!token || sp.get('quien') !== 'compita' || !rolValido(token, 'compita', sp.get('s'))) return null
  return { token }
}

export async function GET(req: NextRequest) {
  if (!leer(req)) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)
  return puertaConfirmacion(req, '¿Necesitas reagendar la llamada?', 'Le avisaremos al cliente y podrás sugerir nuevos horarios por Telegram.', 'Sí, reagendar')
}

export async function POST(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)

  const solicitud = await iniciarReagendadoPorCompita(p.token)
  if (!solicitud) return pagina('Enlace inválido', 'Este enlace ya no es válido o la solicitud está cerrada.', 410)

  const admin = createAdminSupabase()
  const [{ data: cliente }, { data: compita }] = await Promise.all([
    admin.from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single(),
    admin.from('compitas').select('telegram_chat_id').eq('id', solicitud.compita_id).single(),
  ])

  if (compita?.telegram_chat_id) {
    await admin.from('telegram_estados').upsert(
      { chat_id: compita.telegram_chat_id, registro_pendiente: false, pendiente_accion: `sugerir_r:${solicitud.id}:${cliente?.email ?? ''}:${cliente?.nombre ?? 'el cliente'}`, pendiente_expira: new Date(Date.now() + 24 * 3600_000).toISOString() },
      { onConflict: 'chat_id' },
    )
    try {
      await sendTelegramMessage(
        compita.telegram_chat_id,
        `🔄 <b>Reagendado iniciado</b>\n\n¿Cuándo puedes tener la llamada con ${esc(cliente?.nombre ?? 'el cliente')}?\n\n✍️ <b>Responde a este mensaje con los horarios que te funcionen</b> y se los haremos llegar por email.\n\n📅 <i>Incluye el día y la hora exacta. Por ejemplo: lunes 13 de octubre a las 3:00pm.</i>`,
      )
    } catch (e) { console.error('Telegram reagendar compita:', e) }
  }

  if (cliente?.email) {
    try {
      await sendEmail({
        to: cliente.email,
        subject: `${solicitud.compita_nombre} necesita cambiar la fecha de la llamada`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">Cambio de fecha</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6"><strong>${esc(solicitud.compita_nombre)}</strong> tuvo una eventualidad y necesita cambiar la fecha de la llamada.</p>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">En breve recibirás un correo con los nuevos horarios disponibles para que puedas elegir el que mejor te quede.</p>
            <p style="color:#6B5C90;font-size:13px;margin-top:24px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>`,
      })
    } catch (e) { console.error('Email cliente reagendar:', e) }
  }

  await avisarAdmin(`🔄 <b>Reagendado por compita</b>\n\n<b>Compita:</b> ${esc(solicitud.compita_nombre)}\n<b>Cliente:</b> ${esc(cliente?.nombre ?? '')}\n\nLa compita inició un reagendado desde Telegram.`)

  return pagina('Reagendado iniciado', 'Recibimos tu solicitud. Escríbenos en Telegram los nuevos horarios que te funcionen y se los haremos llegar al cliente.')
}
