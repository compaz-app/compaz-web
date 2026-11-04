/* eslint-disable */
import { FakeDB, makeClient, OTPS } from './fake-db'

export const db = new FakeDB()
export const session: { user: { id: string; email: string } | null } = { user: null }

// Reemplaza a lib/supabase-server.ts en los tests (service_role no emula RLS: la RLS se revisa en el SQL).
export function createAdminSupabase() { return makeClient(db, () => null) as any }
export async function createServerSupabase() { return makeClient(db, () => session.user) as any }

// ── Inicio de sesión por token_hash (/auth/confirm) ──
export const otps = OTPS
export function createRouteSupabase(_req: any, salida: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
  const base: any = makeClient(db, () => session.user)
  base.auth.verifyOtp = async (p: { type: string; token_hash?: string; email?: string; token?: string }) => {
    // Con correo y código (8 dígitos) se busca la entrada vigente de esa persona; con token_hash, por el hash.
    const o = p.token_hash
      ? otps.get(p.token_hash)
      : [...otps.values()].find((x) => x.email === p.email && x.codigo === p.token && !x.usado)
    if (!o || o.usado) return { data: { user: null }, error: { status: 403, code: 'otp_expired', message: 'Email link is invalid or has expired' } }
    o.usado = true
    salida.push({ name: 'sb-test-auth-token', value: `sesion-de-${o.id}`, options: { path: '/', httpOnly: false } })
    return { data: { user: { id: o.id, email: o.email } }, error: null }
  }
  return base
}
