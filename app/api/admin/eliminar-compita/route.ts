import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'
import { eliminarCompita } from '@/lib/compitas'

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return unauthorized()

  const { compita_id } = await req.json()
  if (!compita_id) return err('compita_id requerido')

  try {
    await eliminarCompita(compita_id)
    return ok(null)
  } catch (e) {
    return serverError(e)
  }
}
