// POST /api/cron/limpieza — una vez al día (3 am VE)
// Elimina tokens vencidos y filas sintéticas de control (idempotencia, cooldowns, latidos viejos).
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { cronAutorizado } from '@/lib/cron'
import { ok, err } from '@/lib/api'
import { getAjuste } from '@/lib/ajustes'
import { borrarFotosVencidas } from '@/lib/fotos-privadas'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return err('No autorizado', 401)

  const admin = createAdminSupabase()
  const ahora = new Date().toISOString()
  const hace1d = new Date(Date.now() - 86400_000).toISOString()
  const hace30d = new Date(Date.now() - 30 * 86400_000).toISOString()
  // La retención de avisos sale de Ajustes (por defecto 90 días).
  const hace90d = new Date(Date.now() - Number(await getAjuste('avisos_retencion_dias')) * 86400_000).toISOString()

  const tareas: Array<[string, PromiseLike<{ error: { message: string } | null }>]> = [
    ['onboarding_tokens', admin.from('onboarding_tokens').delete().or(`usado.eq.true,expires_at.lt.${ahora}`)],
    ['compita_edit_tokens', admin.from('compita_edit_tokens').delete().lt('expires_at', ahora)],
    ['action_tokens', admin.from('action_tokens').delete().lt('expires_at', ahora)],
    // Filas sintéticas: deduplicación de updates, confirmaciones, cooldowns y alertas de un solo uso
    ['telegram upd/conf/cod/recon', admin.from('telegram_estados').delete().or('chat_id.like.upd:%,chat_id.like.conf:%,chat_id.like.cod:%,chat_id.like.recon:%').lt('updated_at', hace1d)],
    ['telegram alertas viejas', admin.from('telegram_estados').delete().or('chat_id.like.noshow:%,chat_id.like.alerta_%,chat_id.like.sala_fail:%,chat_id.like.pend_%').lt('updated_at', hace30d)],
    // Contadores del acceso (límites por IP y por correo, intentos de código): una fila por IP o correo, sin esto crecen sin fin
    ['contadores de acceso vencidos', admin.from('telegram_estados').delete().or('chat_id.like.acc_ip:%,chat_id.like.cod_ip:%,chat_id.like.cod_fallos:%').lt('pendiente_expira', ahora)],
    ['cooldown de acceso por correo', admin.from('telegram_estados').delete().like('chat_id', 'acc_mail:%').lt('updated_at', hace1d)],
    // Retención de avisos: 90 días (decisión del usuario). Solo los que ya terminaron; un pendiente nunca se borra.
    ['avisos de más de 90 días', admin.from('avisos').delete().lt('creado_en', hace90d).in('estado', ['enviado', 'cancelado', 'fallido'])],
  ]
  const fallos: string[] = []
  for (const [nombre, q] of tareas) {
    const { error } = await q
    if (error) { console.error(`[limpieza] ${nombre}:`, error.message); fallos.push(nombre) }
  }
  // Fotos privadas cuyo plazo venció: se borran de verdad (archivo y marca) y queda un evento.
  const fotos = await borrarFotosVencidas()
  if (fotos.fallos > 0) fallos.push('fotos privadas')
  return fallos.length ? err(`Fallaron: ${fallos.join(', ')}`, 500) : ok(null)
}
