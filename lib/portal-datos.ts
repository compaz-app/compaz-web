// Los datos que necesitan las pestañas del portal nuevo (Visitas, Mi familiar, Mi plan). Es lo que hoy calcula a mano el portal viejo
// (/dashboard), ahora en un solo lugar y tipado. Cada consulta es resiliente: si una falla no tumba el resto (el portal sigue mostrando lo demás).

import { createAdminSupabase } from '@/lib/supabase-server'
import { cupoDelPlan } from '@/lib/visitas'
import { solicitudPendiente, instruccionesPago, referenciaDe, type MetodoDirecto } from '@/lib/solicitudes-pago'
import { listarPagos } from '@/lib/pagos'
import type { Visita, Compita, Mensaje, Usuario, ReporteVisita } from '@/types'

type VisitaConCompita = Visita & { compita: Compita }
export type VisitaPasada = Visita & { compita?: { nombre: string }; mensajes: Mensaje[]; reporte: ReporteVisita | null }

export interface DatosPortal {
  usuario: Usuario | null
  compita: Compita | null
  visitaActiva: VisitaConCompita | null      // en curso o confirmando inicio
  visitaPreVisita: VisitaConCompita | null   // coordinando la fecha
  visitaProgramada: VisitaConCompita | null
  mensajes: Mensaje[]
  reportes: ReporteVisita[]
  visitasPasadas: VisitaPasada[]
  cupo: Awaited<ReturnType<typeof cupoDelPlan>>
  pagos: Awaited<ReturnType<typeof listarPagos>>
  pendientePago: { id: string; tipo: string; plan: string | null; horas: number | null; monto_usd: number; metodo: string; referencia: string; lineas: string[]; configurado: boolean } | null
}

const COMPITA = 'compita:compitas(id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, created_at)'
const seguro = async <T>(nombre: string, p: PromiseLike<{ data: T | null }>, vacio: T): Promise<T> => {
  try { return (await p).data ?? vacio } catch (e) { console.error(`[portal] ${nombre}:`, e); return vacio }
}

export async function cargarDatosPortal(clienteId: string): Promise<DatosPortal> {
  const db = createAdminSupabase()
  const [usuario, activa, pre, programada, reportesRaw, pasadasRaw, cupo, pagos, sp] = await Promise.all([
    seguro('usuario', db.from('usuarios').select(`*, compita:compitas(id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, created_at)`).eq('id', clienteId).maybeSingle(), null as unknown),
    seguro('visitaActiva', db.from('visitas').select(`*, ${COMPITA}`).eq('usuario_id', clienteId).in('estado', ['en_curso', 'confirmando_inicio']).order('created_at', { ascending: false }).limit(1).maybeSingle(), null as unknown),
    seguro('visitaPre', db.from('visitas').select(`*, ${COMPITA}`).eq('usuario_id', clienteId).eq('estado', 'pre_visita').maybeSingle(), null as unknown),
    seguro('visitaProgramada', db.from('visitas').select(`*, ${COMPITA}`).eq('usuario_id', clienteId).eq('estado', 'programada').order('created_at', { ascending: false }).limit(1).maybeSingle(), null as unknown),
    seguro('reportes', db.from('visitas').select('reportes_visita(id, visita_id, animo, fisico, participacion, entorno, novedad, resumen_ia, created_at)').eq('usuario_id', clienteId).eq('estado', 'terminada').order('created_at', { ascending: true }), [] as unknown[]),
    seguro('pasadas', db.from('visitas').select('*, compita:compitas(nombre), mensajes(*), reportes_visita(*)').eq('usuario_id', clienteId).eq('estado', 'terminada').order('created_at', { ascending: false }).limit(10), [] as unknown[]),
    cupoDelPlan(clienteId).catch((e) => { console.error('[portal] cupo:', e); return null }),
    listarPagos(clienteId).catch(() => []),
    solicitudPendiente(clienteId).catch(() => null),
  ])
  const u = usuario as (Usuario & { compita: Compita | null }) | null
  const va = activa as VisitaConCompita | null; const vp = pre as VisitaConCompita | null; const vg = programada as VisitaConCompita | null
  // Los mensajes son los de la visita que está en juego (activa, en coordinación o programada).
  const conChat = va ?? vp ?? vg
  const mensajes = conChat ? await seguro('mensajes', db.from('mensajes').select('*').eq('visit_id', conChat.id).order('created_at', { ascending: true }), [] as Mensaje[]) : []
  const reportes = ((reportesRaw as { reportes_visita: ReporteVisita[] | ReporteVisita | null }[]).flatMap((v) => (v.reportes_visita ? (Array.isArray(v.reportes_visita) ? v.reportes_visita : [v.reportes_visita]) : []))).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const visitasPasadas = (pasadasRaw as (Visita & { compita?: { nombre: string }; mensajes?: Mensaje[]; reportes_visita?: ReporteVisita[] | ReporteVisita })[]).map((v) => ({
    ...v, mensajes: (v.mensajes ?? []) as Mensaje[], reporte: Array.isArray(v.reportes_visita) ? (v.reportes_visita[0] ?? null) : (v.reportes_visita ?? null),
  })) as VisitaPasada[]
  const pendientePago = sp ? { id: sp.id, tipo: sp.tipo, plan: sp.plan, horas: sp.horas, monto_usd: sp.monto_usd, metodo: sp.metodo, referencia: referenciaDe(sp.id), ...(() => { const i = instruccionesPago(sp.metodo as MetodoDirecto); return { lineas: i.lineas, configurado: i.configurado } })() } : null
  return { usuario: u, compita: u?.compita ?? null, visitaActiva: va, visitaPreVisita: vp, visitaProgramada: vg, mensajes, reportes, visitasPasadas, cupo, pagos, pendientePago }
}
