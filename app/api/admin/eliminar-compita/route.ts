import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { eliminarCompitaPorEquipo } from '@/lib/cuenta-eliminar'
import { ok, err, notFound, serverError } from '@/lib/api'

// DELETE /api/admin/eliminar-compita { compita_id, borrar_datos? } — solo el administrador raíz. El compita deja de existir para el sistema y su nombre
// queda con "(cuenta eliminada)" en sus visitas y reportes. Solo con borrar_datos (lo pidió la persona) se borran su perfil y contacto.
export async function DELETE(req: NextRequest) {
  const g = await requierePermiso('raiz'); if (!g.ok) return g.res
  const { compita_id, borrar_datos } = (await req.json().catch(() => ({}))) as { compita_id?: unknown; borrar_datos?: unknown }
  if (typeof compita_id !== 'string' || !compita_id) return err('compita_id requerido')
  const r = await eliminarCompitaPorEquipo(compita_id, g.actor.correo, { borrarDatos: borrar_datos === true })
  if (r.ok) return ok(null)
  if (r.motivo === 'no_existe') return notFound('Compita')
  if (r.motivo === 'ya_eliminada') return err('Esta cuenta ya está eliminada', 409)
  if (r.motivo === 'visitas_abiertas') return err('Tiene visitas abiertas. Cancélalas o pásalas a otro compita antes de eliminar la cuenta.', 409)
  return serverError(new Error('No se pudo eliminar la cuenta'))
}
