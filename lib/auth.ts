import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import type { Usuario } from '@/types'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())

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
  if (!ADMIN_EMAILS.includes(session.user.email ?? '')) redirect('/dashboard')
  return session
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email)
}

export async function getUsuario(): Promise<Usuario | null> {
  const session = await getSession()
  if (!session) return null

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from('usuarios')
    .select('*, compita:compitas(*)')
    .eq('id', session.user.id)
    .single()

  return data as Usuario | null
}
