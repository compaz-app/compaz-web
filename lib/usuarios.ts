// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Lógica de negocio para usuarios (clientes)
// ══════════════════════════════════════════════════════════════════════════════
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Usuario } from '@/types'

/**
 * Perfil de un usuario por su auth.uid.
 */
export async function getUsuarioPorId(id: string): Promise<Usuario | null> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('usuarios')
    .select('*, compita:compitas(*)')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Usuario
}

/**
 * Todos los usuarios para el panel admin.
 */
export async function getUsuariosAdmin(): Promise<Usuario[]> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('usuarios')
    .select('*, compita:compitas(id, nombre, zona, foto_url)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Usuario[]
}

/**
 * Actualiza el perfil de un usuario.
 */
export async function actualizarUsuario(
  id: string,
  campos: Partial<Pick<Usuario, 'nombre' | 'zona' | 'plan' | 'compita_id'>>,
): Promise<void> {
  const supabase = createAdminSupabase()
  const { error } = await supabase.from('usuarios').update(campos).eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Asigna (o desasigna con null) una compita a un cliente. Al asignar, garantiza que exista una visita
 * 'pre_visita' para el chat de coordinación y que la compita esté activa y verificada.
 */
export async function asignarCompita(usuarioId: string, compitaId: string | null): Promise<void> {
  const supabase = createAdminSupabase()
  if (!compitaId) {
    const { error } = await supabase.from('usuarios').update({ compita_id: null }).eq('id', usuarioId)
    if (error) throw new Error(error.message)
    return
  }
  const { data: compita } = await supabase.from('compitas').select('estado, verificado').eq('id', compitaId).maybeSingle()
  if (!compita) throw new Error('La compita no existe')
  if (compita.estado !== 'activo' || !compita.verificado) throw new Error('La compita no está activa y verificada')

  const { error } = await supabase.from('usuarios').update({ compita_id: compitaId }).eq('id', usuarioId)
  if (error) throw new Error(error.message)

  const { data: existente } = await supabase
    .from('visitas').select('id').eq('compita_id', compitaId).eq('usuario_id', usuarioId)
    .in('estado', ['pre_visita', 'programada', 'en_curso']).limit(1).maybeSingle()
  if (!existente) {
    const { error: eV } = await supabase.from('visitas').insert({ compita_id: compitaId, usuario_id: usuarioId, estado: 'pre_visita' })
    if (eV) throw new Error(eV.message)
  }
}
