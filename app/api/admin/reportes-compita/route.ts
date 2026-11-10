// GET lista los reportes de compitas con llamada pendiente (el más próximo a vencer primero).
// PATCH { id, resultado } registra que el equipo ya llamó y qué decidió. Requiere el permiso de atender.
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { reportesPendientes, registrarLlamada, RESULTADOS_LLAMADA, type ResultadoLlamada } from '@/lib/bloqueos-compita'
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
