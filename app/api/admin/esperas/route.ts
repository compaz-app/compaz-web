// GET /api/admin/esperas — todas las reglas de espera y límites del sistema, con su valor de hoy y por qué existen.
import { requierePermiso } from '@/lib/permisos'
import { catalogoEsperas } from '@/lib/esperas-catalogo'
import { ok } from '@/lib/api'

export async function GET() {
  const g = await requierePermiso('monitorear'); if (!g.ok) return g.res
  return ok(await catalogoEsperas())
}
