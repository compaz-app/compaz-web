import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { actualizarUsuario } from '@/lib/usuarios'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return unauthorized()

  const { usuario_id, compita_id } = await req.json() as { usuario_id: string; compita_id: string }
  if (!usuario_id) return err('Falta usuario_id')

  try {
    await actualizarUsuario(usuario_id, { compita_id: compita_id || null })
    return ok({ usuario_id, compita_id: compita_id || null })
  } catch (e) {
    return serverError(e)
  }
}
