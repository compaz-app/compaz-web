// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Lógica de negocio para compitas
// ══════════════════════════════════════════════════════════════════════════════
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Compita } from '@/types'
import { escLike } from '@/lib/html'

// Campos públicos seguros para mostrar a clientes
// telegram_chat_id excluido intencionalmente — es dato personal del trabajador
const PUBLIC_FIELDS =
  'id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, horarios_disponibles, created_at, es_demo' as const

/**
 * Compitas visibles en el marketplace y en el mapa.
 * Activas y verificadas con Telegram, MÁS las demos activas y verificadas.
 */
export async function getCompitasActivas(): Promise<Compita[]> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('compitas')
    .select(PUBLIC_FIELDS)
    .eq('estado', 'activo')
    .eq('verificado', true)
    .or('telegram_chat_id.not.is.null,es_demo.eq.true')
    .not('cmc_permite', 'is', false) // el CMC retiró el permiso (NULL = no gestionada: visible)
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
    .not('cmc_permite', 'is', false)
    .single()

  if (error) return null
  return data as Compita
}

/** El CMC no permite activar a esta Compita (no habilitada, pausada, suspendida, de baja o sin aceptar nuevos). */
export class CompitaNoPermitidaPorCmc extends Error {
  constructor(public estadoCmc: string | null) {
    super(`El CMC no permite activar a esta Compita${estadoCmc ? ` (${estadoCmc})` : ''}. Cámbialo primero en el CMC.`)
    this.name = 'CompitaNoPermitidaPorCmc'
  }
}

/** Lanza CompitaNoPermitidaPorCmc si cmc_permite = false. NULL (Compitas anteriores al CMC) pasa. */
export async function exigirPermisoCmc(id: string): Promise<void> {
  const { data, error } = await createAdminSupabase().from('compitas').select('cmc_permite, cmc_estado').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (data?.cmc_permite === false) throw new CompitaNoPermitidaPorCmc(data.cmc_estado ?? null)
}

/**
 * ¿Hay ya un perfil creado desde el CMC (con código COM-) con este email?
 * Las altas manuales (invitación por enlace, registro desde el panel) no deben duplicarlo.
 */
