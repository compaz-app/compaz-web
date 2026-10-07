import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'

// POST /api/cron/noshow-alerta
// Corre cada 15 min. Detecta visitas programadas cuya hora_inicio_programada
// ya pasó hace más de 30 minutos y aún no transitaron a en_curso.
// Alerta al admin por Telegram una sola vez por visita (idempotencia via mensajes).
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabase()
  const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!adminTg) return NextResponse.json({ ok: true, alertas: 0 })

  // Hora actual en Venezuela (UTC-4)
  const ahoraUTC = new Date()
  const ahoraVE = new Date(ahoraUTC.getTime() - 4 * 60 * 60_000)
  const hoyVE = ahoraVE.toISOString().slice(0, 10)
  // Hora VE formateada como HH:MM para comparar con hora_inicio_programada (tipo time)
  const horaVE = ahoraVE.toTimeString().slice(0, 5)
  // Umbral: hora actual menos 30 minutos
  const hace30min = new Date(ahoraVE.getTime() - 30 * 60_000).toTimeString().slice(0, 5)

  // Visitas programadas para hoy que debían haber empezado hace 30+ min
  const { data: visitas } = await admin
    .from('visitas')
    .select('id, compita_id, usuario_id, hora_inicio_programada, compitas(nombre, telegram_chat_id), usuarios(nombre, email)')
    .eq('estado', 'programada')
    .eq('fecha_programada', hoyVE)
    .not('hora_inicio_programada', 'is', null)
    .lte('hora_inicio_programada', hace30min)

  let alertas = 0

  for (const visita of visitas ?? []) {
    // Idempotencia: ya se envió alerta si hay un mensaje noshow_alerta
    const { count } = await admin
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('visit_id', visita.id)
      .eq('origen', 'admin')
      .eq('contenido', 'noshow_alerta')

    if ((count ?? 0) > 0) continue

    const compita = visita.compitas as unknown as { nombre: string; telegram_chat_id: string | null } | null
    const cliente = visita.usuarios as unknown as { nombre: string; email: string } | null

    try {
      await sendTelegramMessage(
        adminTg,
        [
          `🚨 <b>Posible no-show</b>`,
          ``,
          `La visita debía empezar a las <b>${visita.hora_inicio_programada}</b> y el compita aún no la inició.`,
          ``,
          `<b>Compita:</b> ${compita?.nombre ?? '—'}`,
          `<b>Cliente:</b> ${cliente?.nombre ?? '—'} (${cliente?.email ?? '—'})`,
          ``,
          `Contacta al compita para confirmar.`,
        ].join('\n'),
      )

      // Marcar como alertada
      await admin.from('mensajes').insert({
        visit_id: visita.id,
        origen: 'admin',
        tipo: 'texto',
        contenido: 'noshow_alerta',
      })

      alertas++
    } catch (e) { console.error('Error alerta no-show:', e) }
  }

  return NextResponse.json({ ok: true, alertas })
}
