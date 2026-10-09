// Utilidades compartidas por los crons: autorización, latido (heartbeat) y vigilancia.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { secretoValido } from '@/lib/links'
import { avisarAdmin } from '@/lib/telegram'

export function cronAutorizado(req: NextRequest): boolean {
  return secretoValido(req.headers.get('x-cron-secret'), process.env.CRON_SECRET)
}

/** Registra que el cron corrió (fila sintética). Nunca lanza. */
export async function latido(nombre: string): Promise<void> {
  try {
    await createAdminSupabase()
      .from('telegram_estados')
      .upsert({ chat_id: `cron:${nombre}`, registro_pendiente: false, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })
  } catch (e) { console.error('latido falló:', e) }
}

// Intervalo esperado (min) de cada cron; se alerta si pasa 3x ese intervalo sin latido.
const ESPERADOS: Record<string, number> = {
  recordatorios: 5, seguimiento: 5, 'recordatorio-cuestionario': 10, 'cierre-rechazo': 30, 'recordatorio-visita': 30,
}

/** Alerta al admin (máx. 1 vez por hora y cron) si un cron dejó de ejecutarse. */
export async function vigilarLatidos(): Promise<string[]> {
  const admin = createAdminSupabase()
  const caidos: string[] = []
  const { data } = await admin.from('telegram_estados').select('chat_id, updated_at').like('chat_id', 'cron:%')
  const vistos = new Map((data ?? []).map((r) => [r.chat_id as string, new Date(r.updated_at as string).getTime()]))
  for (const [nombre, min] of Object.entries(ESPERADOS)) {
    const ultimo = vistos.get(`cron:${nombre}`)
    if (ultimo !== undefined && Date.now() - ultimo < min * 3 * 60_000) continue
    if (ultimo === undefined) continue // aún sin historial (primer despliegue)
    const claveAlerta = `alerta_cron:${nombre}`
    const { data: prev } = await admin.from('telegram_estados').select('updated_at').eq('chat_id', claveAlerta).maybeSingle()
    if (prev && Date.now() - new Date(prev.updated_at).getTime() < 3600_000) continue
    await admin.from('telegram_estados').upsert({ chat_id: claveAlerta, registro_pendiente: false, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })
    await avisarAdmin(`⏱️ <b>Cron detenido</b>\n\n<code>${nombre}</code> no corre hace más de ${min * 3} minutos. Revisa los logs de Netlify.`)
    caidos.push(nombre)
  }
  return caidos
}

/** Clave de idempotencia de una sola vez (true si es la primera vez que se reclama). */
export async function reclamarUnaVez(clave: string): Promise<boolean> {
  const { error } = await createAdminSupabase().from('telegram_estados').insert({ chat_id: clave, registro_pendiente: false })
  return !error
}
