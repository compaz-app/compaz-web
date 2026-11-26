// La parte del servidor de la medición de velocidad: guardar lo que manda el navegador y leer el resumen del panel. Separada de lib/velocidad-real.ts (pura) porque el panel del
// navegador usa esa y un componente del navegador no puede traer código del servidor (next build lo rechaza). Todo es a prueba de fallos: si la tabla no existe todavía o la
// base no responde, no se rompe nada.
import { createAdminSupabase } from '@/lib/supabase-server'
import { valorar, resumir, type Medicion, type ResumenVelocidad, type Fila } from '@/lib/velocidad-real'

export async function guardarMediciones(m: Medicion[]): Promise<boolean> {
  if (m.length === 0) return true
  try {
    const { error } = await createAdminSupabase().from('web_vitals').insert(m.map((x) => ({
      nombre: x.nombre, valor: x.valor, valoracion: valorar(x.nombre, x.valor), ruta: x.ruta, conexion: x.conexion, movil: x.movil,
    })))
    if (error) { console.error('[vitals] no se pudo guardar:', error.message); return false }
    return true
  } catch (e) { console.error('[vitals] error inesperado:', e); return false }
}

export async function resumenVelocidad(dias = 7): Promise<ResumenVelocidad> {
  try {
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString()
    const { data, error } = await createAdminSupabase().from('web_vitals').select('nombre, valor, ruta, conexion').gte('creado_en', desde).limit(20_000)
    if (error) return { ...resumir([], dias), estado: 'sin_tabla' }
    const filas = (data ?? []) as Fila[]
    return { ...resumir(filas, dias), estado: filas.length === 0 ? 'sin_datos' : 'ok' }
  } catch { return { ...resumir([], dias), estado: 'sin_tabla' } }
}
