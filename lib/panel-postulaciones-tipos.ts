// Postulaciones y origen: tipos y cálculos puros (sin servidor), para que los use también la pantalla.
import { paginaDe } from '@/lib/panel-mas-tipos'

export type TipoPost = 'familia' | 'compita' | 'desconocido'
export type ClasifPost = 'pendiente' | 'calificada' | 'no_calificada' | 'spam' | 'repetida'

export interface FilaOrigen {
  id: string; tipo: TipoPost; clasificacion: ClasifPost; fuente: string; campana: string | null; origen: string | null
  nombre: string; ubicacion: string; recibida: string
}

export const ETIQUETA_TIPO: Record<TipoPost, string> = { familia: 'Familia', compita: 'Aspirante a compita', desconocido: 'Sin tipo' }
export const ETIQUETA_CLASIF: Record<ClasifPost, string> = { pendiente: 'Sin revisar', calificada: 'Calificada', no_calificada: 'No calificada', spam: 'Spam', repetida: 'Repetida' }
export const ETIQUETA_FUENTE: Record<string, string> = {
  home: 'Página principal', se_compita: 'Página "Sé compita"', respaldo_airtable: 'Respaldo de Airtable', importacion_airtable: 'Importada de Airtable', otra: 'Otra',
}

export const DESCRIPCION_POSTULACIONES = 'Quién se postuló, por qué página o campaña llegó y si calificó.'
export const INFO_POSTULACIONES = 'Cada vez que alguien deja sus datos en la página (una familia o un aspirante a compita) queda aquí, con la página y la campaña de anuncios desde la que llegó. Sirve para saber qué campañas traen gente que de verdad califica. Arriba salen las postulaciones que no se pudieron copiar a Airtable, que el equipo de selección no ve hasta que se resuelven. Teléfono y correo no se muestran aquí.'

export const FILTROS_TIPO = ['familia', 'compita'] as const
export const FILTROS_CLASIF = ['pendiente', 'calificada', 'no_calificada', 'spam', 'repetida'] as const

export interface ResumenOrigen { origen: string; total: number; calificadas: number; porcentaje: number }

/** Cuántas postulaciones trajo cada campaña (o, si no hay campaña, cada página) y cuántas calificaron. Ordenado de más a menos. */
export function resumenPorOrigen(filas: FilaOrigen[]): ResumenOrigen[] {
  const m = new Map<string, { total: number; calificadas: number }>()
  for (const f of filas) {
    const clave = f.campana ? `Campaña ${f.campana}` : (ETIQUETA_FUENTE[f.fuente] ?? f.fuente)
    const x = m.get(clave) ?? { total: 0, calificadas: 0 }
    x.total++; if (f.clasificacion === 'calificada') x.calificadas++
    m.set(clave, x)
  }
  return [...m].map(([origen, x]) => ({ origen, ...x, porcentaje: x.total ? Math.round((x.calificadas / x.total) * 100) : 0 })).sort((a, b) => b.total - a.total || a.origen.localeCompare(b.origen))
}

export interface ConsultaPost { filas: FilaOrigen[]; total: number; pag: number; paginas: number; tipo: string; clasif: string; resumen: ResumenOrigen[] }

/** Filtros por tipo y clasificación (valores desconocidos se ignoran) y página. El resumen por origen cuenta TODO lo cargado, no solo lo filtrado. */
export function consultarPostulaciones(todas: FilaOrigen[], tipo: unknown, clasif: unknown, pagina: unknown): ConsultaPost {
  const t = FILTROS_TIPO.includes(tipo as never) ? String(tipo) : ''
  const c = FILTROS_CLASIF.includes(clasif as never) ? String(clasif) : ''
  const filtradas = todas.filter((f) => (!t || f.tipo === t) && (!c || f.clasificacion === c))
  const p = paginaDe(pagina, filtradas.length)
  return { filas: filtradas.slice(p.desde, p.hasta), total: filtradas.length, pag: p.pag, paginas: p.paginas, tipo: t, clasif: c, resumen: resumenPorOrigen(todas) }
}
