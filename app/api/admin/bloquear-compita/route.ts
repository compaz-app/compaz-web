import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'
import { bloquearCompita, desbloquearCompita } from '@/lib/compitas'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return unauthorized()

  const { compita_id, bloquear } = await req.json()
  if (!compita_id) return err('compita_id requerido')

  try {
    if (bloquear) {
      await bloquearCompita(compita_id)
    } else {
      await desbloquearCompita(compita_id)
    }
    return ok(null)
  } catch (e) {
    return serverError(e)
  }
}
