import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAdminUser } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function DELETE(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { usuario_id } = (await req.json().catch(() => ({})))
  if (!usuario_id) return err('usuario_id requerido')

  const admin = createAdminSupabase()

  // Limpiar FKs que no tienen CASCADE antes de borrar el auth user
  const { error: eVisitas } = await admin.from('visitas').delete().eq('usuario_id', usuario_id)
  if (eVisitas) return serverError(eVisitas)

  const { error: eSolicitudes } = await admin.from('solicitudes').delete().eq('cliente_id', usuario_id)
  if (eSolicitudes) return serverError(eSolicitudes)

  const { error: eTokens } = await admin.from('action_tokens').delete().eq('cliente_id', usuario_id)
  if (eTokens) return serverError(eTokens)

  // Borrar auth.users PRIMERO — propaga CASCADE a usuarios, garantizando que
  // el email quede libre incluso si algún paso anterior hubiera fallado.
  const { error: eAuth } = await admin.auth.admin.deleteUser(usuario_id)
  if (eAuth) return serverError(eAuth)

  return ok(null)
}
