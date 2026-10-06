import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, makeInlineKeyboard } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabase()
  const ahora = new Date()
  const hace24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString()

  // Buscar estados de Telegram con cuestionario pendiente y expirado
  const { data: estados } = await supabase
    .from('telegram_estados')
    .select('chat_id, pendiente_accion, pendiente_expira')
    .or('pendiente_accion.like.reporte:%,pendiente_accion.like.reporte_novedad:%')
    .lt('pendiente_expira', ahora.toISOString())
    .gt('pendiente_expira', hace24h) // no más de 24h abandonado

  if (!estados || estados.length === 0) {
    return NextResponse.json({ ok: true, recordatorios: 0 })
  }

  let enviados = 0
  for (const estado of estados) {
    // Extender el tiempo 30 minutos más para que pueda responder
    const nuevaExpira = new Date(Date.now() + 30 * 60_000).toISOString()
    await supabase
      .from('telegram_estados')
      .update({ pendiente_expira: nuevaExpira })
      .eq('chat_id', estado.chat_id)

    try {
      await sendTelegramMessage(
        estado.chat_id,
        `📋 <b>Aún tienes el cuestionario pendiente.</b>\n\nTómate un momento para registrar cómo estuvo el familiar. La familia lo agradece mucho. 💙`,
        makeInlineKeyboard([[{ text: '✏️ Completar ahora', callback_data: 'reanudar_reporte' }]]),
      )
      enviados++
    } catch (e) { console.error('Error recordatorio cuestionario:', e) }
  }

  return NextResponse.json({ ok: true, recordatorios: enviados })
}
