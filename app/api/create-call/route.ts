import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getClienteActivo } from '@/lib/auth'
import { getOrCreateDailyRoom } from '@/lib/daily'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { esc } from '@/lib/html'
import { ok, err, unauthorized, serverError } from '@/lib/api'
import type { Visita, Compita, Usuario } from '@/types'

export async function POST(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const admin = createAdminSupabase()
  const { data: visita } = await admin
    .from('visitas')
    .select('*, compita:compitas(*), usuario:usuarios(*)')
    .eq('usuario_id', user.id)
    .eq('estado', 'en_curso')
    .order('inicio', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: (Visita & { compita: Compita; usuario: Usuario }) | null }

  if (!visita) return err('No hay visita activa')

  const body = await req.json().catch(() => ({})) as { solo_audio?: boolean }
  const soloAudio = body.solo_audio ?? false

  let room
  try {
    room = await getOrCreateDailyRoom(visita.id, visita.room_url ?? null, soloAudio)
  } catch (e) {
    return serverError(e)
  }

  const { error: eRoom } = await admin.from('visitas').update({ room_url: room.url }).eq('id', visita.id)
  if (eRoom) console.error('[create-call] no se pudo guardar room_url:', eRoom)

  if (visita.compita.telegram_chat_id) {
    const tipo = soloAudio ? '📞 El cliente quiere hacer una llamada de voz' : '📹 El cliente quiere hacer una videollamada'
    try { await sendTelegramMessage(visita.compita.telegram_chat_id, `${tipo}.\n\nEntra aquí: ${room.url}`) }
    catch (e) { console.error('Error Telegram create-call:', e) }
  }

  const tipoAdmin = soloAudio ? 'llamada de voz' : 'videollamada'
  await avisarAdmin(`${soloAudio ? '📞' : '📹'} <b>${esc(visita.usuario?.nombre ?? 'Un cliente')}</b> inició una ${tipoAdmin} con <b>${esc(visita.compita.nombre)}</b>.\n\n<a href="${room.url}">Unirse →</a>`)

  return ok({ url: room.url, room_name: room.name })
}
