import { createAdminSupabase } from '@/lib/supabase-server'
import { requierePermiso } from '@/lib/permisos'
import { ok, serverError } from '@/lib/api'
import { randomBytes } from 'crypto'

export async function POST() {
  const g = await requierePermiso('invitar'); if (!g.ok) return g.res

  const admin = createAdminSupabase()
  const token = randomBytes(20).toString('hex')
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await admin
    .from('onboarding_tokens')
    .insert({ token, expires_at, usado: false })

  if (error) return serverError(error)

  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding?token=${token}`
  return ok({ url, token })
}
