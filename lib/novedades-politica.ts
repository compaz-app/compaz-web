// Reglas puras (sin base de datos) de las novedades del cliente y de cuándo hace falta el correo de respaldo. Las usan el servidor y las pruebas.
//
// Principio (decidido 2026-11-16): el portal es el centro de mando y el correo es el RESPALDO. Cada hecho que le pasa al cliente se guarda como novedad y el
// portal lo muestra en vivo. El correo solo sale si hace falta: según la urgencia y si el cliente tiene el portal abierto en ese momento.
//   crítico      sale ya, siempre (seguridad, alguien en la puerta, plazo de minutos).
//   accionable   hay que hacer algo: portal primero; el correo es el respaldo.
//   informativo  pasó algo: portal primero; el correo es el respaldo.
// Con el portal abierto el respaldo espera más (y no sale si lo ve); con el portal cerrado espera poco, para juntar varios avisos en un solo correo.

import type { NombrePlantilla } from '@/lib/plantillas-aviso'

export type NivelNovedad = 'critico' | 'accionable' | 'informativo'
export const NIVELES_NOVEDAD: readonly NivelNovedad[] = ['critico', 'accionable', 'informativo']

/** Minutos de espera antes del correo de respaldo. */
export const ESPERA_PORTAL_ABIERTO_MIN = 15
export const ESPERA_PORTAL_CERRADO_MIN = 3
/** El portal cuenta como abierto si avisó (latido) hace menos de esto. El latido va cada 45 s. */
export const VENTANA_PORTAL_ABIERTO_SEG = 90

/** Qué urgencia tiene cada aviso por correo al cliente. Lo que no esté aquí se trata como accionable. */
export const NIVEL_POR_PLANTILLA: Partial<Record<NombrePlantilla, NivelNovedad>> = {
  compita_llego: 'critico', nadie_abre_cliente: 'critico', visita_sin_acceso_cliente: 'critico', salida_seguridad_cliente: 'critico',
  cancelacion_equipo_cliente: 'critico', pausa_cuenta_cliente: 'critico', todo_bien: 'critico',
  directa_aceptada: 'accionable', entrevista_aceptada: 'accionable', llamada_terminada_cliente: 'accionable', reserva_rechazada: 'accionable',
  reserva_vencida: 'accionable', direccion_faltante_cliente: 'accionable', cita_rechazada_cliente: 'accionable', cita_sin_respuesta_cliente: 'accionable',
  recordatorio_cliente: 'accionable',
  compita_en_camino: 'informativo', lugar_respuesta: 'informativo', cita_propuesta_cliente: 'informativo', pago_confirmado: 'informativo',
  visita_resumen: 'informativo', visita_reporte: 'informativo',
}

/** La frase corta de cada novedad, como se ve en el portal (campana y avisos). Sin emojis ni guiones. */
export const TITULO_NOVEDAD: Partial<Record<NombrePlantilla, string>> = {
  directa_aceptada: 'Tu compita aceptó. Falta el pago.',
  entrevista_aceptada: 'Tu compita aceptó hablar contigo. Elige la hora.',
  pago_confirmado: 'Confirmamos tu pago.',
  llamada_terminada_cliente: 'Terminó tu entrevista. Cuéntanos si contratas.',
  reserva_rechazada: 'Tu compita no puede a esa hora. Elige otra.',
  reserva_vencida: 'La hora que pediste venció. Elige otra.',
  lugar_respuesta: 'Tu compita respondió sobre el lugar.',
  direccion_faltante_cliente: 'Falta la dirección de tu visita.',
  compita_en_camino: 'Tu compita va en camino.',
  compita_llego: 'Tu compita llegó. Confirma que puede empezar.',
  nadie_abre_cliente: 'Tu compita está en la puerta y nadie abre.',
  visita_sin_acceso_cliente: 'La visita no se pudo hacer porque nadie abrió.',
  salida_seguridad_cliente: 'La visita se interrumpió por seguridad.',
  cancelacion_equipo_cliente: 'El equipo canceló tu visita, sin costo para ti.',
  pausa_cuenta_cliente: 'Tu cuenta está en pausa.',
  cita_propuesta_cliente: 'Pediste una hora. Esperando a tu compita.',
  cita_rechazada_cliente: 'Tu compita no puede a esa hora. Elige otra.',
  cita_sin_respuesta_cliente: 'Tu compita aún no confirma la hora.',
  todo_bien: '¿Todo bien en la visita?',
  recordatorio_cliente: 'Tienes un recordatorio.',
  visita_resumen: 'La visita terminó. Ya puedes calificarla.',
  visita_reporte: 'El reporte de bienestar de la visita está listo.',
}
export const TITULO_NOVEDAD_GENERICO = 'Tienes una novedad en tu portal.'

export const nivelDe = (plantilla: string): NivelNovedad => NIVEL_POR_PLANTILLA[plantilla as NombrePlantilla] ?? 'accionable'
export const tituloDe = (plantilla: string): string => TITULO_NOVEDAD[plantilla as NombrePlantilla] ?? TITULO_NOVEDAD_GENERICO

/** ¿El portal está abierto ahora? Según el último latido. */
export function portalAbierto(portalVistoEn: string | null | undefined, ahora: Date = new Date()): boolean {
  if (!portalVistoEn) return false
  const t = new Date(portalVistoEn).getTime()
  return !Number.isNaN(t) && ahora.getTime() - t <= VENTANA_PORTAL_ABIERTO_SEG * 1000
}

/** Cuándo debe salir el correo de respaldo: ya (0) o dentro de N minutos. */
export function esperaDelCorreoMin(nivel: NivelNovedad, abierto: boolean): number {
  if (nivel === 'critico') return 0
  return abierto ? ESPERA_PORTAL_ABIERTO_MIN : ESPERA_PORTAL_CERRADO_MIN
}
