import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import type { Usuario } from '@/types'

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
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
    .select('*, compita:compitas(*)')
    .eq('id', user.id)
    .single()

  return data as Usuario | null
}
