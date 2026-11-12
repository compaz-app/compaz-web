// Registro central de errores del servidor (O-02). Hasta ahora un error solo quedaba en los registros de Netlify, donde nadie los mira. Ahora todo error
// que sube a una respuesta 500 (serverError de lib/api.ts) queda también en Actividad, con su categoría "error_servidor", sin repetirse más de una vez
// cada 10 minutos por mensaje. No es un servicio externo como Sentry (no agrupa ni da trazas): es el mínimo para que el equipo se entere desde el panel.
import { createHash } from 'node:crypto'
import { reclamarVentana } from '@/lib/cron'
import { alertaAdmin } from '@/lib/alertas-admin'

export const VENTANA_ERROR_MS = 10 * 60_000

/** Lo que se anota de un error: su mensaje (sin saltos de línea ni rutas largas), recortado. Nunca el objeto entero. */
export function resumenDeError(e: unknown): string {
  const t = e instanceof Error ? `${e.name}: ${e.message}` : typeof e === 'string' ? e : 'Error sin detalle'
  return t.replace(/\s+/g, ' ').slice(0, 300)
}

/** Anota el error en Actividad (una vez por ventana por mensaje). Nunca lanza: reportar un error no puede causar otro. */
export async function reportarError(e: unknown, donde?: string): Promise<void> {
  try {
    const resumen = resumenDeError(e)
    const clave = `error_srv:${createHash('sha1').update(resumen).digest('hex').slice(0, 16)}`
    if (!(await reclamarVentana(clave, VENTANA_ERROR_MS)).ok) return
    await alertaAdmin('actividad', `⚠️ Error del servidor${donde ? ` en ${donde}` : ''}: ${resumen}`, { categoria: 'error_servidor' })
  } catch (x) {
    console.error('[errores] no se pudo anotar el error:', x instanceof Error ? x.message : x)
  }
}
