import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { completarSolicitud } from '@/lib/acciones-equipo'
import { ok, err } from '@/lib/api'

// POST /api/admin/completar-solicitud { id } — cierra como completada una solicitud aceptada (la llamada ya ocurrió).
export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const { id } = (await req.json().catch(() => ({}))) as { id?: unknown }
  if (typeof id !== 'string' || !id) return err('id requerido')
  const r = await completarSolicitud(id, g.actor.correo)
  return r.ok ? ok(null) : err(r.error, r.status)
}
