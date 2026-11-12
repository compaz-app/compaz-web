import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { listarFlags, crearFlag, resolverFlag } from '@/lib/acciones-equipo'
import { ok, err } from '@/lib/api'

// GET /api/admin/flags?resueltos=true|false — tareas abiertas (o resueltas). Sin el permiso de teléfonos, las notas llegan sin teléfonos ni correos.
export async function GET(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const r = await listarFlags(g.actor, req.nextUrl.searchParams.get('resueltos') === 'true')
  return r.ok ? ok(r.data) : err(r.error, r.status)
}

// POST /api/admin/flags — crear una tarea { entidad_tipo, entidad_id, entidad_nombre?, nota }
export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const body = await req.json().catch(() => null) as { entidad_tipo?: string; entidad_id?: string; entidad_nombre?: string; nota?: string } | null
  if (!body || !['visita', 'compita', 'cliente'].includes(String(body.entidad_tipo)) || !body.entidad_id || !body.nota?.trim()) return err('Faltan campos requeridos')
  if (body.nota.length > 2000) return err('La nota es demasiado larga')
  const r = await crearFlag(g.actor.correo, { entidad_tipo: body.entidad_tipo as string, entidad_id: body.entidad_id, entidad_nombre: body.entidad_nombre, nota: body.nota })
  return r.ok ? ok(r.data) : err(r.error, r.status)
}

// PATCH /api/admin/flags { flag_id } — resolver una tarea
export async function PATCH(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const { flag_id } = (await req.json().catch(() => ({}))) as { flag_id?: string }
  if (!flag_id) return err('flag_id requerido')
  const r = await resolverFlag(flag_id, g.actor.correo)
  return r.ok ? ok(null) : err(r.error, r.status)
}
