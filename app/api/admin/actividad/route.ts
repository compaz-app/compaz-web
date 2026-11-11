// GET /api/admin/actividad?dias=2&nivel=&q=&pagina=0 — el registro de actividad del equipo: lo que pasó en el sistema, ordenado.
// Reemplaza a los avisos por Telegram de cada evento. Quien no tiene el permiso de teléfonos ve los textos sin teléfonos ni correos.
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { listarActividad } from '@/lib/panel-actividad'
import { ok, serverError } from '@/lib/api'

export async function GET(req: NextRequest) {
  const g = await requierePermiso('monitorear'); if (!g.ok) return g.res
  const sp = req.nextUrl.searchParams
  const dias = Math.min(365, Math.max(1, Number(sp.get('dias') ?? 2) || 2))
  const pagina = Math.max(0, Number(sp.get('pagina') ?? 0) || 0)
  const nivel = sp.get('nivel')
  try {
    return ok(await listarActividad(g.actor, { dias, pagina, q: sp.get('q') ?? '', nivel: nivel === 'actividad' || nivel === 'tarea' || nivel === 'urgente' ? nivel : '' }))
  } catch (e) { return serverError(e) }
}
