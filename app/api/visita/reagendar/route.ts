import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { ok, err, unauthorized, notFound } from '@/lib/api'
import { sendTelegramMessage, INLINE_INICIO } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const ADMIN_TG = process.env.TELEGRAM_ADMIN_CHAT_ID ?? ''

// POST /api/visita/reagendar
// Cancela la fecha acordada y vuelve al estado pre_visita para recoordinar
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
  if (!['pre_visita', 'programada'].includes(visita.estado)) return err('Solo se puede reagendar desde pre_visita o programada')

  const { error } = await admin
    .from('visitas')
    .update({ estado: 'pre_visita', fecha_programada: null })
    .eq('id', visita_id)

  if (error) return err(error.message)

  const fechaAnterior = visita.fecha_programada
    ? new Date(visita.fecha_programada + 'T00:00:00').toLocaleDateString('es-VE', {
        weekday: 'long', day: 'numeric', month: 'long',
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
          `🔄 <b>La visita necesita reagendarse</b>`,
          ``,
          `${cliente?.nombre ?? 'El cliente'} canceló la fecha${fechaAnterior ? ` del ${fechaAnterior}` : ''} y necesita acordar un nuevo día.`,
          ``,
          `Escríbele desde este mismo chat para coordinar una nueva fecha. Ellos lo verán en su portal.`,
        ].join('\n'),
        INLINE_INICIO,
      )
    } catch (e) { console.error('Telegram reagendar compita:', e) }
  }

  if (cliente?.email) {
    try {
      await resend.emails.send({
        from: 'Compaz <visitas@micompaz.com>',
        to: cliente.email,
        subject: 'Visita reagendada — coordina la nueva fecha con tu compita',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px;margin-bottom:12px">🔄 Visita reagendada</h2>
            <p style="color:#4A3B6B;font-size:15px;line-height:1.6">
              Cancelaste la fecha${fechaAnterior ? ` del <strong>${fechaAnterior}</strong>` : ''}. Le avisamos a <strong>${compita?.nombre ?? 'tu compita'}</strong> para que coordinen un nuevo día.
            </p>
            <p style="color:#4A3B6B;font-size:14px;line-height:1.6">
              Entra al dashboard, escríbele por el chat y acuerden la nueva fecha.
            </p>
            <a href="https://micompaz.com/dashboard" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:14px;margin-top:8px">
              Ir al chat →
            </a>
            <p style="color:#9990A8;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
          </div>
        `,
      })
    } catch (e) { console.error('Email reagendar cliente:', e) }
  }

  // Alerta al admin si esta visita acumula 3+ reagendados
  try {
    const { count: totalReagendados } = await admin
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('visit_id', visita_id)
      .eq('origen', 'admin')
      .like('contenido', 'reagendado:%')
    const nuevo = (totalReagendados ?? 0) + 1
    await admin.from('mensajes').insert({ visit_id: visita_id, origen: 'admin', tipo: 'texto', contenido: `reagendado:cliente` })
    if (nuevo >= 3 && ADMIN_TG) {
      await sendTelegramMessage(
        ADMIN_TG,
        [
          `⚠️ <b>Visita con ${nuevo} reagendados</b>`,
          ``,
          `<b>Cliente:</b> ${cliente?.nombre ?? visita.usuario_id}`,
          `<b>Compita:</b> ${compita?.nombre ?? visita.compita_id}`,
          `<b>Iniciador:</b> cliente`,
          ``,
          `Puede indicar un problema de coordinación. Considera intervenir.`,
        ].join('\n'),
      )
    }
  } catch (e) { console.error('Alerta reagendados admin:', e) }

  return ok({ estado: 'pre_visita' })
}
