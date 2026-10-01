import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { desactivarCompita, reactivarCompita } from '@/lib/compitas'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return unauthorized()

  const { compita_id, estado } = await req.json() as { compita_id: string; estado: string }
  if (!compita_id || !['activo', 'inactivo'].includes(estado)) return err('Parámetros inválidos')

  try {
    if (estado === 'inactivo') {
      await desactivarCompita(compita_id)
    } else {
      await reactivarCompita(compita_id)
    }
    return ok({ compita_id, estado })
  } catch (e) {
    return serverError(e)
  }
}
