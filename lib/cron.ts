// Utilidades compartidas por los crons: autorización, latido (heartbeat) y vigilancia.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { secretoValido } from '@/lib/links'
import { avisarAdmin } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'

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
export const ESPERADOS: Record<string, number> = {
  recordatorios: 5, seguimiento: 5, 'escalera-avisos': 5, 'recordatorio-cuestionario': 10, 'cierre-rechazo': 30, 'recordatorio-visita': 30,
  'reintentar-airtable': 15, 'conciliar-airtable': 60,
  // Los que antes nadie vigilaba (S-09). Minutos entre ejecuciones; se alerta pasado el triple.
  limpieza: 1440, 'recordatorio-pago': 1440, 'recordatorio-primera-visita': 1440, 'aviso-inicio-visita': 15, 'noshow-alerta': 15, 'churn-alerta': 10080,
  'cmc-compitas': 60, // foto horaria del CMC (solo cuenta desde la primera foto aplicada)
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
    await alertaAdmin('urgente', `⏱️ <b>Cron detenido</b>\n\n<code>${nombre}</code> no corre hace más de ${min * 3} minutos. Revisa los logs de Netlify.`)
    caidos.push(nombre)
  }
  return caidos
}

/**
 * Ventana de espera por clave: la primera vez (o pasada la ventana) deja pasar y anota el momento; antes de que pase la ventana dice cuándo fue la
 * última vez. Es el límite de frecuencia de las rutas que mandan mensajes a terceros. ES ATÓMICA: con veinte peticiones a la vez solo una gana, porque
 *  1. la primera vez la clave se inserta (es única: solo un insert tiene éxito) y
 *  2. pasada la ventana, solo gana quien consigue "renovar" la fila con una actualización condicional (updated_at más viejo que el límite).
 * Si la base falla, la petición NO pasa (falla cerrado): es mejor frenar un envío que dejar de limitarlos.
 */
export async function reclamarVentana(clave: string, ventanaMs: number): Promise<{ ok: true } | { ok: false; desde: string }> {
  const admin = createAdminSupabase()
  const ahora = new Date()
  const { error } = await admin.from('telegram_estados').insert({ chat_id: clave, registro_pendiente: false, updated_at: ahora.toISOString() })
  if (!error) return { ok: true }
  const limite = new Date(ahora.getTime() - ventanaMs).toISOString()
  const { data: renovada } = await admin.from('telegram_estados').update({ updated_at: ahora.toISOString() }).eq('chat_id', clave).lt('updated_at', limite).select('chat_id')
  if (((renovada ?? []) as unknown[]).length > 0) return { ok: true }
  const { data: previo } = await admin.from('telegram_estados').select('updated_at').eq('chat_id', clave).maybeSingle()
  return { ok: false, desde: (previo?.updated_at as string | undefined) ?? ahora.toISOString() }
}

/** ¿Hay una ventana vigente para esta clave? Solo mira (no reclama): sirve para "anotar una vez cada tanto" sin saltarse la anotación si falló. */
export async function ventanaVigente(clave: string, ventanaMs: number): Promise<boolean> {
  const { data } = await createAdminSupabase().from('telegram_estados').select('updated_at').eq('chat_id', clave).maybeSingle()
  return !!data && Date.now() - new Date(data.updated_at as string).getTime() < ventanaMs
}

/** Marca "ahora" en una clave de ventana (después de haber hecho de verdad lo que la ventana protege). */
export async function marcarVentana(clave: string): Promise<void> {
  await createAdminSupabase().from('telegram_estados').upsert({ chat_id: clave, registro_pendiente: false, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })
}

/** Clave de idempotencia de una sola vez (true si es la primera vez que se reclama). */
export async function reclamarUnaVez(clave: string): Promise<boolean> {
  const { error } = await createAdminSupabase().from('telegram_estados').insert({ chat_id: clave, registro_pendiente: false })
  return !error
}
