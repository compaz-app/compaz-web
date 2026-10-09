// Formatos de fecha en zona Venezuela, compartidos por rutas, crons y emails.
const TZ = 'America/Caracas'

export function formatSlotVE(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

/** Etiqueta de un día "YYYY-MM-DD" sin desfase de zona horaria. */
export function formatFechaVE(fecha: string, conAnio = false): string {
  return new Date(`${fecha}T12:00:00-04:00`).toLocaleDateString('es-VE', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long',
    ...(conAnio ? { year: 'numeric' } : {}),
  })
}

/** Fecha de hoy "YYYY-MM-DD" en Venezuela. */
export function hoyVE(offsetDias = 0): string {
  const d = new Date(Date.now() - 4 * 3600_000 + offsetDias * 86400_000)
  return d.toISOString().slice(0, 10)
}

/** Hora actual "HH:MM" en Venezuela. */
export function horaVE(ms = Date.now()): string {
  return new Date(ms - 4 * 3600_000).toISOString().slice(11, 16)
}

/** ISO válido y en el futuro (con margen opcional en minutos). */
export function esSlotFuturo(iso: unknown, margenMin = 0): iso is string {
  if (typeof iso !== 'string') return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t > Date.now() + margenMin * 60_000
}
