// Velocidad que viven los usuarios reales (Core Web Vitals). Aquí vive SOLO la parte PURA (qué se acepta, cómo se resume): la usa también el panel en el navegador, así que
// NO puede importar nada del servidor. Guardar y leer de la base está en lib/velocidad-real-servidor.ts.
// La medición sale del navegador (`components/MedirVelocidadReal.tsx`) y llega a /api/vitals. Todo es a prueba de fallos: si la tabla no existe todavía o la base
// no responde, no se rompe nada (medir nunca debe volver lento ni inestable lo que mide).

export const METRICAS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const
export type Metrica = (typeof METRICAS)[number]
export type Valoracion = 'good' | 'needs-improvement' | 'poor'
export const CONEXIONES = ['4g', '3g', '2g', 'slow-2g'] as const

/** Umbrales oficiales de Google: hasta el primero es «bueno», hasta el segundo «mejorable», más es «malo». LCP, INP, FCP y TTFB en milisegundos; CLS sin unidad. */
export const UMBRALES: Record<Metrica, [number, number]> = { LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800] }
export const UNIDAD: Record<Metrica, string> = { LCP: 'ms', INP: 'ms', CLS: '', FCP: 'ms', TTFB: 'ms' }
export const ETIQUETA_METRICA: Record<Metrica, string> = {
  LCP: 'Qué tarda en verse lo principal', INP: 'Qué tarda en responder a un toque', CLS: 'Cuánto salta la pantalla al cargar', FCP: 'Qué tarda en aparecer algo', TTFB: 'Qué tarda el servidor en contestar',
}
export const valorar = (m: Metrica, v: number): Valoracion => (v <= UMBRALES[m][0] ? 'good' : v <= UMBRALES[m][1] ? 'needs-improvement' : 'poor')

export interface Medicion { nombre: Metrica; valor: number; ruta: string; conexion: string | null; movil: boolean | null }

/** Solo el primer tramo de la dirección ("/portal/xyz?token=1" → "/portal"): nunca se guardan enlaces con token ni identificadores. */
export function rutaGrupo(ruta: unknown): string {
  if (typeof ruta !== 'string') return '/'
  const tramo = ruta.split(/[?#]/)[0].split('/').filter(Boolean)[0] ?? ''
  return /^[a-z0-9-]{1,30}$/i.test(tramo) ? `/${tramo.toLowerCase()}` : tramo ? '/otra' : '/'
}

/** Lo que llega del navegador no es de fiar: se valida cada medición y se descarta la que no cuadra. Máximo 20 por envío. */
export function validarMediciones(cuerpo: unknown): Medicion[] {
  const lista = Array.isArray((cuerpo as { m?: unknown })?.m) ? ((cuerpo as { m: unknown[] }).m).slice(0, 20) : []
  const salida: Medicion[] = []
  for (const x of lista as Record<string, unknown>[]) {
    const nombre = METRICAS.find((n) => n === x?.nombre)
    const valor = typeof x?.valor === 'number' && Number.isFinite(x.valor) ? x.valor : NaN
    if (!nombre || !(valor >= 0) || valor > 600_000) continue
    salida.push({
      nombre, valor: Math.round(valor * 1000) / 1000, ruta: rutaGrupo(x.ruta),
      conexion: CONEXIONES.find((c) => c === x.conexion) ?? null, movil: typeof x.movil === 'boolean' ? x.movil : null,
    })
  }
  return salida
}

/** Percentil `p` (0 a 1) con el método del vecino más cercano. Con datos de usuarios se mira el 75: así lo mide Google. */
export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null
  const o = [...valores].sort((a, b) => a - b)
  return o[Math.min(o.length - 1, Math.max(0, Math.ceil(p * o.length) - 1))]
}

export interface FilaResumen { metrica: Metrica; muestras: number; p75: number; valoracion: Valoracion }
export interface ResumenVelocidad {
  dias: number; total: number
  general: FilaResumen[]
  /** Las mismas métricas solo para conexiones lentas (3g o peor): donde más se pierden usuarios. */
  lentas: FilaResumen[]
  /** Las páginas con peor tiempo de carga (LCP al 75), con al menos 5 mediciones. */
  paginasLentas: { ruta: string; muestras: number; lcp: number; valoracion: Valoracion }[]
  /** Falta la tabla (la migración no se ha aplicado) o aún no hay datos. */
  estado: 'sin_tabla' | 'sin_datos' | 'ok'
}

export type Fila = { nombre: string; valor: number; ruta: string; conexion: string | null }
export function resumir(filas: Fila[], dias: number): Omit<ResumenVelocidad, 'estado'> {
  const por = (f: Fila[]): FilaResumen[] => METRICAS.flatMap((metrica) => {
    const v = f.filter((x) => x.nombre === metrica).map((x) => Number(x.valor))
    const p = percentil(v, 0.75)
    return p === null ? [] : [{ metrica, muestras: v.length, p75: Math.round(p * 1000) / 1000, valoracion: valorar(metrica, p) }]
  })
  const lcp = filas.filter((x) => x.nombre === 'LCP')
  const rutas = [...new Set(lcp.map((x) => x.ruta))].map((ruta) => {
    const v = lcp.filter((x) => x.ruta === ruta).map((x) => Number(x.valor)); const p = percentil(v, 0.75)!
    return { ruta, muestras: v.length, lcp: Math.round(p), valoracion: valorar('LCP', p) }
  }).filter((r) => r.muestras >= 5).sort((a, b) => b.lcp - a.lcp).slice(0, 5)
  return { dias, total: filas.length, general: por(filas), lentas: por(filas.filter((x) => x.conexion === '3g' || x.conexion === '2g' || x.conexion === 'slow-2g')), paginasLentas: rutas }
}
