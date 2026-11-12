// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Helpers estándar para respuestas de API
// ══════════════════════════════════════════════════════════════════════════════
import { NextResponse, after } from 'next/server'

export type ApiOk<T> = { ok: true; data: T }
export type ApiErr = { ok: false; error: string }
export type ApiResponse<T> = ApiOk<T> | ApiErr

export function ok<T>(data: T, status = 200): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true, data }, { status })
}

export function err(message: string, status = 400): NextResponse<ApiErr> {
  return NextResponse.json({ ok: false, error: message }, { status })
}

/** Respuesta de "espera o límite": `error` es la frase corta (qué pasó y cuándo seguir) y `porQue` la razón, para que la pantalla la esconda tras un ⓘ. */
export function errEspera(e: { resumen: string; porQue: string }, status = 429) {
  return NextResponse.json({ ok: false as const, error: e.resumen, porQue: e.porQue }, { status })
}

export const unauthorized = () => err('No autorizado', 401)
export const forbidden = () => err('Acceso denegado', 403)
export const notFound = (entity = 'Recurso') => err(`${entity} no encontrado`, 404)
/**
 * Respuesta 500. Al cliente le llega un mensaje GENÉRICO (el texto interno de un error puede revelar tablas, columnas o rutas); el detalle queda en el
 * registro del servidor y en Actividad (lib/errores.ts), una vez por ventana por mensaje.
 */
export const serverError = (e?: unknown) => {
  console.error('[500]', e instanceof Error ? e.stack ?? e.message : e)
  const anotar = () => import('@/lib/errores').then((m) => m.reportarError(e ?? 'Error interno'))
  try { after(anotar) } catch { void anotar() } // fuera de una petición (pruebas, scripts) se lanza sin esperar
  return err('Error interno del servidor', 500)
}