export async function existePerfilCmcConEmail(email: string | null | undefined): Promise<boolean> {
  const e = String(email ?? '').trim()
  if (!e) return false
  const { data, error } = await createAdminSupabase()
    .from('compitas').select('id').ilike('email', escLike(e)).not('codigo', 'is', null).limit(1)
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

/**
 * Verifica una compita (la hace aparecer en el mapa). Exige el permiso del CMC.
 */
export async function verificarCompita(id: string): Promise<void> {
  await exigirPermisoCmc(id)
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('compitas')
    .update({ verificado: true, estado: 'activo' })
    .eq('id', id)
    .neq('estado', 'bloqueado') // verificar nunca desbloquea

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
 * Reactiva una compita previamente desactivada. Exige el permiso del CMC.
 */
export async function reactivarCompita(id: string): Promise<void> {
  await exigirPermisoCmc(id)
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('compitas')
    .update({ estado: 'activo' })
    .eq('id', id)
    .neq('estado', 'bloqueado')

  if (error) throw new Error(error.message)
}

export async function bloquearCompita(id: string): Promise<void> {
  const supabase = createAdminSupabase()
  // Bloqueo efectivo: sale del marketplace, pierde el vínculo de Telegram y se desasigna de sus clientes.
  const { error } = await supabase
    .from('compitas')
    .update({ estado: 'bloqueado', verificado: false, telegram_chat_id: null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await supabase.from('compita_edit_tokens').delete().eq('compita_id', id) // su enlace de edición de perfil deja de valer
  const { error: eU } = await supabase.from('usuarios').update({ compita_id: null }).eq('compita_id', id)
  if (eU) throw new Error(eU.message)
}

export async function desbloquearCompita(id: string): Promise<void> {
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('compitas')
    .update({ estado: 'inactivo' })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function contarVisitasCompita(id: string): Promise<number> {
  const supabase = createAdminSupabase()
  const { count } = await supabase.from('visitas').select('id', { count: 'exact', head: true }).eq('compita_id', id)
  return count ?? 0
}

export async function eliminarCompita(id: string, force = false): Promise<void> {
  const supabase = createAdminSupabase()

  // Si no es force, bloquear si tiene visitas
  if (!force) {
    const visitas = await contarVisitasCompita(id)
    if (visitas > 0) {
      const err = new Error(`TIENE_VISITAS:${visitas}`) as Error & { visitas: number }
      err.visitas = visitas
      throw err
    }
  }

  // Desasignar compita de clientes que la tengan asignada
  const { error: eUsuarios } = await supabase.from('usuarios').update({ compita_id: null }).eq('compita_id', id)
  if (eUsuarios) throw new Error(`usuarios: ${eUsuarios.message}`)

  // Eliminar mensajes de visitas del compita
  const { data: visitasData } = await supabase.from('visitas').select('id').eq('compita_id', id)
  if (visitasData?.length) {
    const visitaIds = visitasData.map((v) => v.id)
    const { error: eMensajes } = await supabase.from('mensajes').delete().in('visit_id', visitaIds)
    if (eMensajes) throw new Error(`mensajes: ${eMensajes.message}`)
  }

  // Eliminar visitas del compita
  const { error: eVisitas } = await supabase.from('visitas').delete().eq('compita_id', id)
  if (eVisitas) throw new Error(`visitas: ${eVisitas.message}`)

  // Eliminar solicitudes del compita
  const { error: eSolicitudes } = await supabase.from('solicitudes').delete().eq('compita_id', id)
  if (eSolicitudes) throw new Error(`solicitudes: ${eSolicitudes.message}`)

  // Eliminar action_tokens relacionados
  const { error: eTokens } = await supabase.from('action_tokens').delete().eq('compita_id', id)
  if (eTokens) throw new Error(`action_tokens: ${eTokens.message}`)

  // Eliminar tokens de edición de perfil (tabla puede no existir aún — ignorar error)
  await supabase.from('compita_edit_tokens').delete().eq('compita_id', id)

  // Eliminar estado de Telegram si existe
  // telegram_estados usa chat_id como PK, no compita_id — limpiar por telegram_chat_id
  const { data: compita } = await supabase.from('compitas').select('telegram_chat_id').eq('id', id).single()
  if (compita?.telegram_chat_id) {
    await supabase.from('telegram_estados').delete().eq('chat_id', compita.telegram_chat_id)
  }

  const { error } = await supabase.from('compitas').delete().eq('id', id)
  if (error) throw new Error(`compitas: ${error.message}`)
}

export type CamposEditablesCompita = {
  nombre?: string
  zona?: string
  descripcion?: string
  servicios?: string[]
  youtube_url?: string | null
  foto_url?: string | null
  horarios_disponibles?: { dia: string; inicio: string; fin: string }[]
}

/**
 * Actualiza campos editables del perfil de una compita.
 * Solo admin puede llamar esto (verificado en la ruta API).
 */
export const CAMPOS_EDITABLES_COMPITA = [
  'nombre', 'zona', 'descripcion', 'servicios', 'youtube_url', 'foto_url', 'horarios_disponibles',
] as const

export async function actualizarCompita(id: string, campos: CamposEditablesCompita): Promise<Compita> {
  const supabase = createAdminSupabase()
  // Whitelist en runtime: el tipo TS no protege contra un body con { verificado: true, ... }
  const limpio = Object.fromEntries(
    Object.entries(campos).filter(([k, v]) => (CAMPOS_EDITABLES_COMPITA as readonly string[]).includes(k) && v !== undefined),
  )
  if (Object.keys(limpio).length === 0) throw new Error('Sin campos válidos para actualizar')
  const { data, error } = await supabase
    .from('compitas')
    .update(limpio)
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
