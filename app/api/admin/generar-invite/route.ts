import { requierePermiso } from '@/lib/permisos'
import { generarInvitacionCompita } from '@/lib/acciones-equipo'
import { ok, err } from '@/lib/api'

// POST /api/admin/generar-invite — enlace de registro de compita, de un solo uso y válido 7 días.
export async function POST() {
  const g = await requierePermiso('invitar'); if (!g.ok) return g.res
  const r = await generarInvitacionCompita(g.actor.correo)
  return r.ok ? ok(r.data) : err(r.error, r.status)
}
