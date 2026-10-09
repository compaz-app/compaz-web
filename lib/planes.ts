// Configuración comercial de Compaz en UN solo lugar. Las cifras son decisiones de negocio y se ajustan aquí.
export type PlanId = 'carta' | 'quincenal' | 'semanal'

export const PLANES: Record<PlanId, { nombre: string; descripcion: string; visitas: number; precioUsd: number }> = {
  carta:     { nombre: 'A la carta',    descripcion: 'Una visita de 2 horas.',                  visitas: 1, precioUsd: 45 },
  quincenal: { nombre: 'Compañía',      descripcion: '2 visitas al mes de 2 horas cada una.',   visitas: 2, precioUsd: 75 },
  semanal:   { nombre: 'Compañía Plus', descripcion: '4 visitas al mes de 2 horas cada una.',   visitas: 4, precioUsd: 140 },
}
export const PLANES_IDS = Object.keys(PLANES) as PlanId[]

/** Las visitas de cada pago no se pierden al cerrar el mes: se pueden usar durante este plazo. */
export const VIGENCIA_CREDITOS_DIAS = 60
/** Cada pago cubre un mes; a los 30 días corresponde pagar el siguiente (aviso al cliente). */
export const CICLO_PAGO_DIAS = 30

/** Visita extra fuera del plan: se cobra por hora, con un mínimo. */
export const PRECIO_HORA_EXTRA_USD = 20
export const HORAS_MINIMAS_EXTRA = 2

export const METODOS_PAGO = ['zelle', 'transferencia', 'stripe', 'otro'] as const
export type MetodoPago = (typeof METODOS_PAGO)[number]
export const ETIQUETA_METODO: Record<MetodoPago, string> = { zelle: 'Zelle', transferencia: 'Transferencia', stripe: 'Tarjeta (Stripe)', otro: 'Otro' }

/** No se promete nada por escrito: solo que aplican condiciones y que se habla directamente con Compaz. */
export const TEXTO_REEMBOLSO = 'Aplican ciertas condiciones. Para cualquier consulta sobre tu pago, habla directamente con Compaz en hola@micompaz.com.'
