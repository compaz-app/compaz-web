// Líneas de servicio que vienen después de la compañía (decidido 2026-11-12). Todavía NO están activas: se muestran como "Próximamente" en los lugares donde
// vivirán, para dar a conocer el plan y mostrar las posibilidades. UN solo catálogo: la página principal, el portal, el registro del compita y el panel leen
// de aquí, así el texto nunca se contradice. Para activar una línea, se construye su flujo y recién entonces se quita de esta lista.
//
// Decisiones de producto:
//  - Voluntariado: Compaz es el PUENTE. Pone la plataforma para que la gente se conecte; no paga ni cobra nada. Los voluntarios son compitas que lo deciden.
//  - Dona horas: al pagar un servicio, el cliente podrá regalar horas de voluntariado a quien las necesita.
//  - Mascotas: servicio de pago. El compita marca su interés en el perfil; las preguntas para comprobar que es apto se agregan cuando la línea se active.
//  - Mismas ciudades que hoy.

export type IdServicioProximo = 'voluntariado' | 'mascotas' | 'donar_horas'

export interface ServicioProximo {
  id: IdServicioProximo
  /** Nombre del icono (se dibuja en components/ui/Proximamente.tsx; sin emojis). */
  icono: 'corazon' | 'huella' | 'regalo'
  titulo: string
  /** Una línea, para tarjetas pequeñas. */
  corto: string
  /** Lo que significa, en dos o tres frases. */
  descripcion: string
  /** Lo que significa para quien ofrece el servicio (el compita). Solo si aplica. */
  paraCompitas?: string
}

export const SERVICIOS_PROXIMOS: readonly ServicioProximo[] = [
  {
    id: 'voluntariado', icono: 'corazon', titulo: 'Voluntariado', corto: 'Acompañar a quien lo necesita, sin costo.',
    descripcion: 'Una persona que necesita compañía para hacer una cola, ir a una cita o acompañar una sesión de quimioterapia se conecta con compitas que quieren ofrecer su tiempo como voluntarios. Compaz pone la plataforma para que se encuentren; no cobra ni paga nada.',
    paraCompitas: 'Acompañar sin costo a quien lo necesita.',
  },
  {
    id: 'mascotas', icono: 'huella', titulo: 'Cuidado de mascotas', corto: 'Paseos y cuidado de animales cuando no puedes.',
    descripcion: 'Cuando no puedes pasear a tu perro o ocuparte de tu mascota, un compita verificado va y te ayuda: paseos, cuidado en casa o acompañar al veterinario, con reporte y fotos de cada servicio.',
    paraCompitas: 'Paseos y cuidado de animales cuando sus dueños no pueden.',
  },
  {
    id: 'donar_horas', icono: 'regalo', titulo: 'Dona horas', corto: 'Regala horas de voluntariado al pagar un servicio.',
    descripcion: 'Al pagar un servicio podrás donar una o más horas para que un voluntario acompañe a alguien que no puede pagarlo. Tu compra también ayuda a otra familia.',
  },
] as const

/** Líneas que un compita puede marcar como interés (las que tienen texto para él). */
export const INTERESES_COMPITA: readonly IdServicioProximo[] = ['voluntariado', 'mascotas']

export const ETIQUETA_PROXIMAMENTE = 'Próximamente'
export const INFO_PROXIMAMENTE = 'Son líneas de servicio que Compaz tiene planeadas y todavía no están activas. Se muestran aquí para que se vea hacia dónde crece la plataforma; no se pueden usar todavía.'
