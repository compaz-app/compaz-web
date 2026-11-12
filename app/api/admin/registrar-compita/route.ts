import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { registrarCompitaManual } from '@/lib/acciones-equipo'
import { ok, err } from '@/lib/api'

// POST /api/admin/registrar-compita — alta a mano de un compita: queda inactivo y sin verificar hasta que el equipo lo active.
export async function POST(req: NextRequest) {
  const g = await requierePermiso('invitar'); if (!g.ok) return g.res
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const r = await registrarCompitaManual(body, g.actor.correo)
  return r.ok ? ok(r.data) : err(r.error, r.status)
}
