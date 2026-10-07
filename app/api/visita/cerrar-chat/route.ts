import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { ok, err, unauthorized, notFound } from '@/lib/api'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST /api/visita/cerrar-chat
// Cierra el ciclo de coordinación: pre_visita → programada
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const { visita_id } = await req.json() as { visita_id: string }
  if (!visita_id) return err('Falta visita_id')

  const admin = createAdminSupabase()

  const { data: visita } = await admin
    .from('visitas')
    .select('id, usuario_id, compita_id, estado, fecha_programada')
    .eq('id', visita_id)
    .single()

  if (!visita) return notFound()
  if (visita.usuario_id !== user.id) return err('Sin acceso', 403)
  if (visita.estado !== 'pre_visita') return err('Solo se puede cerrar una visita en pre_visita')

  const { error } = await admin
    .from('visitas')
    .update({ estado: 'programada' })
    .eq('id', visita_id)

  if (error) return err(error.message)

  // Notificar al compita y al cliente
  const fechaFormateada = visita.fecha_programada
    ? new Date(visita.fecha_programada + 'T00:00:00').toLocaleDateString('es-VE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  const [{ data: compita }, { data: cliente }] = await Promise.all([
    admin.from('compitas').select('telegram_chat_id, nombre').eq('id', visita.compita_id).single(),
    admin.from('usuarios').select('nombre, email').eq('id', visita.usuario_id).single(),
  ])

  if (compita?.telegram_chat_id) {
    try {
      await sendTelegramMessage(
        compita.telegram_chat_id,
        [
          `✅ <b>¡Todo coordinado!</b>`,
          ``,
          `${cliente?.nombre ?? 'El cliente'} confirmó que ya quedaron de acuerdo.`,
          fechaFormateada ? `\n📅 <b>Fecha de la visita:</b> ${fechaFormateada}` : '',
          ``,
          `Recibirás un recordatorio el día anterior. Si necesitas reagendar, escríbele al cliente por el chat del dashboard.`,
        ].filter(Boolean).join('\n'),
      )
    } catch (e) { console.error('Telegram cerrar-chat compita:', e) }
  }

  if (cliente?.email) {
    try {
      await resend.emails.send({
        from: 'Compaz <visitas@micompaz.com>',
        to: cliente.email,
        subject: `¡Visita confirmada${fechaFormateada ? `: ${fechaFormateada}` : ''}!`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px;margin-bottom:12px">✅ Visita confirmada</h2>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
              Todo está listo para la primera visita de <strong>${compita?.nombre ?? 'tu compita'}</strong> con tu familiar.
            </p>
            ${fechaFormateada ? `
            <div style="background:#F5F0FF;border:2px solid #7C4DFF;border-radius:12px;padding:16px 20px;margin:16px 0;text-align:center">
              <p style="color:#6B5C90;font-size:13px;margin:0 0 4px">Fecha de la visita</p>
              <p style="color:#2D1464;font-size:18px;font-weight:800;margin:0;text-transform:capitalize">${fechaFormateada}</p>
            </div>
            <p style="color:#4A3B6B;font-size:14px;line-height:1.6">
              Te enviaremos un recordatorio el día anterior. Si necesitas hacer algún cambio, puedes reagendar desde tu dashboard.
            </p>` : ''}
            <a href="https://micompaz.com/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:14px;margin-top:8px">
              Ver en el dashboard →
            </a>
            <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>
        `,
      })
    } catch (e) { console.error('Email cerrar-chat cliente:', e) }
  }

  return ok({ estado: 'programada' })
}
