// Diagnóstico de velocidad del servidor: cuánto tarda una consulta a la base y una comprobación de sesión DESDE donde corre el código (Netlify), y en qué región está.
// Sirve para saber si la lentitud del panel viene de la distancia entre el servidor y la base (cada consulta paga el viaje) o del trabajo de cada pantalla.
import { createAdminSupabase } from '@/lib/supabase-server'
import { usuarioVerificado } from '@/lib/auth'

export interface InformeLatencia {
  /** Región donde corre el servidor (la pone Netlify), o null si no la dice. */ regionServidor: string | null
  /** Milisegundos de 3 consultas simples una tras otra: cada una paga el viaje completo. */ consultasEnSerie: number[]
  /** Milisegundos de 5 consultas a la vez: si es parecido a UNA, las consultas en paralelo no pagan el viaje por separado. */ cincoEnParalelo: number
  /** Milisegundos de la comprobación de sesión contra Supabase Auth (el proxy y la página la hacen en cada pantalla). */ sesion: number
  /** Lectura corta para una persona. */ lectura: string
}

const ms = async (f: () => PromiseLike<unknown>): Promise<number> => { const a = performance.now(); await f(); return Math.round(performance.now() - a) }

export function leerLatencia(serie: number[], paralelo: number, sesion: number): string {
  const unaConsulta = Math.min(...serie)
  if (unaConsulta >= 120) return `Cada consulta tarda ${unaConsulta} ms: el servidor está lejos de la base. Cada pantalla hace varias en fila, por eso se siente lenta. Lo más eficaz es acercar el servidor a la base (región de las funciones de Netlify).`
  if (unaConsulta >= 40) return `Cada consulta tarda ${unaConsulta} ms: la distancia pesa algo. Conviene reducir las consultas en fila y revisar la región.`
  return `Cada consulta tarda ${unaConsulta} ms: el servidor y la base están cerca. Si el panel sigue lento, el costo está en lo que hace cada pantalla.`
}

export async function medirLatencia(): Promise<InformeLatencia> {
  const db = createAdminSupabase()
  const consulta = () => db.from('compitas').select('id').limit(1)
  await consulta() // la primera abre la conexión; no se cuenta
  const consultasEnSerie = [await ms(consulta), await ms(consulta), await ms(consulta)]
  const cincoEnParalelo = await ms(() => Promise.all([consulta(), consulta(), consulta(), consulta(), consulta()]))
  const sesion = await ms(() => usuarioVerificado())
  const regionServidor = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.NETLIFY_REGION ?? null
  return { regionServidor, consultasEnSerie, cincoEnParalelo, sesion, lectura: leerLatencia(consultasEnSerie, cincoEnParalelo, sesion) }
}
