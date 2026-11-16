// Novedades del cliente (servidor). Una novedad es un hecho que le pasó al cliente y que el portal muestra en vivo; sirve también para saber si el correo
// de respaldo hace falta. NUNCA lanza: un fallo aquí no debe cortar el flujo que lo origina (igual que lib/avisos.ts).
import { createAdminSupabase } from '@/lib/supabase-server'
import type { EntidadEvento } from '@/lib/eventos'
import { portalAbierto, type NivelNovedad } from '@/lib/novedades-politica'

type Admin = ReturnType<typeof createAdminSupabase>

export interface NovedadNueva {
  usuarioId: string
  tipo: string
  nivel: NivelNovedad
  titulo: string
  ruta?: string
  entidad?: EntidadEvento
  entidadId?: string
  /** Idempotencia: el mismo hecho no se registra dos veces. */
  clave: string
}

/** Guarda la novedad. Devuelve su id, o null si ya existía o no se pudo guardar. */
export async function registrarNovedad(n: NovedadNueva, admin: Admin = createAdminSupabase()): Promise<string | null> {
  try {
    const { data, error } = await admin.from('novedades_cliente').insert({
      usuario_id: n.usuarioId, tipo: n.tipo, nivel: n.nivel, titulo: n.titulo.slice(0, 200), ruta: n.ruta ?? '/portal',
      entidad: n.entidad ?? null, entidad_id: n.entidadId ?? null, clave_unica: n.clave,
    }).select('id').single()
    if (error) { if (error.code !== '23505') console.error('[novedades] no se pudo guardar:', error.message); return null }
    return (data?.id as string | undefined) ?? null
  } catch (e) {
    console.error('[novedades] error inesperado al registrar:', e)
    return null
  }
}

/** El portal del cliente avisa que está abierto (latido). */
export async function registrarLatido(usuarioId: string, admin: Admin = createAdminSupabase()): Promise<boolean> {
  try {
    const { error } = await admin.from('usuarios').update({ portal_visto_en: new Date().toISOString() }).eq('id', usuarioId)
    if (error) { console.error('[novedades] latido:', error.message); return false }
    return true
  } catch (e) { console.error('[novedades] error en el latido:', e); return false }
}

/** ¿Tiene el cliente el portal abierto ahora? */
export async function clienteTienePortalAbierto(usuarioId: string, admin: Admin = createAdminSupabase(), ahora: Date = new Date()): Promise<boolean> {
  try {
    const { data } = await admin.from('usuarios').select('portal_visto_en').eq('id', usuarioId).maybeSingle()
    return portalAbierto((data as { portal_visto_en: string | null } | null)?.portal_visto_en, ahora)
  } catch { return false }
}

/**
 * El cliente está mirando el portal: todo lo nuevo hasta ahora queda como visto, y los correos de respaldo que estaban esperando esas novedades se cancelan
 * (ya lo vio, no hace falta). Devuelve cuántas novedades marcó.
 */
export async function marcarNovedadesVistas(usuarioId: string, admin: Admin = createAdminSupabase()): Promise<number> {
  try {
    const { data, error } = await admin.from('novedades_cliente').update({ vista_en: new Date().toISOString() }).eq('usuario_id', usuarioId).is('vista_en', null).select('id, clave_unica')
    if (error) { console.error('[novedades] vistas:', error.message); return 0 }
    const claves = ((data ?? []) as { clave_unica: string }[]).map((n) => n.clave_unica.replace(/^novedad:/, ''))
    if (claves.length) {
      await admin.from('avisos').update({ estado: 'cancelado', error: 'ya lo vio en el portal' })
        .eq('destinatario_id', usuarioId).eq('destinatario_tipo', 'cliente').eq('canal', 'correo').eq('estado', 'pendiente').in('clave_unica', claves)
    }
    return (data ?? []).length
  } catch (e) { console.error('[novedades] error al marcar vistas:', e); return 0 }
}
