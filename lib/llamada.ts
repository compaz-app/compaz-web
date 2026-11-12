// Duración y avisos de las llamadas (Ajustes: llamada_corte_min, llamada_aviso_min, llamada_visita_min). Los usan las salas de Daily y TODOS los
// textos que se lo dicen a las personas, para que nunca digan un número y el sistema haga otro.
import { getAjuste } from '@/lib/ajustes'
import { nombreDeSalaValido } from '@/lib/llamada-ruta'

/** Minutos tras los cuales la sala de la videollamada de presentación se cierra sola. */
export async function minutosCorteLlamada(): Promise<number> {
  return Number(await getAjuste('llamada_corte_min'))
}

/** Minutos que dura una llamada del compita al cliente durante una visita; la sala se cierra sola al cumplirse. */
export async function minutosLlamadaVisita(): Promise<number> {
  return Number(await getAjuste('llamada_visita_min'))
}

/** Segundos que faltan para el cierre cuando aparece el aviso dentro de la sala. */
export async function segundosDeAviso(tipo: 'entrevista' | 'visita'): Promise<number> {
  if (tipo === 'visita') return Math.min(60, Math.round((await minutosLlamadaVisita()) * 30))
  const [corte, aviso] = await Promise.all([minutosCorteLlamada(), getAjuste('llamada_aviso_min')])
  return Math.max(30, Math.round((corte - Number(aviso)) * 60))
}

export { DURACION_ENTREVISTA_MIN, textoDuracionLlamada } from '@/lib/llamada-ruta'

export interface InfoSala { url: string; finEpoch: number | null; tipo: 'entrevista' | 'visita' }

/** Datos de una sala en Daily (enlace y momento en que se cierra). null si no existe o no es de Compaz. */
export async function infoDeSala(nombre: string): Promise<InfoSala | null> {
  if (!nombreDeSalaValido(nombre)) return null
  try {
    const res = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(nombre)}`, { headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const j = await res.json() as { url?: string; config?: { exp?: number } }
    if (!j.url) return null
    return { url: j.url, finEpoch: j.config?.exp ?? null, tipo: nombre.startsWith('ent-') ? 'entrevista' : 'visita' }
  } catch { return null }
}
