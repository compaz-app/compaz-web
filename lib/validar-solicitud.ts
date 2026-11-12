// Validación en el SERVIDOR del formulario nuevo de solicitud (punto 6 del rediseño). Bloquear el botón en la
// pantalla no basta: el servidor es quien exige los requisitos de seguridad. Función pura, sin base de datos.
// Contrato nuevo = el cuerpo trae `tipo`. Sin `tipo` la ruta usa el contrato anterior sin cambios.

export const TIPOS_SOLICITUD = ['entrevista', 'directa', 'mandado'] as const
export type TipoSolicitud = (typeof TIPOS_SOLICITUD)[number]

/** Qué necesita el familiar (opciones rápidas del formulario). */
export const QUE_OPCIONES = ['Compañía y conversación', 'Acompañar a una cita o a misa', 'Paseo o ejercicio', 'Otra cosa'] as const

/** Quién más estará en un lugar privado: solo el TIPO de cada persona, nunca nombres (esos van en la ficha tras pagar). */
export const TIPOS_PERSONA = ['Familiar', 'Amigo o amiga', 'Vecino o vecina', 'Persona que cuida o ayuda', 'Otra persona'] as const

export const MAX_NOTA = 300
export const MAX_PERSONAS = 10
export const DURACIONES_MANDADO_MIN = [15, 30, 60] as const

export interface SolicitudNueva {
  tipo: TipoSolicitud
  /** Texto corto que ve el compita: una opción rápida, o "Mandado" cuando es un mandado. */
  que: string
  /** Nota opcional (obligatoria en un mandado, donde describe qué hacer). Sin censurar todavía. */
  nota: string | null
  lugar_privado: boolean
  /** null si el lugar no es privado; [] significa "nadie más, solo mi familiar"; si no, los tipos presentes. */
  personas_en_lugar: string[] | null
  /** Solo en mandados: lo que el cliente estima que tomará. */
  duracion_min: number | null
}

export type ResultadoSolicitudNueva = { ok: true; valor: SolicitudNueva } | { ok: false; error: string }

const falla = (error: string): ResultadoSolicitudNueva => ({ ok: false, error })

export function validarSolicitudNueva(b: Record<string, unknown>): ResultadoSolicitudNueva {
  const tipo = b.tipo
  if (typeof tipo !== 'string' || !(TIPOS_SOLICITUD as readonly string[]).includes(tipo)) return falla('Tipo de solicitud inválido')
  const t = tipo as TipoSolicitud

  // Nota: opcional (máximo 300), obligatoria en un mandado porque ahí describe qué debe hacer el compita.
  const notaCruda = typeof b.nota === 'string' ? b.nota.trim() : b.nota === undefined || b.nota === null ? '' : null
  if (notaCruda === null) return falla('La nota debe ser un texto')
  if (notaCruda.length > MAX_NOTA) return falla(`La nota es demasiado larga (máximo ${MAX_NOTA} caracteres)`)
  const nota = notaCruda || null

  let que: string
  let duracion_min: number | null = null
  if (t === 'mandado') {
    if (!nota) return falla('Cuéntanos qué quieres que haga el compita')
    const d = b.duracion_min
    if (typeof d !== 'number' || !(DURACIONES_MANDADO_MIN as readonly number[]).includes(d)) return falla('Indica cuánto crees que tomaría: 15, 30 o 60 minutos')
    duracion_min = d
    que = 'Mandado'
  } else {
    if (typeof b.que !== 'string' || !(QUE_OPCIONES as readonly string[]).includes(b.que)) return falla('Elige qué necesita tu familiar')
    que = b.que
  }

  if (typeof b.lugar_privado !== 'boolean') return falla('Indica si el lugar es privado')
  const lugar_privado = b.lugar_privado

  // Requisito de SEGURIDAD: con lugar privado el compita entra, así que el cliente DEBE decir quién más estará
  // (o confirmar expresamente que nadie). Sin eso no se crea la solicitud.
  let personas_en_lugar: string[] | null = null
  if (lugar_privado) {
    const personas = b.personas_en_lugar
    const nadie = b.nadie_mas === true
    if (personas !== undefined && !Array.isArray(personas)) return falla('Indica quién más estará en el lugar')
    const lista = (personas ?? []) as unknown[]
    if (nadie) {
      if (lista.length > 0) return falla('Si no estará nadie más, la lista de personas debe ir vacía')
      personas_en_lugar = []
    } else {
      if (lista.length === 0) return falla('Es obligatorio indicar quién más estará en el lugar, o elegir "Nadie más". Es por la seguridad del compita.')
      if (lista.length > MAX_PERSONAS) return falla(`Máximo ${MAX_PERSONAS} personas`)
      if (!lista.every((p) => typeof p === 'string' && (TIPOS_PERSONA as readonly string[]).includes(p))) return falla('Tipo de persona inválido')
      personas_en_lugar = lista as string[]
    }
  } else if (Array.isArray(b.personas_en_lugar) && b.personas_en_lugar.length > 0) {
    return falla('Solo se indica quién más estará cuando el lugar es privado')
  }

  return { ok: true, valor: { tipo: t, que, nota, lugar_privado, personas_en_lugar, duracion_min } }
}

/** Texto que se guarda en `solicitudes.mensaje` (columna obligatoria que ya leen las plantillas actuales). */
export function mensajeDeSolicitud(s: SolicitudNueva, notaCensurada: string | null): string {
  const cabecera = s.tipo === 'mandado' ? `Mandado de ${s.duracion_min} minutos` : s.que
  return notaCensurada ? `${cabecera}. ${notaCensurada}` : cabecera
}
