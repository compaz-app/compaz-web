// Husos horarios. TODO se guarda y calcula en hora de Venezuela (UTC-4 fijo, sin horario de verano); esta capa solo
// MUESTRA la hora en la zona de quien mira, junto a la de Caracas. El cliente nunca escribe una hora en su huso:
// elige entre horas que ya existen, así se evita el punto donde antes fallaba la conversión.

export const ZONA_CARACAS = 'America/Caracas'

/** Una zona IANA válida, o null. Rechaza texto cualquiera para no llegar a Intl con basura. */
export function zonaValida(z: unknown): string | null {
  if (typeof z !== 'string' || z.length < 3 || z.length > 64 || !/^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(z)) return null
  try { new Intl.DateTimeFormat('es', { timeZone: z }); return z } catch { return null }
}

const hora = (d: Date, zona: string) => new Intl.DateTimeFormat('es-VE', { timeZone: zona, hour: 'numeric', minute: '2-digit', hour12: true }).format(d).replace(/\s*([apAP])\.?\s*[mM]\.?/, ' $1m').replace(/\s/g, ' ').toLowerCase()
const dia = (d: Date, zona: string) => new Intl.DateTimeFormat('es-VE', { timeZone: zona, weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(/\./g, '')
const fechaClave = (d: Date, zona: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

export interface DosHoras {
  /** "Jue 5 nov" y "10:00 am" en Caracas. */
  caracas: { dia: string; hora: string }
  /** Lo mismo en la zona del cliente; null si no tiene zona o es la misma que Caracas. */
  local: { dia: string; hora: string; zona: string } | null
  /** true si en la zona del cliente cae en otro día que en Caracas. */
  otroDia: boolean
  /** Texto listo: "9:00 am tu hora (Miami) · 10:00 am hora de Caracas". */
  texto: string
}

/** Nombre corto de la ciudad de una zona IANA: "America/New_York" → "New York". */
const ciudad = (zona: string) => zona.split('/').pop()!.replace(/_/g, ' ')

export function dosHoras(iso: string, zonaCliente?: string | null): DosHoras {
  const d = new Date(iso)
  const caracas = { dia: dia(d, ZONA_CARACAS), hora: hora(d, ZONA_CARACAS) }
  const z = zonaValida(zonaCliente)
  // Misma hora de pared que Caracas (por ejemplo Santo Domingo o La Paz): se muestra una sola.
  const mismaPared = z && z !== ZONA_CARACAS && hora(d, z) === caracas.hora && fechaClave(d, z) === fechaClave(d, ZONA_CARACAS)
  if (!z || z === ZONA_CARACAS || mismaPared) {
    return { caracas, local: null, otroDia: false, texto: `${caracas.hora} hora de Caracas` }
  }
  const local = { dia: dia(d, z), hora: hora(d, z), zona: z }
  const otroDia = fechaClave(d, z) !== fechaClave(d, ZONA_CARACAS)
  return {
    caracas, local, otroDia,
    texto: `${local.hora} tu hora (${ciudad(z)})${otroDia ? `, ${local.dia}` : ''} · ${caracas.hora} hora de Caracas`,
  }
}
