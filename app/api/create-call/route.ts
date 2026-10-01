import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { getOrCreateDailyRoom } from '@/lib/daily'
import { sendTelegramMessage } from '@/lib/telegram'
import { ok, err, unauthorized, serverError } from '@/lib/api'
import type { Visita, Compita, Usuario } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const admin = createAdminSupabase()
  const { data: visita } = await admin
    .from('visitas')
    .select('*, compita:compitas(*), usuario:usuarios(*)')
    .eq('usuario_id', user.id)
    .eq('estado', 'en_curso')
    .single() as { data: (Visita & { compita: Compita; usuario: Usuario }) | null }

  if (!visita) return err('No hay visita activa')

  const body = await req.json().catch(() => ({})) as { solo_audio?: boolean }
  const soloAudio = body.solo_audio ?? false

  let room
  try {
    room = await getOrCreateDailyRoom(visita.id, visita.room_url ?? null, soloAudio)
  } catch (e) {
    return serverError(e)
  }

  await admin.from('visitas').update({ room_url: room.url }).eq('id', visita.id)

  if (visita.compita.telegram_chat_id) {
    const tipo = soloAudio ? '📞 El cliente quiere hacer una llamada de voz' : '📹 El cliente quiere hacer una videollamada'
    try { await sendTelegramMessage(visita.compita.telegram_chat_id, `${tipo}.\n\nEntra aquí: ${room.url}`) }
    catch (e) { console.error('Error Telegram create-call:', e) }
  }

  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (adminChatId) {
    const tipo = soloAudio ? '📞 llamada de voz' : '📹 videollamada'
    const clienteNombre = visita.usuario?.nombre ?? 'Un cliente'
    try {
      await sendTelegramMessage(
        adminChatId,
        `${soloAudio ? '📞' : '📹'} <b>${clienteNombre}</b> inició una ${tipo} con <b>${visita.compita.nombre}</b>.\n\n<a href="${room.url}">Unirse →</a>`,
      )
    } catch (e) { console.error('Error Telegram admin llamada:', e) }
  }

  return ok({ url: room.url, room_name: room.name })
}
