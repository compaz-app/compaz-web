import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { verificarCompita, desactivarCompita } from '@/lib/compitas'
import { sendTelegramMessage, INLINE_INICIO } from '@/lib/telegram'
import { sendEmail } from '@/lib/email'
import { esc } from '@/lib/html'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { compita_id, verificado } = (await req.json().catch(() => ({})) as { compita_id: string; verificado: boolean })
  if (!compita_id || typeof verificado !== 'boolean') return err('Parámetros inválidos')

  try {
    if (verificado) {
      await verificarCompita(compita_id)
    } else {
      await desactivarCompita(compita_id)
    }
  } catch (e) {
    return serverError(e)
  }

  // Al verificarla hay que avisarle: el bot le dijo que "le avisaríamos cuando estuviera verificada".
  let notificada: 'telegram' | 'correo' | null = null
  if (verificado) {
    const { data: c } = await createAdminSupabase()
      .from('compitas').select('nombre, email, telegram_chat_id, estado, verificado').eq('id', compita_id).maybeSingle()
    if (c && c.estado === 'activo' && c.verificado) {
      if (c.telegram_chat_id) {
        try {
          await sendTelegramMessage(
            c.telegram_chat_id,
            `✅ <b>¡Tu cuenta fue verificada, ${esc(c.nombre)}!</b>\n\nYa apareces ante las familias. Cuando una quiera conocerte, te llegará aquí un mensaje con los horarios para elegir. Si quieres mejorar tu perfil, escribe /perfil. Para ver todo lo que puedes hacer, escribe /menu.`,
            INLINE_INICIO,
          )
          notificada = 'telegram'
        } catch (e) { console.error('[toggle-verificado] Telegram a la compita falló:', e) }
      }
      if (!notificada && c.email) {
        const bot = process.env.TELEGRAM_BOT_USERNAME
        try {
          await sendEmail({
            to: c.email,
            subject: 'Tu perfil en Compaz fue verificado',
            html: `
              <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
                <h2 style="color:#2D1464;font-size:22px">¡Tu perfil fue verificado, ${esc(c.nombre.split(' ')[0])}!</h2>
                <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Para aparecer ante las familias y recibir solicitudes, falta que conectes Telegram: abre el bot, pulsa <strong>Iniciar</strong>, escribe tu nombre tal como lo registraste y confirma el código que te llegará a este correo.</p>
                ${bot ? `<a href="https://t.me/${encodeURIComponent(bot)}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:8px">Abrir el bot de Telegram →</a>` : ''}
                <p style="color:#9990A8;font-size:13px;margin-top:28px">Compaz, <em>Cerca aunque estés lejos</em></p>
              </div>`,
          })
          notificada = 'correo'
        } catch (e) { console.error('[toggle-verificado] correo a la compita falló:', e) }
      }
    }
  }

  return ok({ compita_id, verificado, notificada })
}
