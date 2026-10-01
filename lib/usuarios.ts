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
