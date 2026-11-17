import { requierePermiso } from '@/lib/permisos'
import { contarPagosPorConfirmar } from '@/lib/panel-pendientes'
import { ok, serverError, errEspera } from '@/lib/api'
import { limitarConsultas } from '@/lib/guardia-trafico'

// GET /api/admin/pendientes-pagos — cuántos pagos esperan confirmación, para el punto rojo del menú. Solo el número.
export async function GET() {
  const g = await requierePermiso('pagos')
  if (!g.ok) return g.res
  const espera = await limitarConsultas(g.actor.correo, 'pendientes-pagos')
  if (espera) return errEspera(espera)
  try { return ok({ n: await contarPagosPorConfirmar() }) } catch (e) { return serverError(e) }
}
