// Activación por etapas del portal nuevo. Cada cliente puede ver el portal nuevo (true), seguir en el viejo (false) o seguir el
// interruptor general `portal_nuevo` de Ajustes (null). Orden previsto: equipo → familias de confianza (true una por una) → todos (ajuste en 1).
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { registrarEvento } from '@/lib/eventos'
import { alertaAdmin } from '@/lib/alertas-admin'

/** Función PURA: lo que diga el cliente manda; si no dice nada, manda el interruptor general. */
export function portalNuevoParaCliente(general: boolean, delCliente: boolean | null | undefined): boolean {
  return typeof delCliente === 'boolean' ? delCliente : general
}

/** ¿Este cliente ve el portal nuevo? Resiliente: si la columna aún no existe en la base, sigue el interruptor general. */
export async function clienteVePortalNuevo(usuarioId: string): Promise<boolean> {
  const general = Number((await getAjustes()).portal_nuevo) === 1
  const { data, error } = await createAdminSupabase().from('usuarios').select('portal_nuevo').eq('id', usuarioId).maybeSingle()
  return portalNuevoParaCliente(general, error ? null : (data as { portal_nuevo: boolean | null } | null)?.portal_nuevo)
}

export async function fijarPortalNuevo(usuarioId: string, activo: boolean | null, por: string): Promise<boolean> {
  const { data } = await createAdminSupabase().from('usuarios').update({ portal_nuevo: activo }).eq('id', usuarioId).select('id, nombre').maybeSingle()
  if (!data) return false
  await registrarEvento({ entidad: 'cliente', entidadId: usuarioId, tipo: 'portal_nuevo_cambiado', actor: `admin:${por}`, datos: { activo } })
  await alertaAdmin('actividad', `ℹ️ ${por} puso a <b>${(data as { nombre: string }).nombre}</b> ${activo === true ? 'en el portal nuevo' : activo === false ? 'en el portal viejo' : 'a seguir el interruptor general del portal'}.`, { categoria: 'portal_nuevo', entidad: { tipo: 'cliente', id: usuarioId, nombre: (data as { nombre: string }).nombre } })
  return true
}
