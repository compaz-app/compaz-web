// Qué BLOQUES muestra cada pestaña del portal según la situación del cliente. Función PURA (se prueba caso por caso); la pantalla solo dibuja
// los bloques en este orden. Es la lógica que antes estaba dentro de las condiciones del portal viejo.

export type PestanaPortal = 'inicio' | 'visitas' | 'familiar' | 'plan'
export const PESTANAS: { id: PestanaPortal; texto: string }[] = [
  { id: 'inicio', texto: 'Inicio' }, { id: 'visitas', texto: 'Visitas' },
  { id: 'familiar', texto: 'Mi familiar' }, { id: 'plan', texto: 'Mi plan' },
]
export const esPestana = (v: unknown): v is PestanaPortal => typeof v === 'string' && PESTANAS.some((p) => p.id === v)

export type BloqueVisitas =
  | 'video' | 'chat' | 'fecha' | 'acciones_coordinacion' | 'chat_plegable' | 'reagendar' | 'llegada' | 'direccion' | 'lugar'
  | 'agendar_otra' | 'bienestar' | 'historial' | 'vacio'

export interface SituacionVisitas {
  /** Estado de la visita que está en juego ahora, si hay una. */
  visita: 'en_curso' | 'confirmando_inicio' | 'pre_visita' | 'programada' | null
  /** Se puede agendar una visita nueva con su compita (sin visita activa, con compita activo y al menos una visita hecha). */
  puedeAgendarOtra: boolean
  visitasTerminadas: number
  reportes: number
  /** El equipo mira el portal de un cliente: los bloques que actúan o piden datos del propio cliente no se muestran. */
  vistaPrevia: boolean
}

export function bloquesDeVisitas(s: SituacionVisitas): BloqueVisitas[] {
  const b: BloqueVisitas[] = []
  const propios = (...x: BloqueVisitas[]) => { if (!s.vistaPrevia) b.push(...x) }
  if (s.visita === 'en_curso') { propios('video'); b.push('chat') }
  else if (s.visita === 'confirmando_inicio') b.push('chat')
  else if (s.visita === 'pre_visita') { propios('fecha'); b.push('chat'); propios('acciones_coordinacion', 'direccion', 'lugar') }
  else if (s.visita === 'programada') { b.push('chat_plegable'); propios('reagendar', 'llegada', 'direccion', 'lugar') }
  if (s.puedeAgendarOtra && !s.vistaPrevia) b.push('agendar_otra')
  if (s.reportes > 0) b.push('bienestar')
  if (s.visitasTerminadas > 0) b.push('historial')
  if (b.length === 0) b.push('vacio')
  return b
}
