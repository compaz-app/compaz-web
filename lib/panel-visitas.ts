// Datos de Visitas del panel (servidor). Una consulta con los nombres unidos; el resto se clasifica en memoria con lógica pura.
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Actor } from '@/lib/permisos'
import { recortarTexto } from '@/lib/panel-datos'
import { clasificarVisita, type FilaVisita, type VisitaCruda } from '@/lib/panel-visitas-tipos'

const MAX_VISITAS = 1000
type Fila = Omit<VisitaCruda, 'cliente' | 'compita' | 'zona'> & { usuario: { nombre: string } | null; compita: { nombre: string; apellido: string | null; zona: string | null; es_demo?: boolean } | null }

/** Las 1000 visitas más recientes, clasificadas. Las de compitas de demostración no cuentan. */
export async function listarVisitas(ahora: number = Date.now()): Promise<FilaVisita[]> {
  const { data, error } = await createAdminSupabase().from('visitas')
    .select('id, estado, fecha_programada, hora_inicio_programada, inicio, fin, created_at, sin_acceso_en, rating_cliente, usuario_id, compita_id, usuario:usuarios(nombre), compita:compitas(nombre, apellido, zona, es_demo)')
    .order('created_at', { ascending: false }).limit(MAX_VISITAS)
  if (error) throw new Error(`No se pudo leer Visitas: ${error.message}`)
  return ((data ?? []) as unknown as Fila[]).filter((v) => !v.compita?.es_demo).map((v) => clasificarVisita({
    ...v, cliente: v.usuario?.nombre ?? 'Sin nombre', compita: [v.compita?.nombre, v.compita?.apellido].filter(Boolean).join(' ') || 'Sin nombre', zona: v.compita?.zona ?? '',
  }, ahora))
}

export interface DetalleVisita { fila: FilaVisita; linea: { cuando: string; texto: string }[] }

/** El detalle de una visita: cómo va, quiénes participan y su historia. null si no existe. */
export async function detalleDeVisita(actor: Actor, id: string, ahora: number = Date.now()): Promise<DetalleVisita | null> {
  const db = createAdminSupabase()
  const { data } = await db.from('visitas').select('*, usuario:usuarios(nombre), compita:compitas(nombre, apellido, zona, es_demo)').eq('id', id).maybeSingle()
  const v = data as unknown as (Fila & Record<string, unknown>) | null
  if (!v || v.compita?.es_demo) return null
  const fila = clasificarVisita({ ...v, cliente: v.usuario?.nombre ?? 'Sin nombre', compita: [v.compita?.nombre, v.compita?.apellido].filter(Boolean).join(' ') || 'Sin nombre', zona: v.compita?.zona ?? '' }, ahora)
  const [canc, act] = await Promise.all([
    db.from('cancelaciones').select('cancelado_por, tardia, justificada, creado_en').eq('visita_id', id).order('creado_en', { ascending: false }).limit(10),
    db.from('actividad_admin').select('resumen, creado_en').eq('entidad_id', id).order('creado_en', { ascending: false }).limit(15),
  ])
  const ev: { cuando: string; texto: string }[] = []
  const put = (cuando: unknown, texto: string) => { if (typeof cuando === 'string' && cuando) ev.push({ cuando, texto }) }
  put(v.created_at, 'Se agendó la visita'); put(v.llegada_en, 'El compita llegó'); put(v.sin_acceso_en, 'Nadie abrió la puerta'); put(v.inicio, 'La visita empezó')
  put(v.salida_seguridad_en, 'El compita salió por seguridad'); put(v.fin, 'La visita terminó')
  for (const c of canc.data ?? []) put(c.creado_en, `Cancelación por ${c.cancelado_por === 'cliente' ? 'el cliente' : c.cancelado_por === 'compita' ? 'el compita' : 'el equipo'}${c.tardia ? ', con poco aviso' : ''}${c.justificada ? ' (justificada)' : ''}`)
  for (const a of act.data ?? []) put(a.creado_en, recortarTexto(actor, String(a.resumen)))
  return { fila, linea: ev.sort((a, b) => b.cuando.localeCompare(a.cuando)) }
}
