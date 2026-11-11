import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { setAjustes, defAjuste } from '@/lib/ajustes'
import { alertaAdmin } from '@/lib/alertas-admin'
import { ok, err } from '@/lib/api'

// PATCH /api/admin/ajustes { cambios: { clave: valor, ... }, confirmar_incoherente? } — guarda varios ajustes a la vez (todo o nada) y deja cada uno
// en el historial. Permiso de editar ajustes. Ver los ajustes no pasa por aquí: la pantalla los lee en el servidor (con el permiso de verlos).
export async function PATCH(req: NextRequest) {
  const g = await requierePermiso('ajustes_editar')
  if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { cambios?: unknown; confirmar_incoherente?: unknown } | null
  if (!b || !b.cambios || typeof b.cambios !== 'object' || Array.isArray(b.cambios) || Object.keys(b.cambios).length === 0 || Object.keys(b.cambios).length > 60) return err('No hay nada que guardar')
  // Lo que el sistema todavía no lee no se cambia: cambiarlo no tendría ningún efecto y daría una falsa seguridad.
  const sinConectar = Object.keys(b.cambios).find((c) => defAjuste(c)?.conectado === false)
  if (sinConectar) return err(`${defAjuste(sinConectar)?.etiqueta ?? sinConectar}: todavía no está conectado al sistema, así que cambiarlo no tendría efecto`, 400)
  const r = await setAjustes({ cambios: b.cambios as Record<string, unknown>, actor: g.actor.correo, confirmarIncoherente: b.confirmar_incoherente === true })
  if (!r.ok) return err(r.error, r.codigo === 'base' ? 503 : r.codigo === 'incoherente' ? 409 : 400)
  if (r.cambiados.length) await alertaAdmin('actividad', `${g.actor.correo} cambió ${r.cambiados.length} ${r.cambiados.length === 1 ? 'ajuste' : 'ajustes'}: ${r.cambiados.map((c) => defAjuste(c)?.etiqueta ?? c).join(', ')}.`, { categoria: 'ajustes_cambiados' })
  return ok({ cambiados: r.cambiados })
}
