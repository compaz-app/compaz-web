import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return unauthorized()

  const { usuario_id, bloquear } = await req.json()
  if (!usuario_id) return err('usuario_id requerido')

  const admin = createAdminSupabase()
  const { error } = await admin
    .from('usuarios')
    .update({ plan: bloquear ? 'bloqueado' : null })
    .eq('id', usuario_id)

  if (error) return serverError(error)
  return ok(null)
}
