// Seguimiento de bienestar: la parte PURA (qué se calcula y qué se dice). Cada reporte de visita trae 4 notas del 1 al 5 (o N/A) y una novedad. De ahí salen el
// resumen general, la tendencia y las frases; la pantalla (components/ui/SeguimientoBienestar.tsx) solo las dibuja. Sin base de datos ni navegador: se prueba sola.
import type { ReporteVisita } from '@/types'

export type ClaveIndicador = 'animo' | 'fisico' | 'participacion' | 'entorno'
export const INDICADORES: { key: ClaveIndicador; label: string }[] = [
  { key: 'animo', label: 'Ánimo' },
  { key: 'fisico', label: 'Condición física' },
  { key: 'participacion', label: 'Participación' },
  { key: 'entorno', label: 'Ambiente' },
]
export const ETIQUETA_NOTA: Record<number, string> = { 1: 'Muy bajo', 2: 'Bajo', 3: 'Regular', 4: 'Bueno', 5: 'Excelente' }
/** Cuántas visitas se dibujan en la rejilla y en las líneas. Con más, se ven las últimas. */
export const VENTANA_VISITAS = 8
/** Con menos visitas que esto no hay tendencia que contar: se dice con naturalidad y no se dibujan gráficos vacíos. */
export const MIN_VISITAS_TENDENCIA = 3

export type Nota = number | null
export const notaValida = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 5

/** Los reportes del más antiguo al más nuevo, y solo las últimas `ventana`. No modifica lo recibido. */
export function ordenarYRecortar(reportes: ReporteVisita[], ventana: number = VENTANA_VISITAS): ReporteVisita[] {
  return [...reportes].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-ventana)
}

export const serie = (reportes: ReporteVisita[], key: ClaveIndicador): Nota[] => reportes.map((r) => (notaValida(r[key]) ? (r[key] as number) : null))

/** Promedio de las notas que sí aplican en un reporte (las N/A no cuentan). Null si no hay ninguna. */
export function promedioReporte(r: Pick<ReporteVisita, ClaveIndicador>): number | null {
  const v = INDICADORES.map((i) => r[i.key]).filter(notaValida)
  return v.length === 0 ? null : v.reduce((a, b) => a + b, 0) / v.length
}

export type NivelGeneral = 'muy_bien' | 'bien' | 'regular' | 'atencion'
/** Las palabras del resumen. 4,5 o más «Muy bien»; 3,5 o más «Bien»; 2,5 o más «Regular»; menos, «Necesita atención». */
export function nivelGeneral(promedio: number): { nivel: NivelGeneral; texto: string } {
  if (promedio >= 4.5) return { nivel: 'muy_bien', texto: 'Muy bien' }
  if (promedio >= 3.5) return { nivel: 'bien', texto: 'Bien' }
  if (promedio >= 2.5) return { nivel: 'regular', texto: 'Regular' }
  return { nivel: 'atencion', texto: 'Necesita atención' }
}

/** El promedio con coma decimal, como se escribe en español ("4,8"). */
export const formatoPromedio = (p: number): string => (Math.round(p * 10) / 10).toFixed(1).replace('.', ',')

export interface Tendencia { dir: 'sube' | 'baja' | 'igual'; texto: string }
/** Qué pasó respecto a la visita anterior. Diferencias menores a una décima se dicen «igual». Null si no hay con qué comparar. */
export function tendencia(actual: number | null, anterior: number | null): Tendencia | null {
  if (actual === null || anterior === null) return null
  const d = Math.round((actual - anterior) * 10) / 10
  if (d === 0) return { dir: 'igual', texto: 'Igual que la visita anterior' }
  const abs = formatoPromedio(Math.abs(d))
  return d > 0 ? { dir: 'sube', texto: `Subió ${abs} desde la visita anterior` } : { dir: 'baja', texto: `Bajó ${abs} desde la visita anterior` }
}

/** La flecha de una nota respecto a la anterior (solo si las dos existen). */
export function direccion(actual: Nota, anterior: Nota): 'sube' | 'baja' | 'igual' | null {
  if (actual === null || anterior === null) return null
  return actual > anterior ? 'sube' : actual < anterior ? 'baja' : 'igual'
}

/**
 * Una frase sobre lo que más cambió en la ventana, o null si nada cambió lo suficiente (2 puntos o más entre la primera y la última nota de un indicador).
 * «Participación pasó de 2 a 5 en 8 visitas». Si dos cambian igual, gana el que va primero en la lista. Necesita al menos MIN_VISITAS_TENDENCIA visitas.
 */
export function fraseDeCambio(reportes: ReporteVisita[]): string | null {
  if (reportes.length < MIN_VISITAS_TENDENCIA) return null
  let mejor: { label: string; de: number; a: number; salto: number } | null = null
  for (const { key, label } of INDICADORES) {
    const v = serie(reportes, key).filter((n): n is number => n !== null)
    if (v.length < MIN_VISITAS_TENDENCIA) continue
    const de = v[0], a = v[v.length - 1], salto = Math.abs(a - de)
    if (salto >= 2 && (!mejor || salto > mejor.salto)) mejor = { label, de, a, salto }
  }
  return mejor ? `${mejor.label} ${mejor.a > mejor.de ? 'pasó' : 'bajó'} de ${mejor.de} a ${mejor.a} en ${reportes.length} visitas` : null
}

/** La fecha corta de un reporte en hora de Caracas: «18 nov». */
export function fechaCorta(iso: string): string {
  const f = new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', timeZone: 'America/Caracas' }).format(new Date(iso))
  return f.replace(/\./g, '').trim()
}

export interface NovedadFechada { fecha: string; texto: string }
/** Las novedades escritas, de la más nueva a la más vieja (máximo `max`). */
export function novedades(reportes: ReporteVisita[], max = 3): NovedadFechada[] {
  return [...reportes].reverse().filter((r) => !!r.novedad?.trim()).slice(0, max).map((r) => ({ fecha: fechaCorta(r.created_at), texto: String(r.novedad).trim() }))
}
