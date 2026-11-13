import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { eliminarEnLote, MAX_ELIMINAR_LOTE } from '@/lib/cuenta-eliminar'
import { ok, err } from '@/lib/api'

// DELETE /api/admin/eliminar-lote { tipo: 'cliente' | 'compita', ids: string[], borrar_datos? } — solo el administrador raíz. Elimina varias cuentas con las mismas reglas
// que eliminarlas una por una (conserva el historial con "(cuenta eliminada)"; solo con borrar_datos se anonimiza) y responde cuántas se eliminaron y cuáles no, con el motivo.
export async function DELETE(req: NextRequest) {
  const g = await requierePermiso('raiz'); if (!g.ok) return g.res
  const { tipo, ids, borrar_datos } = (await req.json().catch(() => ({}))) as { tipo?: unknown; ids?: unknown; borrar_datos?: unknown }
  if (tipo !== 'cliente' && tipo !== 'compita') return err('tipo debe ser cliente o compita')
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 64)) return err('ids requerido: una lista de identificadores')
  if (new Set(ids).size > MAX_ELIMINAR_LOTE) return err(`Máximo ${MAX_ELIMINAR_LOTE} cuentas por vez. Elimina primero esas y luego las demás.`)
  return ok(await eliminarEnLote(tipo, ids as string[], g.actor.correo, { borrarDatos: borrar_datos === true }))
}
