// Compatibilidad: la configuración vive en lib/planes.ts.
import { PLANES, PLANES_IDS } from '@/lib/planes'

// Mientras no exista pasarela (Stripe), la "contratación" solo se confirma automáticamente en desarrollo
// o si se activa explícitamente PAGO_SIMULADO=true (modo piloto con cobro manual).
export function pagoSimuladoActivo(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.PAGO_SIMULADO === 'true'
}

export const PLANES_VALIDOS = PLANES_IDS
export const PLAN_INFO: Record<string, { nombre: string; descripcion: string }> = Object.fromEntries(
  PLANES_IDS.map((id) => [id, { nombre: PLANES[id].nombre, descripcion: PLANES[id].descripcion }]),
)
