// GET /api/admin/dudas?dias=7 — resumen de la ayuda automática: dudas por tipo y resultado, situaciones más consultadas,
// estados no reconocidos y recordatorios al cliente. Sirve para arreglar la CAUSA (por ejemplo, mejorar las indicaciones).
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { resumenAyuda } from '@/lib/ayuda'
import { ok } from '@/lib/api'

export async function GET(req: NextRequest) {
  const g = await requierePermiso('monitorear'); if (!g.ok) return g.res
  const dias = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('dias') ?? 7) || 7))
  return ok(await resumenAyuda(dias))
}
