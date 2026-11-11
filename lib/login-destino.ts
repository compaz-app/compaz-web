// Decide a dónde va una persona recién autenticada. Compartido por /auth/callback y /auth/confirm.
import { reactivarCuenta } from '@/lib/cuenta-eliminar'
import { createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'

export const BLOQUEADO = 'BLOQUEADO' as const

/**
 * '/admin' para admins; `redirectTo` para clientes con fila en `usuarios`;
 * BLOQUEADO si la cuenta está suspendida; null si no fue invitada.
 */
export async function destinoTrasLogin(userId: string, email: string | null | undefined, redirectTo: string): Promise<string | typeof BLOQUEADO | null> {
  if (isAdminEmail(email ?? '')) return '/panel'
  const { data } = await createAdminSupabase().from('usuarios').select('plan, eliminacion_programada_en, eliminada_en').eq('id', userId).maybeSingle()
  if (!data) return null
  if (data.plan === 'bloqueado' || data.eliminada_en) return BLOQUEADO
  // Pidió eliminar su cuenta y aún está dentro de los 7 días: entrar la reactiva (decidido 2026-11-10).
  if (data.eliminacion_programada_en) await reactivarCuenta(userId)
  return redirectTo
}
