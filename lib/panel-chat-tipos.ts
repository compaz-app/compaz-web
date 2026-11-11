// Cómo se ordena el chat para el equipo (lógica PURA): día por día, y los mensajes seguidos de la misma persona juntos.
import { diaVE } from '@/lib/panel-visitas-tipos'
import type { MensajePanel } from '@/lib/panel-personas-tipos'

export interface LineaChat { hora: string; texto: string; esFoto: boolean }
export interface BloqueChat { de: MensajePanel['de']; lineas: LineaChat[] }
export interface DiaChat { dia: string; etiqueta: string; bloques: BloqueChat[] }

const horaVE = (iso: string) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

/** "Hoy", "Ayer" o "lunes 2 de noviembre" (hora de Venezuela). */
export function etiquetaDia(dia: string, ahora: number): string {
  if (dia === diaVE(ahora)) return 'Hoy'
  if (dia === diaVE(ahora - 86_400_000)) return 'Ayer'
  const f = new Date(`${dia}T12:00:00-04:00`)
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long' }).format(f)
}

/** Mensajes técnicos del sistema (por ejemplo "plan:quincenal" o "email_notif_mensaje"): marcas internas, no conversación. */
export const esMarcaInterna = (m: Pick<MensajePanel, 'de' | 'texto' | 'esFoto'>) => m.de === 'Compaz' && !m.esFoto && /^[a-z0-9_]+(:[a-z0-9_.-]+)*$/i.test(m.texto.trim())

/** Agrupa por día (el más antiguo primero) y, dentro del día, junta los mensajes seguidos de quien escribe. Las marcas internas no se muestran. */
export function agruparChat(mensajes: MensajePanel[], ahora: number): DiaChat[] {
  const dias: DiaChat[] = []
  for (const m of [...mensajes].sort((a, b) => a.cuando.localeCompare(b.cuando))) {
    if (esMarcaInterna(m)) continue
    const dia = diaVE(m.cuando)
    let d = dias.at(-1)
    if (!d || d.dia !== dia) { d = { dia, etiqueta: etiquetaDia(dia, ahora), bloques: [] }; dias.push(d) }
    const b = d.bloques.at(-1)
    const linea = { hora: horaVE(m.cuando), texto: m.texto, esFoto: m.esFoto }
    if (b && b.de === m.de) b.lineas.push(linea); else d.bloques.push({ de: m.de, lineas: [linea] })
  }
  return dias
}
