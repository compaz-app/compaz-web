import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { forzarCierreVisita } from '@/lib/acciones-equipo'
import { ok, err } from '@/lib/api'

// POST /api/admin/forzar-cierre-visita { visita_id } — termina a la fuerza una visita en curso que quedó abierta y avisa al compita.
export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const { visita_id } = (await req.json().catch(() => ({}))) as { visita_id?: unknown }
  if (typeof visita_id !== 'string' || !visita_id) return err('visita_id requerido')
  const r = await forzarCierreVisita(visita_id, g.actor.correo)
  return r.ok ? ok(r.data) : err(r.error, r.status)
}
