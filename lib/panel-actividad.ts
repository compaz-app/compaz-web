// Actividad del sistema para el equipo (servidor). La usan la ruta /api/admin/actividad y las pantallas Actividad y Registro de accesos.
// El recorte de teléfonos y correos se hace aquí, en el servidor: al navegador solo llega lo que esa persona puede ver.
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Actor } from '@/lib/permisos'
import { puede } from '@/lib/permisos'
import { recortarTexto } from '@/lib/panel-datos'
import { POR_PAGINA_ACTIVIDAD } from '@/lib/panel-mas-tipos'

export interface FilaActividad { id: string; creado_en: string; nivel: 'actividad' | 'tarea' | 'urgente'; resumen: string; categoria: string | null; entidad_tipo: string | null; entidad_id: string | null; entidad_nombre: string | null }
export interface ConsultaActividad { dias: number; nivel: '' | 'urgente' | 'tarea' | 'actividad'; q: string; pagina: number; categorias?: readonly string[] }

/** Quita lo que rompería un filtro de la base (comas, paréntesis, comillas, comodines) del texto de búsqueda. */
const limpiarBusqueda = (q: string) => q.replace(/[,()"'\\%_*]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Con permiso de teléfonos la búsqueda y la paginación las hace la BASE (así un año de registros se recorre completo, no solo los últimos 500).
 * Sin ese permiso se busca en memoria, sobre el texto YA recortado de las últimas 500 líneas: no se puede adivinar un teléfono tapado preguntando por él.
 */
export async function listarActividad(actor: Actor, c: ConsultaActividad): Promise<{ filas: FilaActividad[]; total: number; porPagina: number }> {
  const desde = new Date(Date.now() - c.dias * 86_400_000).toISOString()
  const COLS = 'id, creado_en, nivel, resumen, categoria, entidad_tipo, entidad_id, entidad_nombre'
  const buscar = c.q.trim()
  const enBase = !buscar || puede(actor, 'telefonos')
  let consulta = createAdminSupabase().from('actividad_admin').select(COLS, { count: 'exact' }).gte('creado_en', desde).order('creado_en', { ascending: false })
  if (c.nivel) consulta = consulta.eq('nivel', c.nivel)
  if (c.categorias?.length) consulta = consulta.in('categoria', [...c.categorias])
  if (enBase) {
    const t = limpiarBusqueda(buscar)
    if (t) consulta = consulta.or(`resumen.ilike.%${t}%,entidad_nombre.ilike.%${t}%,categoria.ilike.%${t}%`)
    const { data, error, count } = await consulta.range(c.pagina * POR_PAGINA_ACTIVIDAD, (c.pagina + 1) * POR_PAGINA_ACTIVIDAD - 1)
    if (error) throw new Error(`No se pudo leer la actividad: ${error.message}`)
    return { filas: (data ?? []).map((f) => ({ ...f, resumen: recortarTexto(actor, String(f.resumen)) }) as FilaActividad), total: count ?? (data ?? []).length, porPagina: POR_PAGINA_ACTIVIDAD }
  }
  const { data, error } = await consulta.limit(500)
  if (error) throw new Error(`No se pudo leer la actividad: ${error.message}`)
  const q = buscar.toLowerCase()
  const filas = (data ?? []).map((f) => ({ ...f, resumen: recortarTexto(actor, String(f.resumen)) }) as FilaActividad)
    .filter((f) => `${f.resumen} ${f.entidad_nombre ?? ''} ${f.categoria ?? ''}`.toLowerCase().includes(q))
  return { filas: filas.slice(c.pagina * POR_PAGINA_ACTIVIDAD, (c.pagina + 1) * POR_PAGINA_ACTIVIDAD), total: filas.length, porPagina: POR_PAGINA_ACTIVIDAD }
}
