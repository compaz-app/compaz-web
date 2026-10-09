// Mientras no exista pasarela (Stripe), la "contratación" solo se confirma automáticamente en desarrollo
// o si se activa explícitamente PAGO_SIMULADO=true (modo piloto con cobro manual).
export function pagoSimuladoActivo(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.PAGO_SIMULADO === 'true'
}

export const PLANES_VALIDOS = ['carta', 'quincenal', 'semanal'] as const
export const PLAN_INFO: Record<string, { nombre: string; descripcion: string }> = {
  carta:     { nombre: 'A la carta',      descripcion: 'Una visita de 2 horas.' },
  quincenal: { nombre: 'Compañía',        descripcion: '2 visitas al mes de 2 horas cada una.' },
  semanal:   { nombre: 'Compañía Plus',   descripcion: '4 visitas al mes de 2 horas cada una.' },
}

/** Visitas incluidas por plan. 'unico' = total del plan; '30d' = por ciclo de 30 días desde plan_inicio. */
export const LIMITES_PLAN: Record<string, { visitas: number; ciclo: 'unico' | '30d' }> = {
  carta: { visitas: 1, ciclo: 'unico' },
  quincenal: { visitas: 2, ciclo: '30d' },
  semanal: { visitas: 4, ciclo: '30d' },
}
