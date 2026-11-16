import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { contarTareas } from '@/lib/panel-pendientes'
import { ok, serverError } from '@/lib/api'

// GET /api/admin/pendientes-bandeja?desde=<ISO> — cuántas tareas abiertas hay (`n`) y cuántas son nuevas desde la última vez que esta persona
// vio la Bandeja (`nuevas`), para el punto rojo del menú. `ahora` es la hora del servidor: la pantalla la guarda como "visto" sin depender de su reloj.
export async function GET(req: NextRequest) {
  const g = await requierePermiso('atender')
  if (!g.ok) return g.res
  const d = req.nextUrl.searchParams.get('desde')
  const desde = d && !Number.isNaN(Date.parse(d)) ? new Date(d).toISOString() : null
  const ahora = new Date().toISOString()
  try { return ok({ ...(await contarTareas(desde)), ahora }) } catch (e) { return serverError(e) }
}
