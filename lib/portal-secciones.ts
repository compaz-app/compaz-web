// Qué BLOQUES muestra cada pestaña del portal según la situación del cliente. Función PURA (se prueba caso por caso); la pantalla solo dibuja
// los bloques en este orden. Es la lógica que antes estaba dentro de las condiciones del portal viejo.

export type PestanaPortal = 'inicio' | 'visitas' | 'familiar' | 'plan'
export const PESTANAS: { id: PestanaPortal; texto: string }[] = [
  { id: 'inicio', texto: 'Inicio' }, { id: 'visitas', texto: 'Visitas' },
  { id: 'familiar', texto: 'Mi familiar' }, { id: 'plan', texto: 'Mi plan' },
]
export const esPestana = (v: unknown): v is PestanaPortal => typeof v === 'string' && PESTANAS.some((p) => p.id === v)

export type BloqueVisitas =
  | 'video' | 'chat' | 'fecha' | 'acciones_coordinacion' | 'reagendar' | 'llegada' | 'direccion' | 'lugar'
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
  // La dirección va ANTES de la fecha: sin ella no se puede agendar (el servidor lo exige y la fecha queda apagada hasta que se registre).
  else if (s.visita === 'pre_visita') { propios('direccion', 'fecha'); b.push('chat'); propios('acciones_coordinacion', 'lugar') }
  // El chat con el compita nunca se pliega: es lo primero que el cliente busca cuando algo cambia.
  else if (s.visita === 'programada') { b.push('chat'); propios('reagendar', 'llegada', 'direccion', 'lugar') }
  if (s.puedeAgendarOtra && !s.vistaPrevia) b.push('agendar_otra')
  if (s.reportes > 0) b.push('bienestar')
  if (s.visitasTerminadas > 0) b.push('historial')
  if (b.length === 0) b.push('vacio')
  return b
}

// El recorrido de una visita: 5 pasos que el cliente ve de un vistazo. Función PURA: dónde está cada paso (hecho, ahora, después) según la visita.
export type EstadoPasoVisita = 'hecho' | 'ahora' | 'despues'
export interface PasoVisita { id: 'direccion' | 'fecha' | 'confirmacion' | 'visita' | 'reporte'; titulo: string; estado: EstadoPasoVisita }
export const TITULOS_RECORRIDO = ['Dirección de la visita', 'Día y hora', 'Confirmación de tu compita', 'La visita', 'Reporte y calificación'] as const

export function recorridoDeVisita(s: { visita: SituacionVisitas['visita']; tieneDireccion: boolean; tieneFecha: boolean }): PasoVisita[] | null {
  if (!s.visita) return null
  // Cuántos pasos están hechos: el siguiente es «ahora». Antes de programarse se avanza según lo que ya tiene; desde que se programa, los 3 primeros están hechos.
  const hechos = s.visita === 'pre_visita' ? (s.tieneDireccion ? (s.tieneFecha ? 2 : 1) : 0) : 3
  const ids = ['direccion', 'fecha', 'confirmacion', 'visita', 'reporte'] as const
  return ids.map((id, i) => ({ id, titulo: TITULOS_RECORRIDO[i], estado: i < hechos ? 'hecho' : i === hechos ? 'ahora' : 'despues' }))
}
