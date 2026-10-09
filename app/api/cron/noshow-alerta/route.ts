// POST /api/cron/noshow-alerta — cada 15 min
// Avisa al admin (una sola vez por visita) si una visita programada no se inició 30 min después de su hora.
// También vigila que los demás crons sigan corriendo.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { avisarAdmin } from '@/lib/telegram'
import { esc } from '@/lib/html'
import { hoyVE, horaVE } from '@/lib/format'
import { cronAutorizado, latido, vigilarLatidos, reclamarUnaVez } from '@/lib/cron'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()
  await vigilarLatidos()

  // Hora de Venezuela calculada sin depender de la zona del servidor
  const umbralMs = Date.now() - 30 * 60_000
  const hoy = hoyVE()
  const fechaUmbral = new Date(umbralMs - 4 * 3600_000).toISOString().slice(0, 10)
  const horaUmbral = horaVE(umbralMs)
  const cruzaMedianoche = fechaUmbral < hoy

  // Visitas pautadas para la fecha del umbral cuya hora de inicio ya pasó hace 30+ min.
  const { data: visitas, error } = await admin
    .from('visitas')
    .select('id, hora_inicio_programada, compitas(nombre), usuarios(nombre, email)')
    .eq('estado', 'programada')
    .eq('fecha_programada', fechaUmbral)
    .not('hora_inicio_programada', 'is', null)
    .lte('hora_inicio_programada', horaUmbral)
  if (error) console.error('[noshow] consulta falló:', error)

  // Después de medianoche, también las de ayer que quedaron sin iniciar
  let alertas = 0
  for (const visita of visitas ?? []) {
    if (!(await reclamarUnaVez(`noshow:${visita.id}`))) continue
    const compita = visita.compitas as unknown as { nombre: string } | null
    const cliente = visita.usuarios as unknown as { nombre: string; email: string } | null
    const enviado = await avisarAdmin([
      `🚨 <b>Posible no-show</b>`, ``,
      `La visita debía empezar a las <b>${esc(visita.hora_inicio_programada)}</b> y la compita aún no la inició.`, ``,
      `<b>Compita:</b> ${esc(compita?.nombre ?? '—')}`,
      `<b>Cliente:</b> ${esc(cliente?.nombre ?? '—')} (${esc(cliente?.email ?? '—')})`, ``,
      `Contacta a la compita para confirmar.`,
    ].join('\n'))
    if (enviado) alertas++
    else await admin.from('telegram_estados').delete().eq('chat_id', `noshow:${visita.id}`) // reintentar en el próximo ciclo
  }

  await latido('noshow-alerta')
  return NextResponse.json({ ok: true, alertas, cruzaMedianoche })
}
