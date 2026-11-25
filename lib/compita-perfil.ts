// ¿Tiene el compita su perfil público lleno? Es lo que ven las familias al elegir, así que Telegram no se activa y no se verifica sin esto. Función PURA.
// Lo mínimo: descripción, al menos un servicio y al menos 2 horas libres por semana. Las horas libres son lo que el cliente ve para elegir su entrevista: sin ellas
// el sistema no tiene nada que ofrecer (decidido 2026-11-19: las horas se acuerdan SOLO con las horas libres; nadie las escribe en texto libre). La foto y el video
// son opcionales (el formulario tampoco los exige).
export const HORAS_MINIMAS_SEMANA = 2
export const PERFIL_MINIMO = `descripción, al menos un servicio y al menos ${HORAS_MINIMAS_SEMANA} horas libres por semana para entrevistas`

type Franja = { dia?: unknown; inicio?: unknown; fin?: unknown }
const aMin = (hhmm: unknown): number | null => {
  if (typeof hhmm !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm); if (!m) return null
  const t = Number(m[1]) * 60 + Number(m[2])
  return Number.isFinite(t) && t >= 0 && t <= 24 * 60 ? t : null
}

/** Horas libres por semana: las franjas se juntan por día (si dos se solapan no se cuentan dos veces). */
export function horasLibresSemana(horarios: Franja[] | null | undefined): number {
  if (!Array.isArray(horarios)) return 0
  const porDia = new Map<string, [number, number][]>()
  for (const h of horarios) {
    const i = aMin(h?.inicio), f = aMin(h?.fin)
    if (typeof h?.dia !== 'string' || i === null || f === null || f <= i) continue
    porDia.set(h.dia, [...(porDia.get(h.dia) ?? []), [i, f]])
  }
  let minutos = 0
  for (const franjas of porDia.values()) {
    let fin = -1
    for (const [i, f] of franjas.sort((a, b) => a[0] - b[0])) { const desde = Math.max(i, fin); if (f > desde) minutos += f - desde; fin = Math.max(fin, f) }
  }
  return minutos / 60
}

export const tieneHorasMinimas = (horarios: Franja[] | null | undefined): boolean => horasLibresSemana(horarios) >= HORAS_MINIMAS_SEMANA

export function perfilCompleto(c: { descripcion?: string | null; servicios?: string[] | null; horarios_disponibles?: Franja[] | null } | null | undefined): boolean {
  if (!c) return false
  return !!c.descripcion && c.descripcion.trim().length > 0
    && Array.isArray(c.servicios) && c.servicios.some((s) => typeof s === 'string' && s.trim().length > 0)
    && tieneHorasMinimas(c.horarios_disponibles)
}
