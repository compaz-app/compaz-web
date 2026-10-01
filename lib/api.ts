// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Helpers estándar para respuestas de API
// ══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server'

export type ApiOk<T> = { ok: true; data: T }
export type ApiErr = { ok: false; error: string }
export type ApiResponse<T> = ApiOk<T> | ApiErr

export function ok<T>(data: T, status = 200): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true, data }, { status })
}

export function err(message: string, status = 400): NextResponse<ApiErr> {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export const unauthorized = () => err('No autorizado', 401)
export const forbidden = () => err('Acceso denegado', 403)
export const notFound = (entity = 'Recurso') => err(`${entity} no encontrado`, 404)
export const serverError = (e?: unknown) => {
  const msg = e instanceof Error ? e.message : 'Error interno del servidor'
  return err(msg, 500)
}
