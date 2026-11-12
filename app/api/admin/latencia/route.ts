import { requierePermiso } from '@/lib/permisos'
import { medirLatencia } from '@/lib/latencia'
import { ok, serverError } from '@/lib/api'

// GET /api/admin/latencia — mide la velocidad entre el servidor y la base (solo administrador). No escribe nada.
export async function GET() {
  const g = await requierePermiso('raiz'); if (!g.ok) return g.res
  try { return ok(await medirLatencia()) } catch (e) { return serverError(e) }
}
