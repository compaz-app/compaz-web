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
  // Sin ids ni números: un mensaje puede traer lo que escribió una persona (un id inválido, un correo). Así tampoco cada variante genera su propia alerta.
  return t.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>').replace(/[\w.+-]+@[\w.-]+/g, '<correo>').replace(/\d+/g, '#').replace(/\s+/g, ' ').slice(0, 300)
}

/** Anota el error en Actividad (una vez por ventana por mensaje). Nunca lanza: reportar un error no puede causar otro. */
export async function reportarError(e: unknown, donde?: string): Promise<void> {
  try {
    const resumen = resumenDeError(e)
    const clave = `error_srv:${createHash('sha1').update(resumen).digest('hex').slice(0, 16)}`
    if (!(await reclamarVentana(clave, VENTANA_ERROR_MS)).ok) return
    // Tope global: aunque los mensajes sean distintos, como mucho 2 alertas de error por minuto (una ruta pública no puede inflar la actividad).
    if (!(await reclamarVentana('error_srv_global', 30_000)).ok) return
    await alertaAdmin('actividad', `⚠️ Error del servidor${donde ? ` en ${donde}` : ''}: ${resumen}`, { categoria: 'error_servidor' })
  } catch (x) {
    console.error('[errores] no se pudo anotar el error:', x instanceof Error ? x.message : x)
  }
}
