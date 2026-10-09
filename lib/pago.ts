// Mientras no exista pasarela (Stripe), la "contratación" solo se confirma automáticamente en desarrollo
// o si se activa explícitamente PAGO_SIMULADO=true (modo piloto con cobro manual).
export function pagoSimuladoActivo(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.PAGO_SIMULADO === 'true'
}

export const PLANES_VALIDOS = ['carta', 'quincenal', 'semanal', 'unica', 'mensual'] as const
export const PLAN_INFO: Record<string, { nombre: string; descripcion: string }> = {
  carta:     { nombre: 'A la carta',      descripcion: 'Una visita de 2 horas.' },
  quincenal: { nombre: 'Compañía',        descripcion: '2 visitas al mes de 2 horas cada una.' },
  semanal:   { nombre: 'Compañía Plus',   descripcion: '4 visitas al mes de 2 horas cada una.' },
  unica:     { nombre: 'Visita puntual',  descripcion: 'Una visita de 2 horas.' },
  mensual:   { nombre: 'Membresía',       descripcion: 'Visitas regulares de 2 horas cada una.' },
}
