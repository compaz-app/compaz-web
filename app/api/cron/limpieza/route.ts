// POST /api/cron/limpieza — una vez al día (3 am VE)
// Elimina tokens vencidos y filas sintéticas de control (idempotencia, cooldowns, latidos viejos).
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { cronAutorizado } from '@/lib/cron'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return err('No autorizado', 401)

  const admin = createAdminSupabase()
  const ahora = new Date().toISOString()
  const hace1d = new Date(Date.now() - 86400_000).toISOString()
  const hace30d = new Date(Date.now() - 30 * 86400_000).toISOString()

  const tareas: Array<[string, PromiseLike<{ error: { message: string } | null }>]> = [
    ['onboarding_tokens', admin.from('onboarding_tokens').delete().or(`usado.eq.true,expires_at.lt.${ahora}`)],
    ['compita_edit_tokens', admin.from('compita_edit_tokens').delete().lt('expires_at', ahora)],
    ['action_tokens', admin.from('action_tokens').delete().lt('expires_at', ahora)],
    // Filas sintéticas: deduplicación de updates, confirmaciones, cooldowns y alertas de un solo uso
    ['telegram upd/conf/cod/recon', admin.from('telegram_estados').delete().or('chat_id.like.upd:%,chat_id.like.conf:%,chat_id.like.cod:%,chat_id.like.recon:%').lt('updated_at', hace1d)],
    ['telegram alertas viejas', admin.from('telegram_estados').delete().or('chat_id.like.noshow:%,chat_id.like.alerta_%,chat_id.like.sala_fail:%,chat_id.like.pend_%').lt('updated_at', hace30d)],
  ]
  const fallos: string[] = []
  for (const [nombre, q] of tareas) {
    const { error } = await q
    if (error) { console.error(`[limpieza] ${nombre}:`, error.message); fallos.push(nombre) }
  }
  return fallos.length ? err(`Fallaron: ${fallos.join(', ')}`, 500) : ok(null)
}
