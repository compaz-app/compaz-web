import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import type { Usuario } from '@/types'

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
}

export async function getSession() {
  const supabase = await createServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function requireAuth() {
  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  // Construir un objeto session-like para compatibilidad
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  if (!getAdminEmails().includes((session.user.email ?? '').toLowerCase())) redirect('/dashboard')
  return session
}

export function isAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.toLowerCase())
}

export async function getUsuario(): Promise<Usuario | null> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuarios')
    .select('*, compita:compitas(id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, rating_promedio, total_ratings, horarios_disponibles, created_at)')
    .eq('id', user.id)
    .single()

  return data as Usuario | null
}

/**
 * Guard para API routes de admin. Devuelve el usuario o null (responder 401 en el caller).
 * Única fuente de verdad: reemplaza las copias inline de isAdminEmail en cada ruta.
 */
export async function getAdminUser() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return null
  return user
}

/**
 * Usuario de la sesión SOLO si puede usar la plataforma: tiene fila en `usuarios` y no está bloqueado
 * (los admins siempre pasan). Un cliente bloqueado o eliminado recibe null en cada petición, de modo que
 * queda fuera al instante aunque su sesión siga vigente.
 */
export async function getClienteActivo() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (isAdminEmail(user.email ?? '')) return user
  const { data } = await createAdminSupabase().from('usuarios').select('plan').eq('id', user.id).maybeSingle()
  if (!data || data.plan === 'bloqueado') return null
  return user
}
