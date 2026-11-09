import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { requierePermiso } from '@/lib/permisos'
import { ok, err, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('cuentas'); if (!g.ok) return g.res

  const { usuario_id, bloquear } = (await req.json().catch(() => ({})))
  if (!usuario_id) return err('usuario_id requerido')

  const admin = createAdminSupabase()
  const { error } = await admin
    .from('usuarios')
    .update({ plan: bloquear ? 'bloqueado' : null })
    .eq('id', usuario_id)
  if (error) return serverError(error)

  // Capa extra: Supabase Auth también impide iniciar sesión y renovar la sesión de una cuenta bloqueada.
  // (El bloqueo real y inmediato lo aplica nuestro servidor en cada petición: ver getClienteActivo.)
  const { error: eBan } = await admin.auth.admin.updateUserById(usuario_id, { ban_duration: bloquear ? '876000h' : 'none' })
  if (eBan) console.error('[bloquear-cliente] no se pudo (des)bloquear en Auth:', eBan.message)

  return ok(null)
}
