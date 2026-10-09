// Créditos de visitas: cada pago es un paquete que vence a los 60 días. Las visitas no usadas NO se
// pierden al cerrar el mes, solo al vencer su paquete. Función pura (sin base de datos) y fácil de probar.
export type PaqueteCredito = {
  id: string
  tipo: 'plan' | 'extra'
  plan?: string | null
  visitas: number
  inicio: string // ISO
  vence: string  // ISO
  estado?: 'activo' | 'anulado'
}

export type DetallePaquete = { id: string; tipo: 'plan' | 'extra'; plan: string | null; visitas: number; restantes: number; vence: string; vigente: boolean }
export type ResumenCreditos = {
  disponibles: number            // visitas que puede agendar ahora
  total: number                  // suma de visitas de los paquetes vigentes
  usadas: number                 // total - disponibles (sobre paquetes vigentes)
  proximoVencimiento: string | null // cuándo vence el primer paquete con visitas disponibles
  paquetes: DetallePaquete[]
}

/**
 * Asigna cada visita creada al paquete vigente que vence primero (en el momento en que se creó).
 * Las visitas creadas antes de existir algún paquete (cuentas anteriores) no consumen créditos.
 */
export function calcularCreditos(paquetes: PaqueteCredito[], visitasCreadas: string[], ahora: Date = new Date()): ResumenCreditos {
  const activos = paquetes.filter((p) => p.estado !== 'anulado')
  const restantes = new Map(activos.map((p) => [p.id, p.visitas]))

  const orden = [...visitasCreadas].sort()
  for (const t of orden) {
    const elegido = activos
      .filter((p) => p.inicio <= t && t < p.vence && (restantes.get(p.id) ?? 0) > 0)
      .sort((a, b) => (a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0))[0]
    if (elegido) restantes.set(elegido.id, (restantes.get(elegido.id) ?? 0) - 1)
  }

  const ahoraIso = ahora.toISOString()
  const detalle: DetallePaquete[] = activos.map((p) => ({
    id: p.id, tipo: p.tipo, plan: p.plan ?? null, visitas: p.visitas, restantes: restantes.get(p.id) ?? 0,
    vence: p.vence, vigente: p.inicio <= ahoraIso && ahoraIso < p.vence,
  }))
  const vigentes = detalle.filter((d) => d.vigente)
  const disponibles = vigentes.reduce((s, d) => s + d.restantes, 0)
  const total = vigentes.reduce((s, d) => s + d.visitas, 0)
  const conSaldo = vigentes.filter((d) => d.restantes > 0).sort((a, b) => (a.vence < b.vence ? -1 : 1))
  return { disponibles, total, usadas: total - disponibles, proximoVencimiento: conSaldo[0]?.vence ?? null, paquetes: detalle }
}
