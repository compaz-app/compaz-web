import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return unauthorized()

  const { usuario_id } = await req.json()
  if (!usuario_id) return err('usuario_id requerido')

  const admin = createAdminSupabase()

  // Eliminar visitas del cliente
  await admin.from('visitas').delete().eq('usuario_id', usuario_id)
  // Eliminar action_tokens del cliente
  await admin.from('action_tokens').delete().eq('cliente_id', usuario_id)
  // Eliminar el registro de usuario
  const { error } = await admin.from('usuarios').delete().eq('id', usuario_id)
  if (error) return serverError(error)

  // Eliminar el auth user de Supabase
  await admin.auth.admin.deleteUser(usuario_id)

  return ok(null)
}
