// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Lógica de negocio para compitas
// ══════════════════════════════════════════════════════════════════════════════
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Compita } from '@/types'

// Campos públicos seguros para mostrar a clientes
const PUBLIC_FIELDS =
  'id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, horarios_disponibles, telegram_chat_id, created_at' as const

/**
 * Compitas visibles en el marketplace y en el mapa.
 * Solo activas y verificadas.
 */
export async function getCompitasActivas(): Promise<Compita[]> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('compitas')
    .select(PUBLIC_FIELDS)
    .eq('estado', 'activo')
    .eq('verificado', true)
    .not('telegram_chat_id', 'is', null)
    .order('visitas_realizadas', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Compita[]
}

/**
 * Todas las compitas para el panel admin, con todos los campos.
 */
export async function getCompitasAdmin(): Promise<Compita[]> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('compitas')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Compita[]
}

/**
 * Perfil público de una compita por id.
 */
export async function getCompitaById(id: string): Promise<Compita | null> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('compitas')
    .select(PUBLIC_FIELDS)
    .eq('id', id)
    .eq('estado', 'activo')
    .eq('verificado', true)
    .single()

  if (error) return null
  return data as Compita
}

/**
 * Verifica una compita (la hace aparecer en el mapa).
 */
export async function verificarCompita(id: string): Promise<void> {
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('compitas')
    .update({ verificado: true })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Desactiva una compita (la quita del mapa).
 */
export async function desactivarCompita(id: string): Promise<void> {
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('compitas')
    .update({ estado: 'inactivo', verificado: false })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Reactiva una compita previamente desactivada.
 */
export async function reactivarCompita(id: string): Promise<void> {
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('compitas')
    .update({ estado: 'activo' })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function bloquearCompita(id: string): Promise<void> {
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('compitas')
    .update({ estado: 'bloqueado', verificado: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function desbloquearCompita(id: string): Promise<void> {
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('compitas')
    .update({ estado: 'inactivo' })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function eliminarCompita(id: string): Promise<void> {
  const supabase = createAdminSupabase()
  // Desasignar compita de clientes que la tengan asignada
  await supabase.from('usuarios').update({ compita_id: null }).eq('compita_id', id)
  // Eliminar mensajes de visitas del compita
  const { data: visitas } = await supabase.from('visitas').select('id').eq('compita_id', id)
  if (visitas?.length) {
    const visitaIds = visitas.map((v) => v.id)
    await supabase.from('mensajes').delete().in('visit_id', visitaIds)
  }
  // Eliminar visitas del compita
  await supabase.from('visitas').delete().eq('compita_id', id)
  // Eliminar solicitudes del compita
  await supabase.from('solicitudes').delete().eq('compita_id', id)
  // Eliminar action_tokens relacionados
  await supabase.from('action_tokens').delete().eq('compita_id', id)
  // Eliminar tokens de edición de perfil
  await supabase.from('compita_edit_tokens').delete().eq('compita_id', id)
  // Eliminar estado de Telegram si existe
  // telegram_estados usa chat_id como PK, no compita_id — limpiar por telegram_chat_id
  const { data: compita } = await supabase.from('compitas').select('telegram_chat_id').eq('id', id).single()
  if (compita?.telegram_chat_id) {
    await supabase.from('telegram_estados').delete().eq('chat_id', compita.telegram_chat_id)
  }
  const { error } = await supabase.from('compitas').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export type CamposEditablesCompita = {
  nombre?: string
  zona?: string
  descripcion?: string
  servicios?: string[]
  habilidades?: string | null
  youtube_url?: string | null
  foto_url?: string | null
  horarios_disponibles?: { dia: string; inicio: string; fin: string }[]
}

/**
 * Actualiza campos editables del perfil de una compita.
 * Solo admin puede llamar esto (verificado en la ruta API).
 */
export async function actualizarCompita(id: string, campos: CamposEditablesCompita): Promise<Compita> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('compitas')
    .update(campos)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as Compita
}

/**
 * Obtiene una compita por id sin restricciones de estado (solo admin).
 */
export async function getCompitaAdminById(id: string): Promise<Compita | null> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('compitas')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Compita
}
