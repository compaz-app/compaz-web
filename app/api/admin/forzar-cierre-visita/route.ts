import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { avisarAdmin, sendTelegramMessage, TECLADO_SIN_VISITA } from '@/lib/telegram'
import { esc } from '@/lib/html'
import { ok, err, unauthorized, notFound, serverError } from '@/lib/api'
import type { Visita, Compita, Usuario } from '@/types'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { visita_id } = (await req.json().catch(() => ({})) as { visita_id: string })
  if (!visita_id) return err('visita_id requerido')

  const supabase = createAdminSupabase()
  const fin = new Date().toISOString()

  const { data: visita, error } = await supabase
    .from('visitas')
    .update({ estado: 'terminada', fin, room_url: null, llamada_solicitada_at: null })
    .eq('id', visita_id)
    .in('estado', ['en_curso', 'confirmando_inicio'])
    .select('*, compita:compitas(id, nombre, telegram_chat_id), usuario:usuarios(nombre, email)')
    .maybeSingle() as { data: (Visita & { compita: Compita; usuario: Usuario }) | null; error: unknown }

  if (error) return serverError(error)
  if (!visita) return notFound()

  // Notificar al compita por Telegram
  if (visita.compita?.telegram_chat_id) {
    sendTelegramMessage(
      visita.compita.telegram_chat_id,
      `ℹ️ El administrador cerró la visita manualmente. Si tienes preguntas, escríbenos a hola@micompaz.com.`,
      TECLADO_SIN_VISITA,
    ).catch(e => console.error('[forzar-cierre] telegram compita:', e))
  }

  await avisarAdmin(
    `🔴 <b>Visita cerrada manualmente (admin)</b>\n\n<b>Compita:</b> ${esc(visita.compita?.nombre ?? '—')}\n<b>Cliente:</b> ${esc(visita.usuario?.nombre ?? '—')}`,
  )

  return ok({ visita_id })
}
