// Métricas de velocidad (Core Web Vitals): nombres, umbrales y etiquetas. Módulo PURO, sin servidor, para que una pantalla
// del navegador (components/panel/mas/VelocidadReal.tsx) pueda usarlo sin arrastrar lib/supabase-server.ts (next/headers),
// que rompía la compilación de producción desde 1.3.40. lib/velocidad-real.ts lo vuelve a exportar.
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
