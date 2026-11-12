import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { eliminarClientePorEquipo } from '@/lib/cuenta-eliminar'
import { ok, err, notFound, serverError } from '@/lib/api'

// DELETE /api/admin/eliminar-cliente { usuario_id, borrar_datos? } — solo el administrador raíz. Cierra la cuenta y conserva el historial con el nombre y
// la marca "(cuenta eliminada)". Solo con borrar_datos (la persona pidió que se borren sus datos) se anonimiza.
export async function DELETE(req: NextRequest) {
  const g = await requierePermiso('raiz'); if (!g.ok) return g.res
  const { usuario_id, borrar_datos } = (await req.json().catch(() => ({}))) as { usuario_id?: unknown; borrar_datos?: unknown }
  if (typeof usuario_id !== 'string' || !usuario_id) return err('usuario_id requerido')
  const r = await eliminarClientePorEquipo(usuario_id, g.actor.correo, { borrarDatos: borrar_datos === true })
  if (r.ok) return ok({ visitas_canceladas: r.visitasCanceladas ?? 0 })
  if (r.motivo === 'no_existe') return notFound('Cliente')
  if (r.motivo === 'ya_eliminada') return err('Esta cuenta ya está eliminada', 409)
  if (r.motivo === 'visita_en_vivo') return err('Tiene una visita en curso. Espera a que termine o ciérrala antes de eliminar la cuenta.', 409)
  return serverError(new Error('No se pudo eliminar la cuenta'))
}
