// POST /api/visita/nueva — el cliente agenda otra visita (2ª, 3ª, 4ª...) con su compita asignada.
import { createServerSupabase } from '@/lib/supabase-server'
import { crearSiguienteVisita } from '@/lib/visitas'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { esc } from '@/lib/html'
import { ok, err, unauthorized } from '@/lib/api'

export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const r = await crearSiguienteVisita(user.id)
  if (!r.ok) return err(r.mensaje, r.motivo === 'error' ? 500 : 409)

  // Avisar a la compita para que arranque la coordinación; si no se puede, avisar al admin
  let notificada = false
  if (r.telegramChatId) {
    try {
      await sendTelegramMessage(
        r.telegramChatId,
        `🔁 <b>${esc(r.clienteNombre)}</b> quiere agendar otra visita contigo (visita número ${r.numero}).\n\nEscríbele desde este chat para ponerse de acuerdo en la fecha y hora. Cuando él la registre en el sistema, podrás iniciarla desde aquí.`,
      )
      notificada = true
    } catch (e) { console.error('[visita/nueva] Telegram compita:', e) }
  }
  await avisarAdmin(
    `🔁 <b>Nueva visita agendada</b>\n\n<b>Cliente:</b> ${esc(r.clienteNombre)}\n<b>Compita:</b> ${esc(r.compitaNombre)}\n<b>Visita número:</b> ${r.numero}${notificada ? '' : '\n\n⚠️ La compita NO pudo ser notificada. Contáctala.'}`,
  )

  return ok({ visita_id: r.visitaId, numero: r.numero })
}
