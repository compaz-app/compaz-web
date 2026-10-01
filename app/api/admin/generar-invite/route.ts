import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { ok, unauthorized, serverError } from '@/lib/api'
import { randomBytes } from 'crypto'

export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return unauthorized()

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
