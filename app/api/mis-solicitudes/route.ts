import { createServerSupabase } from '@/lib/supabase-server'
import { getSolicitudesCliente } from '@/lib/solicitudes'
import { ok, unauthorized, serverError } from '@/lib/api'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  try {
    const solicitudes = await getSolicitudesCliente(user.id)
    return ok({ solicitudes })
  } catch (e) {
    console.error('[mis-solicitudes] error:', e)
    return serverError(e)
  }
}
