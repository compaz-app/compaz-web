import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { INLINE_DURANTE } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabase()
  const hace30min = new Date(Date.now() - 30 * 60_000).toISOString()

  // Visitas en curso que llevan más de 30 minutos
  const { data: visitasActivas } = await supabase
    .from('visitas')
    .select('id, compita_id, compitas(telegram_chat_id)')
    .eq('estado', 'en_curso')
    .lt('inicio', hace30min)

  if (!visitasActivas || visitasActivas.length === 0) {
    return NextResponse.json({ ok: true, recordatorios: 0 })
  }

  let enviados = 0
  for (const visita of visitasActivas) {
    const tg = (visita.compitas as unknown as { telegram_chat_id: string | null } | null)?.telegram_chat_id
    if (!tg) continue

    // Verificar si el compita mandó algo (o ya se envió recordatorio) en los últimos 30 minutos
    const { count } = await supabase
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('visit_id', visita.id)
      .in('origen', ['compita', 'admin'])
      .gte('created_at', hace30min)

    if ((count ?? 0) === 0) {
      let enviado = false
      try {
        await sendTelegramMessage(
          tg,
          `📸 ¿Cómo va la visita? Manda una foto o un mensaje corto para que la familia sepa cómo está su familiar.`,
          INLINE_DURANTE,
        )
        enviado = true
        enviados++
      } catch (e) { console.error('Error recordatorio visita:', e) }

      if (enviado) {
        await supabase.from('mensajes').insert({
          visit_id: visita.id,
          origen: 'admin',
          tipo: 'texto',
          contenido: 'recordatorio_visita',
        })
      }
    }
  }

  return NextResponse.json({ ok: true, recordatorios: enviados })
}
