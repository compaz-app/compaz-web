import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { publicarResena } from '@/lib/acciones-equipo'
import { ok, err } from '@/lib/api'

// PATCH /api/admin/resenas { id, publicada } — publicar u ocultar una reseña. (El listado ya no sale por esta ruta: lo lee el panel desde el servidor
// recortando contactos; la ruta vieja devolvía el correo de cada cliente a quien solo tuviera "atender".)
export async function PATCH(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  const publicada = typeof body?.publicada === 'boolean' ? body.publicada : null
  if (!id || publicada === null) return err('Parámetros inválidos', 400)
  const r = await publicarResena(id, publicada, g.actor.correo)
  return r.ok ? ok(r.data) : err(r.error, r.status)
}
