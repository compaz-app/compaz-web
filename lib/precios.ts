// Precios vigentes: lo que el sistema cobra y muestra HOY. Salen de Ajustes (los cambia el equipo en el panel) y, si no hay valor, de los de fábrica
// de lib/planes.ts. SOLO el servidor decide el importe: el navegador nunca manda ni decide un monto (CLAUDE.md sección 6, punto 3).
import { getAjustes } from '@/lib/ajustes'
import { type PlanId } from '@/lib/planes'

export interface Precios {
  /** Una hora de servicio: también la visita extra y el plan A la carta (1 visita de 1 hora). */
  hora: number
  mandado: number
  /** Precio de cada plan (pago de un mes). */
  planes: Record<PlanId, number>
}

export async function preciosVigentes(): Promise<Precios> {
  const a = await getAjustes()
  return {
    hora: Number(a.precio_hora), mandado: Number(a.precio_mandado),
    planes: { carta: Number(a.precio_hora), quincenal: Number(a.precio_plan_quincenal), semanal: Number(a.precio_plan_semanal) },
  }
}
