// ══════════════════════════════════════════════════════════════════════════════
// Sistema de Confianza — las reglas de selección del CMC, en una función pura.
//
// FUENTE AUTORIZADA: el CMC (Apps Script de Luis). Este archivo es un ESPEJO de sus
// reglas para que el panel pueda explicarlas y para que la modalidad de demostración
// se comporte igual que la operación real. NO decide nada en producción: la
// habilitación real la sigue haciendo el CMC con `panel_evaluarHabilitacion_`.
// Si el CMC cambia una regla, se cambia aquí y la prueba tests/118 lo vigila.
//
// Correspondencia con el CMC:
//   · Etapas ........................ «03 · Compitas», columna «Etapa de selección»
//   · Entrevista .................... «08 · Entrevistas Compitas» (8 criterios, decisión)
//   · Verificaciones ................ «12 · Verificaciones Compitas» (VERIF_* del script)
//   · Onboarding .................... «16 · Onboarding Compitas»
//   · Alertas ....................... «11 · Alertas Compitas» («Bloquea matching»)
//   · Historial ..................... «17 · Eventos Compitas»
//   · Operadores autorizados ........ «18 · Operadores Compaz»
// ══════════════════════════════════════════════════════════════════════════════

export const ETAPAS = ['Registrado', 'Preseleccionado', 'Entrevistado', 'En verificación', 'Habilitado'] as const
export type EtapaActiva = (typeof ETAPAS)[number]
export type Etapa = EtapaActiva | 'Descartado'

/** Los 8 criterios de la entrevista, en el orden de la hoja 08. Los dos primeros son Sí/No; el resto, de 1 a 5. */
export const CRITERIOS_SI_NO = ['Identidad y ubicación confirmadas', 'Disponibilidad confirmada'] as const
export const CRITERIOS_PUNTAJE = ['Comunicación', 'Empatía y trato', 'Responsabilidad y puntualidad', 'Respeto de límites', 'Criterio ante situaciones de seguridad', 'Coherencia entre formulario y llamada'] as const
export const DECISIONES_ENTREVISTA = ['Avanza a verificación', 'Segunda conversación', 'No avanza'] as const
export type DecisionEntrevista = (typeof DECISIONES_ENTREVISTA)[number]

/** Listas cerradas de «12 · Verificaciones» (iguales a VERIF_ATRIBUTOS_, VERIF_METODOS_, VERIF_RESULTADOS_ y VERIF_ESTADOS_ del script). */
export const VERIF_ATRIBUTOS = ['Identidad', 'Referencia', 'Ubicación / residencia', 'Redes sociales', 'Otro'] as const
export const VERIF_METODOS = ['Documento revisado', 'Videollamada', 'Llamada a referencia', 'Confirmación documental', 'Perfil público revisado', 'Otro'] as const
export const VERIF_RESULTADOS = ['Verificado', 'No verificado', 'Inconcluso'] as const
export const VERIF_ESTADOS = ['Vigente', 'Vencida', 'Anulada'] as const
export type VerifAtributo = (typeof VERIF_ATRIBUTOS)[number]
export type VerifMetodo = (typeof VERIF_METODOS)[number]
export type VerifResultado = (typeof VERIF_RESULTADOS)[number]
export type VerifEstado = (typeof VERIF_ESTADOS)[number]

/** Las cuatro casillas de «16 · Onboarding». */
export const ONBOARDING_CONTROLES = ['Límites no clínicos comprendidos', 'Protocolo de reportes comprendido', 'Privacidad comprendida', 'Manejo de dinero y pagos comprendido'] as const
export const ONBOARDING_RESULTADOS = ['Completado', 'Pendiente', 'Requiere refuerzo'] as const
export type OnboardingResultado = (typeof ONBOARDING_RESULTADOS)[number]

