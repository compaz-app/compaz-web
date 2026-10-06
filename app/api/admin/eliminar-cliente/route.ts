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

  // Mensajes se eliminan en cascada al borrar las visitas (ON DELETE CASCADE)
  // Eliminar visitas del cliente
  const { error: eVisitas } = await admin.from('visitas').delete().eq('usuario_id', usuario_id)
  if (eVisitas) return serverError(eVisitas)

  // Eliminar solicitudes del cliente (FK a usuarios — sin CASCADE)
  const { error: eSolicitudes } = await admin.from('solicitudes').delete().eq('cliente_id', usuario_id)
  if (eSolicitudes) return serverError(eSolicitudes)

  // Eliminar action_tokens del cliente (FK a auth.users — sin CASCADE)
  const { error: eTokens } = await admin.from('action_tokens').delete().eq('cliente_id', usuario_id)
  if (eTokens) return serverError(eTokens)

  // Eliminar el registro de usuario
  const { error } = await admin.from('usuarios').delete().eq('id', usuario_id)
  if (error) return serverError(error)

  // Eliminar el auth user de Supabase (propaga a usuarios por CASCADE en auth.users)
  const { error: eAuth } = await admin.auth.admin.deleteUser(usuario_id)
  if (eAuth) return serverError(eAuth)

  return ok(null)
}
