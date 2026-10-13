// POST /api/cron/aviso-inicio-visita — cada 15 min
// 30 min antes de la hora programada le envía al compita el botón ▶️ Iniciar visita.
// Si no tiene telegram_chat_id, avisa al admin para que lo contacte manualmente.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin, INLINE_INICIO } from '@/lib/telegram'
import { esc } from '@/lib/html'
import { hoyVE, horaVE } from '@/lib/format'
import { cronAutorizado, latido, reclamarUnaVez } from '@/lib/cron'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()

  // Ventana: visitas cuya hora_inicio_programada esté entre ahora+15min y ahora+30min (en VE)
  const desde = horaVE(Date.now() + 15 * 60_000)  // e.g. "17:15"
  const hasta = horaVE(Date.now() + 30 * 60_000)  // e.g. "17:30"
  const hoy = hoyVE()

  const { data: visitas, error } = await admin
    .from('visitas')
    .select('id, hora_inicio_programada, compitas(nombre, telegram_chat_id), usuarios(nombre)')
    .eq('estado', 'programada')
    .eq('fecha_programada', hoy)
    .not('hora_inicio_programada', 'is', null)
    .gte('hora_inicio_programada', desde)
    .lte('hora_inicio_programada', hasta)
  if (error) console.error('[aviso-inicio-visita] consulta falló:', error)

  let enviados = 0
  for (const visita of visitas ?? []) {
    // Solo una vez por visita
    if (!(await reclamarUnaVez(`aviso_inicio:${visita.id}`))) continue

    const compita = visita.compitas as unknown as { nombre: string; telegram_chat_id: string | null } | null
    const cliente = visita.usuarios as unknown as { nombre: string } | null

    if (compita?.telegram_chat_id) {
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          [
            `⏰ <b>Tu visita empieza en ~30 minutos</b>`, ``,
            `Cuando llegues donde <b>${esc(cliente?.nombre ?? 'el cliente')}</b> y vayas a comenzar, toca el botón de abajo.`,
          ].join('\n'),
          INLINE_INICIO,
        )
        enviados++
      } catch (e) {
        console.error('[aviso-inicio-visita] Telegram falló:', e)
        await avisarAdmin(`⚠️ No se pudo enviar el aviso de inicio a <b>${esc(compita.nombre)}</b> para la visita con <b>${esc(cliente?.nombre ?? '—')}</b> a las <b>${esc(visita.hora_inicio_programada!)}</b>. Contáctala manualmente.`)
      }
    } else {
      await avisarAdmin(`⚠️ <b>${esc(compita?.nombre ?? '—')}</b> no tiene Telegram registrado. Su visita con <b>${esc(cliente?.nombre ?? '—')}</b> empieza a las <b>${esc(visita.hora_inicio_programada!)}</b>. Avísale tú.`)
    }
  }

  await latido('aviso-inicio-visita')
  return NextResponse.json({ ok: true, enviados })
}
