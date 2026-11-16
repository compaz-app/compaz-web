// Reglas puras de la dirección de una visita (sin base de datos): las usan el servidor, la pantalla del cliente y Telegram.

/** La cita no se puede pedir ni confirmar sin dirección y contacto en el sitio: el compita no puede llegar a un lugar que nadie dijo cuál es. */
export const faltaDireccion = (v: { direccion?: string | null; contacto_nombre?: string | null; contacto_tel?: string | null }) => !v.direccion || !v.contacto_nombre || !v.contacto_tel
export const MENSAJE_FALTA_DIRECCION = 'Primero registra la dirección y el contacto en el sitio. Sin eso no se puede agendar la visita.'
