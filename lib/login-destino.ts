// Decide a dónde va una persona recién autenticada. Compartido por /auth/callback y /auth/confirm.
import { createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'

/** '/admin' para admins; `redirectTo` para clientes con fila en `usuarios`; null si no fue invitado. */
export async function destinoTrasLogin(userId: string, email: string | null | undefined, redirectTo: string): Promise<string | null> {
  if (isAdminEmail(email ?? '')) return '/admin'
  const { data } = await createAdminSupabase().from('usuarios').select('id').eq('id', userId).maybeSingle()
  return data ? redirectTo : null
}
