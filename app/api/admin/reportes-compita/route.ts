// GET lista los reportes de compitas con llamada pendiente (el más próximo a vencer primero).
// PATCH { id, resultado } registra que el equipo ya llamó y qué decidió. Requiere el permiso de atender.
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { reportesPendientes, registrarLlamada, cancelarAbiertasDelPar, RESULTADOS_LLAMADA, type ResultadoLlamada } from '@/lib/bloqueos-compita'
import { ok, err, notFound } from '@/lib/api'

export async function GET() {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  return ok(await reportesPendientes())
}

export async function PATCH(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { id?: unknown; resultado?: unknown } | null
  if (!b || typeof b.id !== 'string' || !(RESULTADOS_LLAMADA as readonly unknown[]).includes(b.resultado)) return err('Faltan datos de la llamada', 400)
  return (await registrarLlamada(b.id, g.actor.correo ?? 'equipo', b.resultado as ResultadoLlamada)) ? ok({ registrada: true }) : notFound('Reporte no encontrado o ya atendido')
}

/** POST { id }: cancela las visitas y solicitudes aún abiertas entre ese compita y ese cliente (el equipo lo decide en la llamada). */
export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { id?: unknown } | null
  if (!b || typeof b.id !== 'string') return err('Falta el reporte', 400)
  const r = await cancelarAbiertasDelPar(b.id, g.actor.correo ?? 'equipo')
  return r ? ok(r) : notFound('Reporte no encontrado')
}
