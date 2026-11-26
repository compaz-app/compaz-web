import { requierePermiso } from '@/lib/permisos'
import { resumenVelocidad } from '@/lib/velocidad-real-servidor'
import { ok, serverError } from '@/lib/api'

// GET /api/admin/velocidad-real — resumen de la velocidad que viven los usuarios reales (últimos 7 días, solo administrador). No escribe nada.
export async function GET() {
  const g = await requierePermiso('raiz'); if (!g.ok) return g.res
  try { return ok(await resumenVelocidad(7)) } catch (e) { return serverError(e) }
}
