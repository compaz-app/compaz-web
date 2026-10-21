import { createAdminSupabase } from '@/lib/supabase-server'
import { getClienteActivo } from '@/lib/auth'
import { ok, unauthorized, serverError } from '@/lib/api'

export async function POST() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const admin = createAdminSupabase()
  const { error } = await admin
    .from('visitas')
    .update({ room_url: null, llamada_solicitada_at: null })
    .eq('usuario_id', user.id)
    .eq('estado', 'en_curso')

  if (error) return serverError(error)
  return ok({})
}
