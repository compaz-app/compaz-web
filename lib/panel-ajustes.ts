// Datos de la pantalla de Ajustes (servidor): cada ajuste con su valor vigente y el historial de cambios.
import { createAdminSupabase } from '@/lib/supabase-server'
import { CATALOGO, defAjuste, getAjustes } from '@/lib/ajustes'
import type { FilaAjuste } from '@/lib/panel-mas-tipos'

export interface CambioAjuste { clave: string; etiqueta: string; anterior: string; nuevo: string; por: string; cuando: string }
export interface DatosAjustes { ajustes: FilaAjuste[]; historial: CambioAjuste[] }

/** El semáforo tiene su propia herramienta en el menú; el resto de los grupos va en Ajustes. */
export const GRUPO_SEMAFORO = 'Semáforo de Seguimiento'
export const esDelSemaforo = (a: Pick<FilaAjuste, 'grupo'>) => a.grupo === GRUPO_SEMAFORO

const mostrar = (v: unknown, unidad: string | null) => {
  const t = typeof v === 'string' ? (v.length > 60 ? `${v.slice(0, 57)}…` : v) : String(v)
  return unidad === '$' ? `$${t}` : unidad ? `${t} ${unidad}` : t
}

export async function datosDeAjustes(): Promise<DatosAjustes> {
  const [valores, h] = await Promise.all([
    getAjustes(),
    createAdminSupabase().from('ajustes_historial').select('clave, valor_anterior, valor_nuevo, cambiado_por, cambiado_en').order('cambiado_en', { ascending: false }).order('id', { ascending: false }).limit(25),
  ])
  if (h.error) throw new Error(`No se pudo leer el historial de ajustes: ${h.error.message}`)
  return {
    ajustes: CATALOGO.map((d) => ({
      clave: d.clave, explica: d.explica, conectado: !('conectado' in d && d.conectado === false), grupo: d.grupo, etiqueta: d.etiqueta, tipo: d.tipo, valor: valores[d.clave], defecto: d.defecto, unidad: ('unidad' in d ? d.unidad : null) ?? null,
      min: ('min' in d ? d.min : null) ?? null, max: ('max' in d ? d.max : null) ?? null, usa: [...d.usa], propuesto: 'propuesto' in d ? d.propuesto === true : false,
    })),
    historial: (h.data ?? []).map((x) => {
      const d = defAjuste(String(x.clave)); const u = d && 'unidad' in d ? (d.unidad ?? null) : null
      return { clave: String(x.clave), etiqueta: d?.etiqueta ?? String(x.clave), anterior: x.valor_anterior === null || x.valor_anterior === undefined ? 'sin valor' : mostrar(x.valor_anterior, u), nuevo: mostrar(x.valor_nuevo, u), por: String(x.cambiado_por), cuando: String(x.cambiado_en) }
    }),
  }
}

export type { FilaAjuste }