export interface Entrevista { fecha: string; entrevistador: string; siNo: boolean[]; puntajes: number[]; positivas: string; pendientes: string; alertas: string; decision: DecisionEntrevista; razon: string }
export interface Verificacion { id: string; atributo: VerifAtributo; metodo: VerifMetodo; resultado: VerifResultado; evidencia: string; verificadoPor: string; fecha: string; vence: string | null; estado: VerifEstado }
export interface Onboarding { id: string; fecha: string; realizadoPor: string; controles: boolean[]; resultado: OnboardingResultado; observaciones: string }
export interface Alerta { id: string; tipo: string; severidad: 'Baja' | 'Media' | 'Alta'; motivo: string; abierta: boolean; bloquea: boolean }

/** Lo que la regla necesita saber de una Compita. */
export interface ExpedienteSeleccion {
  etapa: Etapa
  entrevistas: Entrevista[]
  verificaciones: Verificacion[]
  onboardings: Onboarding[]
  alertas: Alerta[]
}

export interface Control { id: string; texto: string; cumple: boolean; falta: string }

// Igual que el CMC: cuenta el Estado (Vigente) y el Resultado (Verificado). La fecha de vencimiento NO se compara aquí porque el CMC
// tampoco la compara al habilitar (marca «Vencida» por su cuenta). Si eso cambia en el CMC, se cambia aquí.
const vigente = (v: Verificacion) => v.estado === 'Vigente' && v.resultado === 'Verificado'
const ultima = <T extends { fecha: string }>(xs: T[]): T | null => xs.length ? [...xs].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))[0] : null

/**
 * Espejo de `panel_evaluarHabilitacion_` del CMC: los 7 controles que deben cumplirse para habilitar.
 * `operadorAutorizado` lo resuelve quien llama (en el CMC, la hoja 18).
 */
export function evaluarHabilitacion(x: ExpedienteSeleccion, operadorAutorizado: boolean): { puede: boolean; controles: Control[] } {
  const ent = ultima(x.entrevistas)
  const onb = ultima(x.onboardings)
  const controles: Control[] = [
    { id: 'decision', texto: 'Entrevista con decisión «Avanza a verificación»', cumple: ent?.decision === 'Avanza a verificación', falta: ent ? `La última entrevista dice «${ent.decision}».` : 'Falta registrar la entrevista.' },
    { id: 'etapa', texto: 'Etapa «En verificación»', cumple: x.etapa === 'En verificación', falta: `Está en «${x.etapa}».` },
    { id: 'identidad', texto: 'Identidad verificada y vigente', cumple: x.verificaciones.some((v) => v.atributo === 'Identidad' && vigente(v)), falta: 'Falta una verificación de identidad con resultado Verificado y vigente.' },
    { id: 'referencia', texto: 'Referencia verificada y vigente', cumple: x.verificaciones.some((v) => v.atributo === 'Referencia' && vigente(v)), falta: 'Falta una referencia con resultado Verificado y vigente.' },
    { id: 'onboarding', texto: 'Onboarding completado', cumple: onb?.resultado === 'Completado', falta: onb ? `El último onboarding dice «${onb.resultado}».` : 'Falta registrar el onboarding.' },
    { id: 'alertas', texto: 'Sin alertas abiertas que bloqueen', cumple: !x.alertas.some((a) => a.abierta && a.bloquea), falta: 'Hay una alerta abierta que bloquea el matching.' },
    { id: 'operador', texto: 'Operador autorizado', cumple: operadorAutorizado, falta: 'Quien habilita no está en la lista de operadores autorizados.' },
  ]
  return { puede: controles.every((c) => c.cumple), controles }
}

/** Qué botón de etapa corresponde ahora (o null si no hay transición posible). Mismas transiciones que ofrece la V2. */
export function transicionDisponible(x: ExpedienteSeleccion): { a: Etapa; texto: string } | null {
  const ent = ultima(x.entrevistas)
  if (x.etapa === 'Registrado') return { a: 'Preseleccionado', texto: 'Preseleccionar' }
  if (x.etapa === 'Entrevistado' && ent?.decision === 'Avanza a verificación') return { a: 'En verificación', texto: 'Pasar a verificación' }
  if (x.etapa === 'Entrevistado' && ent?.decision === 'No avanza') return { a: 'Descartado', texto: 'Descartar' }
  return null
}

