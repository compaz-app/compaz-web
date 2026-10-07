import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { ok, err, unauthorized, notFound } from '@/lib/api'
import { sendTelegramMessage, INLINE_REAGENDAR_VISITA } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// PUT /api/visita/fecha
// Guarda la fecha acordada Y confirma la coordinación en un solo paso:
// pre_visita → programada. Elimina el riesgo de dropout entre los dos pasos.
export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const { visita_id, fecha_programada } = await req.json() as {
    visita_id: string
    fecha_programada: string // 'YYYY-MM-DD'
  }

  if (!visita_id || !fecha_programada) return err('Faltan parámetros')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_programada)) return err('Fecha inválida')
  const hoy = new Date().toISOString().slice(0, 10)
  if (fecha_programada < hoy) return err('La fecha debe ser hoy o en el futuro')

  const admin = createAdminSupabase()

  const { data: visita } = await admin
    .from('visitas')
    .select('id, usuario_id, compita_id, estado')
    .eq('id', visita_id)
    .single()

  if (!visita) return notFound()
  if (visita.usuario_id !== user.id) return err('Sin acceso', 403)
  if (!['pre_visita', 'programada'].includes(visita.estado)) return err('Estado de visita inválido')

  // Un solo update: guarda la fecha Y pasa a programada
  const { error } = await admin
    .from('visitas')
    .update({ fecha_programada, estado: 'programada' })
    .eq('id', visita_id)

  if (error) return err(error.message)

  const fechaFormateada = new Date(fecha_programada + 'T00:00:00').toLocaleDateString('es-VE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const [{ data: compita }, { data: cliente }] = await Promise.all([
    admin.from('compitas').select('telegram_chat_id, nombre').eq('id', visita.compita_id).single(),
    admin.from('usuarios').select('nombre, email').eq('id', visita.usuario_id).single(),
  ])

  if (compita?.telegram_chat_id) {
    try {
      await sendTelegramMessage(
        compita.telegram_chat_id,
        [
          `✅ <b>¡Visita confirmada!</b>`,
          ``,
          `${cliente?.nombre ?? 'El cliente'} fijó la fecha de la primera visita:`,
          ``,
          `📅 <b>${fechaFormateada}</b>`,
          ``,
          `Recibirás un recordatorio el día anterior. Si necesitas reagendar, toca el botón <b>▶️ Iniciar visita</b> — en la pantalla de confirmación verás la opción <b>"🔄 Necesito reagendar"</b>.`,
        ].join('\n'),
        INLINE_REAGENDAR_VISITA,
      )
    } catch (e) { console.error('Telegram fecha/confirmar compita:', e) }
  }

  if (cliente?.email) {
    try {
      await resend.emails.send({
        from: 'Compaz <visitas@micompaz.com>',
        to: cliente.email,
        subject: `✅ Visita confirmada: ${fechaFormateada}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px;margin-bottom:12px">✅ Visita confirmada</h2>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
              La primera visita de <strong>${compita?.nombre ?? 'tu compita'}</strong> con tu familiar está agendada.
            </p>
            <div style="background:#F5F0FF;border:2px solid #7C4DFF;border-radius:12px;padding:16px 20px;margin:20px 0;text-align:center">
              <p style="color:#6B5C90;font-size:13px;margin:0 0 4px">Fecha de la visita</p>
              <p style="color:#2D1464;font-size:18px;font-weight:800;margin:0;text-transform:capitalize">${fechaFormateada}</p>
            </div>
            <p style="color:#4A3B6B;font-size:14px;line-height:1.6">
              Te enviaremos un recordatorio el día anterior. Si necesitas cambiar la fecha puedes reagendar desde tu dashboard.
            </p>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://micompaz.com'}/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:14px;margin-top:8px">
              Ver en el dashboard →
            </a>
            <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>
        `,
      })
    } catch (e) { console.error('Email confirmar visita cliente:', e) }
  }

  return ok({ fecha_programada, estado: 'programada' })
}
