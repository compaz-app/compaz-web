// Utilidades compartidas por los crons: autorización, latido (heartbeat) y vigilancia.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { secretoValido } from '@/lib/links'
import { avisarAdmin } from '@/lib/telegram'

export function cronAutorizado(req: NextRequest): boolean {
  return secretoValido(req.headers.get('x-cron-secret'), process.env.CRON_SECRET)
}

/** Registra que el cron corrió (fila sintética). Nunca lanza; devuelve false si no pudo guardarse. */
export async function latido(nombre: string): Promise<boolean> {
  try {
    const { error } = await createAdminSupabase()
      .from('telegram_estados')
      .upsert({ chat_id: `cron:${nombre}`, registro_pendiente: false, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })
    if (!error) return true
    console.error(`[latido:${nombre}] no se pudo registrar:`, error.message)
    await avisarFalloVigilancia(`el latido de ${nombre}`, error.message)
  } catch (e) {
    console.error(`[latido:${nombre}] falló:`, e)
    await avisarFalloVigilancia(`el latido de ${nombre}`, e instanceof Error ? e.message : String(e))
  }
  return false
}

/** Un aviso al día como máximo si la propia vigilancia de crons no puede funcionar. */
async function avisarFalloVigilancia(que: string, detalle: string): Promise<void> {
  try {
    if (!(await reclamarUnaVez(`alerta_vigilancia:${new Date().toISOString().slice(0, 10)}`))) return
    const limpio = detalle.replace(/[<>&]/g, ' ').slice(0, 200)
    await avisarAdmin(`⚠️ <b>Vigilancia de crons sin funcionar</b>\n\nNo se pudo registrar ${que}: ${limpio}\nMientras no se corrija, un cron detenido no generará aviso. Revisa los logs de Netlify.`)
  } catch (e) { console.error('avisarFalloVigilancia falló:', e) }
}

// Intervalo esperado (min) de cada cron; se alerta si pasa 3x ese intervalo sin latido.
const ESPERADOS: Record<string, number> = {
  recordatorios: 5, seguimiento: 5, 'recordatorio-cuestionario': 10, 'cierre-rechazo': 30, 'recordatorio-visita': 30,
  'reintentar-airtable': 15, 'conciliar-airtable': 60,
}

// Crons de captación: solo se esperan desde la activación (CAPTACION_DESDE); antes no registran latido.
const DE_CAPTACION = new Set(['reintentar-airtable', 'conciliar-airtable'])

/**
 * Alerta al admin (máx. 1 vez por hora y cron) si un cron dejó de ejecutarse o no se ha
 * ejecutado nunca. Un cron sin ningún latido se mide desde el primer arranque de esta
 * vigilancia (fila "vigilancia:inicio") o, para los de captación, desde CAPTACION_DESDE.
 * Si no puede leer ni escribir sus filas, avisa una vez al día en lugar de callar.
 */
export async function vigilarLatidos(): Promise<string[]> {
  const admin = createAdminSupabase()
  const caidos: string[] = []
  const { data, error } = await admin.from('telegram_estados').select('chat_id, updated_at').or('chat_id.like.cron:%,chat_id.eq.vigilancia:inicio')
  if (error) {
    console.error('[vigilarLatidos] no se pudieron leer los latidos:', error.message)
    await avisarFalloVigilancia('la lectura de latidos', error.message)
    return caidos
  }
  const vistos = new Map((data ?? []).map((r) => [r.chat_id as string, new Date(r.updated_at as string).getTime()]))
  let inicio = vistos.get('vigilancia:inicio')
  if (inicio === undefined) {
    await reclamarUnaVez('vigilancia:inicio')
    inicio = Date.now()
  }
  const desdeCaptacion = Date.parse(process.env.CAPTACION_DESDE ?? '')
  for (const [nombre, min] of Object.entries(ESPERADOS)) {
    if (DE_CAPTACION.has(nombre) && Number.isNaN(desdeCaptacion)) continue // captación apagada
    const referencia = DE_CAPTACION.has(nombre) ? Math.max(inicio, desdeCaptacion) : inicio
    const ultimo = vistos.get(`cron:${nombre}`) ?? referencia
    if (Date.now() - ultimo < min * 3 * 60_000) continue
    const claveAlerta = `alerta_cron:${nombre}`
    const { data: prev } = await admin.from('telegram_estados').select('updated_at').eq('chat_id', claveAlerta).maybeSingle()
    if (prev && Date.now() - new Date(prev.updated_at).getTime() < 3600_000) continue
    const { error: eAlerta } = await admin.from('telegram_estados').upsert({ chat_id: claveAlerta, registro_pendiente: false, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })
    if (eAlerta) console.error(`[vigilarLatidos] no se pudo registrar la alerta de ${nombre}:`, eAlerta.message)
    const nunca = !vistos.has(`cron:${nombre}`)
    await avisarAdmin(`⏱️ <b>Cron detenido</b>\n\n<code>${nombre}</code> ${nunca ? 'no ha registrado ninguna ejecución' : 'no corre'} desde hace más de ${min * 3} minutos. Revisa los logs de Netlify.`)
    caidos.push(nombre)
  }
  return caidos
}

/** Clave de idempotencia de una sola vez (true si es la primera vez que se reclama). */
export async function reclamarUnaVez(clave: string): Promise<boolean> {
  const { error } = await createAdminSupabase().from('telegram_estados').insert({ chat_id: clave, registro_pendiente: false })
  return !error
}