/** La siguiente acción, en una línea, para la cabecera de la ficha. */
export function siguienteAccion(x: ExpedienteSeleccion): string {
  if (x.etapa === 'Descartado') return 'Proceso cerrado: descartado.'
  if (x.etapa === 'Habilitado') return 'Habilitado: pasa al panel operativo para activar su perfil.'
  if (x.etapa === 'Registrado') return 'Revisar la preentrevista y decidir si se preselecciona.'
  if (x.etapa === 'Preseleccionado') return 'Hacer la entrevista y registrar el resultado.'
  if (x.etapa === 'Entrevistado') {
    const ent = ultima(x.entrevistas)
    if (ent?.decision === 'Segunda conversación') return 'Agendar una segunda conversación.'
    if (ent?.decision === 'No avanza') return 'Cerrar el proceso: la entrevista dice que no avanza.'
    return 'Pasar a verificación.'
  }
  const pend = evaluarHabilitacion(x, true).controles.filter((c) => !c.cumple)
  return pend.length ? `Falta: ${pend.map((c) => c.texto.toLowerCase()).join(', ')}.` : 'Todo listo: se puede habilitar.'
}

/** Promedio de los criterios con puntaje (1 decimal). */
export const promedioEntrevista = (e: Entrevista) => Math.round((e.puntajes.reduce((s, n) => s + n, 0) / Math.max(1, e.puntajes.length)) * 10) / 10

// ── Qué está comprobado, qué es simulado y qué falta validar ───────────────────
// Se muestra en la demostración para no presentar como resultado real lo que no lo es.

export type Madurez = 'comprobado' | 'simulado' | 'pendiente'
export const MADUREZ_TEXTO: Record<Madurez, string> = {
  comprobado: 'Comprobado en operación',
  simulado: 'Simulado en esta demostración',
  pendiente: 'Pendiente de validar',
}

export interface Capacidad { id: string; texto: string; madurez: Madurez; detalle: string }

/** Estado real de cada parte del proceso (17-nov-2026, prueba integral con un perfil interno de prueba). */
export const CAPACIDADES: Capacidad[] = [
  { id: 'registro', texto: 'Registro desde la web', madurez: 'comprobado', detalle: 'La postulación llega a Supabase y al CMC.' },
  { id: 'preentrevista', texto: 'Preentrevista automática', madurez: 'comprobado', detalle: 'El CMC la envía y la recibe sin intervención.' },
  { id: 'entrevista', texto: 'Entrevista con criterios', madurez: 'comprobado', detalle: 'Se registra en el CMC con 8 criterios y una decisión.' },
  { id: 'verificacion', texto: 'Verificación de identidad y referencias', madurez: 'simulado', detalle: 'El registro funciona; en la prueba integral se usaron verificaciones simuladas, no documentos reales.' },
  { id: 'onboarding', texto: 'Onboarding', madurez: 'simulado', detalle: 'El registro funciona; en la prueba integral fue simulado.' },
  { id: 'habilitacion', texto: 'Habilitación con 7 controles', madurez: 'comprobado', detalle: 'El CMC impide habilitar si falta un control.' },
  { id: 'publicacion', texto: 'Publicación automática en la web', madurez: 'comprobado', detalle: 'Cada hora, con correo de bienvenida.' },
  { id: 'perfil', texto: 'Perfil, disponibilidad y Telegram', madurez: 'comprobado', detalle: 'La Compita completa su perfil y vincula Telegram.' },
  { id: 'solicitud', texto: 'Solicitud de una familia y aviso por Telegram', madurez: 'comprobado', detalle: 'Probado con una contratación de prueba.' },
  { id: 'pago', texto: 'Pago del cliente', madurez: 'pendiente', detalle: 'Aún no hay pagos reales: el cobro está en modo simulado.' },
  { id: 'visita', texto: 'Visita real y reporte', madurez: 'pendiente', detalle: 'Aún no se ha hecho una visita real con el flujo completo.' },
]
