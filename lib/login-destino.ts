// Decide a dónde va una persona recién autenticada. Compartido por /auth/callback y /auth/confirm.
import { createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'

export const BLOQUEADO = 'BLOQUEADO' as const

/**
 * '/admin' para admins; `redirectTo` para clientes con fila en `usuarios`;
 * BLOQUEADO si la cuenta está suspendida; null si no fue invitada.
 */
export async function destinoTrasLogin(userId: string, email: string | null | undefined, redirectTo: string): Promise<string | typeof BLOQUEADO | null> {
  if (isAdminEmail(email ?? '')) return '/admin'
  const { data } = await createAdminSupabase().from('usuarios').select('plan').eq('id', userId).maybeSingle()
  if (!data) return null
  if (data.plan === 'bloqueado') return BLOQUEADO
  return redirectTo
}
