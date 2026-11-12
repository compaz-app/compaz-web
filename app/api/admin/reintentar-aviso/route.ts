import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { reintentarAvisoDelEquipo } from '@/lib/panel-estado-acciones'
import { ok, err } from '@/lib/api'

// POST /api/admin/reintentar-aviso { aviso_id } — vuelve a mandar un aviso que falló (Estado del sistema). Respeta el máximo de intentos.
export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender')
  if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { aviso_id?: unknown } | null
  if (!b || typeof b.aviso_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.aviso_id)) return err('Falta el aviso')
  const r = await reintentarAvisoDelEquipo(g.actor, b.aviso_id)
  return r.ok ? ok({ estado: r.estado }) : err(r.error, r.status)
}
