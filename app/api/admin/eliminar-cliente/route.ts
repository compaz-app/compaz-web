import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { requierePermiso } from '@/lib/permisos'
import { ok, err, serverError } from '@/lib/api'
import { borrarFotosDeUsuario } from '@/lib/fotos-privadas'

export async function DELETE(req: NextRequest) {
  const g = await requierePermiso('raiz'); if (!g.ok) return g.res

  const { usuario_id } = (await req.json().catch(() => ({})))
  if (!usuario_id) return err('usuario_id requerido')

  const admin = createAdminSupabase()

  // Las fotos privadas se borran de verdad (archivo incluido) antes de eliminar la cuenta; si alguna falla no se sigue.
  if ((await borrarFotosDeUsuario(usuario_id)) > 0) return err('No se pudieron borrar las fotos del cliente. Reintenta.', 500)

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
