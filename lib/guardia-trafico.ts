// Freno de tráfico del lado del servidor para las consultas automáticas del panel (los puntos rojos). Nace del incidente INC-002 (docs/incidentes.md):
// una pantalla abierta consultó ~5 veces por segundo sin parar. El navegador ya se frena solo, pero el servidor NUNCA debe confiar en el navegador:
// cuenta las consultas de cada persona por minuto y, pasado el tope, responde 429 y avisa al equipo (una vez por hora) para que alguien lo vea.
//
// FALLA ABIERTO a propósito: si el conteo no se puede hacer (la base no responde), la consulta pasa. Este freno protege contra un error, no es una barrera de
// seguridad; no debe ser él quien deje sin punto rojo a todo el equipo.
import { sumarIntento } from '@/lib/limite'
import { reclamarVentana } from '@/lib/cron'
import { alertaAdmin } from '@/lib/alertas-admin'
import { explicarEspera, type Espera } from '@/lib/esperas'

/** Una pantalla normal consulta unas 3 veces por minuto por ruta (cada 20 s). 30 deja margen para varias pestañas y para los avisos de cambio. */
export const TOPE_CONSULTAS_PANEL = { max: 30, ventanaMin: 1 }
const AVISO_CADA_MS = 60 * 60_000

/** Cuenta esta consulta. Devuelve null si pasa, o la explicación de la espera si la persona se pasó del tope por minuto. */
export async function limitarConsultas(correo: string, ruta: string, tope = TOPE_CONSULTAS_PANEL): Promise<Espera | null> {
  try {
    const n = await sumarIntento(`trafico:${ruta}:${correo.toLowerCase()}`, tope.ventanaMin)
    if (n <= tope.max) return null
    // Pasó el tope: se avisa una vez por hora y por persona y ruta (no una por cada consulta de más).
    const aviso = await reclamarVentana(`alerta_trafico:${ruta}:${correo.toLowerCase()}`, AVISO_CADA_MS)
    if (aviso.ok) {
      await alertaAdmin('urgente', `Tráfico anormal: <b>${correo}</b> hizo ${n} consultas en un minuto a <code>${ruta}</code> (lo normal son unas 3). Casi siempre es un error de una pantalla abierta, no un ataque: pídele que cierre el panel y avisa para revisar el código. El servidor ya la está frenando.`,
        { clave: `trafico:${ruta}:${correo.toLowerCase()}`, categoria: 'trafico' })
    }
    return explicarEspera('panel_consultas', { usados: n, max: tope.max, desde: new Date(), duracionMs: tope.ventanaMin * 60_000 })
  } catch (e) {
    console.error('[trafico] no se pudo contar (la consulta pasa):', e instanceof Error ? e.message : e)
    return null
  }
}
