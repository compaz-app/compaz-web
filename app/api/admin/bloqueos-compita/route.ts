// GET lista los bloqueos "compita no vuelve con este cliente"; PATCH { id } levanta uno. Requiere el permiso de atender.
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { listarBloqueos, levantarBloqueo } from '@/lib/bloqueos-compita'
import { ok, err, notFound } from '@/lib/api'

export async function GET() {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  return ok(await listarBloqueos())
}

export async function PATCH(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const body = await req.json().catch(() => null) as { id?: unknown } | null
  if (!body || typeof body.id !== 'string') return err('Falta el bloqueo', 400)
  return (await levantarBloqueo(body.id, g.actor.correo ?? 'equipo')) ? ok({ levantado: true }) : notFound('Bloqueo no encontrado')
}
