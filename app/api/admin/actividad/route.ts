// GET /api/admin/actividad?dias=2&nivel=&q=&pagina=0 — el registro de actividad del equipo: lo que pasó en el sistema, ordenado.
// Reemplaza a los avisos por Telegram de cada evento. Quien no tiene el permiso de teléfonos ve los textos sin teléfonos ni correos.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { requierePermiso } from '@/lib/permisos'
import { recortarTexto } from '@/lib/panel-datos'
import { ok, serverError } from '@/lib/api'

const POR_PAGINA = 50

export async function GET(req: NextRequest) {
  const g = await requierePermiso('monitorear'); if (!g.ok) return g.res
  const sp = req.nextUrl.searchParams
  const dias = Math.min(90, Math.max(1, Number(sp.get('dias') ?? 2) || 2))
  const pagina = Math.max(0, Number(sp.get('pagina') ?? 0) || 0)
  const nivel = sp.get('nivel'); const q = (sp.get('q') ?? '').trim().toLowerCase()
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString()

  let consulta = createAdminSupabase().from('actividad_admin').select('id, creado_en, nivel, resumen, categoria, entidad_tipo, entidad_id, entidad_nombre')
    .gte('creado_en', desde).order('creado_en', { ascending: false })
  if (nivel === 'actividad' || nivel === 'tarea' || nivel === 'urgente') consulta = consulta.eq('nivel', nivel)
  const { data, error } = await consulta.limit(500)
  if (error) return serverError(error)

  // La búsqueda y el recorte se hacen en el servidor: al navegador solo llega lo que esa persona puede ver.
  const filas = (data ?? []).map((f) => ({ ...f, resumen: recortarTexto(g.actor, String(f.resumen)) }))
    .filter((f) => !q || `${f.resumen} ${f.entidad_nombre ?? ''} ${f.categoria ?? ''}`.toLowerCase().includes(q))
  return ok({ filas: filas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA), total: filas.length, porPagina: POR_PAGINA })
}
