import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { getOrCreateDailyRoom } from '@/lib/daily'
import { sendTelegramMessage } from '@/lib/telegram'
import type { Visita, Compita, Usuario } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Verificar que el usuario tiene visita en curso
  const admin = createAdminSupabase()
  const { data: visita } = await admin
    .from('visitas')
    .select('*, compita:compitas(*), usuario:usuarios(*)')
    .eq('usuario_id', user.id)
    .eq('estado', 'en_curso')
    .single() as { data: (Visita & { compita: Compita; usuario: Usuario }) | null }

  if (!visita) {
    return NextResponse.json({ error: 'No hay visita activa' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({})) as { solo_audio?: boolean }
  const soloAudio = body.solo_audio ?? false

  // Reusar sala existente si ya hay una; crear nueva solo si no hay (evita creación ilimitada)
  const roomUrlExistente = visita.room_url ?? null
  let room
  try {
    room = await getOrCreateDailyRoom(visita.id, roomUrlExistente, soloAudio)
  } catch (e) {
    console.error('Daily.co error:', e)
    return NextResponse.json({ error: 'Error creando sala de llamada' }, { status: 500 })
  }

  // Guardar room_url en la visita para que el admin pueda unirse
  await admin.from('visitas').update({ room_url: room.url }).eq('id', visita.id)

  // Enviar link al Compita por Telegram
  if (visita.compita.telegram_chat_id) {
    const tipoLlamada = soloAudio ? '📞 El cliente quiere hacer una llamada de voz' : '📹 El cliente quiere hacer una videollamada'
    try {
      await sendTelegramMessage(
        visita.compita.telegram_chat_id,
        `${tipoLlamada}.\n\nEntra aquí: ${room.url}`
      )
    } catch (e) {
      console.error('Error enviando link por Telegram:', e)
    }
  }

  // Notificar al admin por Telegram
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (adminChatId) {
    const tipo = soloAudio ? '📞 llamada de voz' : '📹 videollamada'
    const clienteNombre = visita.usuario?.nombre ?? 'Un cliente'
    try {
      await sendTelegramMessage(
        adminChatId,
        `${soloAudio ? '📞' : '📹'} <b>${clienteNombre}</b> inició una ${tipo} con <b>${visita.compita.nombre}</b>.\n\n<a href="${room.url}">Unirse a la llamada →</a>`,
      )
    } catch (e) {
      console.error('Error notificando admin llamada:', e)
    }
  }

  return NextResponse.json({ url: room.url, room_name: room.name })
}
