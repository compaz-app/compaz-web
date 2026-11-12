// Texto de los términos que acepta el cliente al completar la ficha.
//
// PROVISIONAL: lo escribió el sistema a partir de las reglas ya decididas, NO es un texto legal revisado.
// Antes de abrir al público hay que reemplazarlo por el texto aprobado (ver CLAUDE.md sección 6).
// Al reemplazarlo, cambia TERMINOS_VERSION: así queda guardado qué versión aceptó cada cliente.

import { getAjuste } from '@/lib/ajustes'

export const TERMINOS_VERSION = 'provisional-1'
export const TERMINOS_PROVISIONALES = TERMINOS_VERSION.startsWith('provisional')

export interface TextoTerminos {
  version: string
  provisional: boolean
  consentimiento: string
  puntos: string[]
}

/** Los números (horas, minutos, días) salen de Ajustes, así el texto nunca contradice las reglas vigentes. */
export async function textoTerminos(): Promise<TextoTerminos> {
  const [cancelacion, espera, fotos] = await Promise.all([
    getAjuste('cancelacion_gratis_horas'), getAjuste('nadie_abre_espera_min'), getAjuste('foto_retencion_dias'),
  ])
  const direccion = await getAjuste('direccion_horas_antes')
  return {
    version: TERMINOS_VERSION,
    provisional: TERMINOS_PROVISIONALES,
    consentimiento: `Acepto que Compaz guarde estos datos y se los entregue solo al compita que me visita. Las fotos se borran a los ${fotos} días de cerrada la visita. No contactaré al compita fuera de Compaz, y una visita en la que nadie abre se cuenta como usada.`,
    puntos: [
      'Guardamos los datos y las fotos de tu familiar y las tuyas solo para prestar el servicio.',
      `Solo las ve el compita que te visita, y la dirección exacta solo ${direccion} horas antes de la cita.`,
      `Las fotos de llegada se borran ${fotos} días después de cerrada la visita.`,
      'No se contacta al compita fuera de Compaz.',
      `Si el compita llega y nadie abre en ${espera} minutos, la visita se cuenta como usada.`,
      `Cambios y cancelaciones gratis hasta ${cancelacion} horas antes.`,
    ],
  }
}
