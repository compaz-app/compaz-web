import { requierePermiso } from '@/lib/permisos'
import { contarPagosPorConfirmar } from '@/lib/panel-pendientes'
import { ok, serverError } from '@/lib/api'

// GET /api/admin/pendientes-pagos — cuántos pagos esperan confirmación, para el punto rojo del menú. Solo el número.
export async function GET() {
  const g = await requierePermiso('pagos')
  if (!g.ok) return g.res
  try { return ok({ n: await contarPagosPorConfirmar() }) } catch (e) { return serverError(e) }
}
