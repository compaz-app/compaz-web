import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, makeInlineKeyboard } from '@/lib/telegram'
import { cronAutorizado, latido } from '@/lib/cron'

// POST /api/cron/recordatorio-cuestionario
// Corre cada 10 min. Envía un recordatorio al compita si lleva ~15 min sin
// completar el cuestionario de bienestar (pendiente_expira entre 10 y 20 min
// restantes = aproximadamente 10-20 min después de terminar la visita).
// Usa el prefijo del pendiente_accion como idempotencia:
//   reporte:...       → cuestionario activo, aún no fue recordado
//   reporte_r:...     → ya se envió el recordatorio, no volver a enviar
export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()
  const ahora = new Date()

  // Ventana: pendiente_expira entre ahora+10min y ahora+20min
  // = cuestionario que expira pronto pero aún no expiró
  const en10min = new Date(ahora.getTime() + 10 * 60_000).toISOString()
  const en20min = new Date(ahora.getTime() + 20 * 60_000).toISOString()

  const { data: pendientes } = await admin
    .from('telegram_estados')
    .select('chat_id, pendiente_accion, pendiente_expira')
    .like('pendiente_accion', 'reporte:%') // solo los no recordados aún
    .gt('pendiente_expira', en10min)
    .lt('pendiente_expira', en20min)

  let enviados = 0

  for (const estado of pendientes ?? []) {
    const accion = estado.pendiente_accion as string

    // Marcar como recordado cambiando el prefijo, para que la próxima
    // corrida del cron no lo vuelva a enviar.
    const accionMarcada = accion.replace('reporte:', 'reporte_r:')
    const { data: marcado } = await admin
      .from('telegram_estados')
      .update({ pendiente_accion: accionMarcada })
      .eq('chat_id', estado.chat_id)
      .eq('pendiente_accion', accion)
      .select('chat_id')
      .maybeSingle()
    if (!marcado) continue

    try {
      await sendTelegramMessage(
        estado.chat_id,
        `⏰ <b>Cuestionario pendiente</b>\n\nTodavía no completaste el resumen de la visita. La familia espera saber cómo estuvo su familiar.\n\nTienes unos minutos antes de que expire. Toca el botón para retomarlo:`,
        makeInlineKeyboard([[{ text: '📋 Completar ahora', callback_data: 'reanudar_reporte' }]]),
      )
      enviados++
    } catch (e) { console.error('Error recordatorio cuestionario:', e) }
  }

  // Limpiar estados expirados: reporte_r:, reporte_novedad: y reporte: ya vencidos
  for (const prefix of ['reporte_r:%', 'reporte_novedad:%', 'reporte:%']) {
    await admin
      .from('telegram_estados')
      .update({ pendiente_accion: null, pendiente_expira: null })
      .like('pendiente_accion', prefix)
      .lt('pendiente_expira', ahora.toISOString())
  }

  await latido('recordatorio-cuestionario')
  return NextResponse.json({ ok: true, enviados })
}
