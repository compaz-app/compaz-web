// POST /api/cron/recordatorio-visita — cada 30 min
// Visitas en curso: empuja a la compita a mandar una foto/mensaje si lleva 30 min en silencio
// (máx. 6 recordatorios por visita) y alerta al admin una vez si pasan de 8 h (probable olvido de "Terminar").
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin, INLINE_DURANTE } from '@/lib/telegram'
import { esc } from '@/lib/html'
import { cronAutorizado, latido, reclamarUnaVez } from '@/lib/cron'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminSupabase()
  const hace30min = new Date(Date.now() - 30 * 60_000).toISOString()
  const hace8h = new Date(Date.now() - 8 * 3600_000).toISOString()

  const { data: visitasActivas, error } = await supabase
    .from('visitas')
    .select('id, inicio, compitas(nombre, telegram_chat_id), usuarios(nombre)')
    .eq('estado', 'en_curso')
    .lt('inicio', hace30min)
  if (error) console.error('[recordatorio-visita] consulta falló:', error)

  let enviados = 0
  for (const visita of visitasActivas ?? []) {
    const compita = visita.compitas as unknown as { nombre: string; telegram_chat_id: string | null } | null
    const cliente = visita.usuarios as unknown as { nombre: string } | null

    if (visita.inicio && visita.inicio < hace8h) {
      if (await reclamarUnaVez(`alerta_visita_larga:${visita.id}`)) {
        await avisarAdmin(`⏳ <b>Visita en curso hace más de 8 horas</b>\n\n<b>Compita:</b> ${esc(compita?.nombre ?? '—')}\n<b>Cliente:</b> ${esc(cliente?.nombre ?? '—')}\n\nProbablemente olvidó tocar "Terminar visita". Contáctala para cerrarla.`)
      }
      continue // no seguir insistiendo con recordatorios de foto
    }

    const tg = compita?.telegram_chat_id
    if (!tg) continue

    const { count } = await supabase
      .from('mensajes').select('id', { count: 'exact', head: true })
      .eq('visit_id', visita.id).in('origen', ['compita', 'admin']).gte('created_at', hace30min)
    if ((count ?? 0) > 0) continue

    const { count: previos } = await supabase
      .from('mensajes').select('id', { count: 'exact', head: true })
      .eq('visit_id', visita.id).eq('origen', 'admin').eq('contenido', 'recordatorio_visita')
    if ((previos ?? 0) >= 6) continue

    try {
      await sendTelegramMessage(tg, `📸 ¿Cómo va la visita? Manda una foto o un mensaje corto para que la familia sepa cómo está su familiar.`, INLINE_DURANTE)
      enviados++
      await supabase.from('mensajes').insert({ visit_id: visita.id, origen: 'admin', tipo: 'texto', contenido: 'recordatorio_visita' })
    } catch (e) { console.error('Error recordatorio visita:', e) }
  }

  await latido('recordatorio-visita')
  return NextResponse.json({ ok: true, recordatorios: enviados })
}
