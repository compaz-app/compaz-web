import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return unauthorized()

  const { nombre, email } = await req.json() as { nombre: string; email: string }
  if (!nombre || !email) return err('Faltan datos')

  const admin = createAdminSupabase()

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
  })

  if (error) return serverError(error)

  await admin
    .from('usuarios')
    .upsert({ id: data.user.id, email, nombre }, { onConflict: 'id', ignoreDuplicates: true })

  return ok({ email, nombre })
}
