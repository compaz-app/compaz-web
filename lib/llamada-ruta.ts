// Enlace de una llamada. Las personas NO reciben el enlace de Daily: reciben /llamada/<sala>, una página de Compaz que incrusta la sala y puede
// mostrar el aviso de fin (Daily aloja su propia página y desde fuera no se puede escribir dentro de ella). Sin código de servidor: lo usan también
// las pantallas del cliente.

/** El nombre de la sala sale de la última parte de su enlace de Daily. */
export function nombreDeSala(roomUrl: string): string {
  return roomUrl.split('?')[0].replace(/\/+$/, '').split('/').pop() ?? ''
}

/** Solo nombres que Compaz crea ("ent-…" entrevista, "cmp-…" visita): evita usar la página con salas ajenas. */
export const nombreDeSalaValido = (n: string) => /^(ent|cmp)-[A-Za-z0-9-]{4,80}$/.test(n)

/** Ruta relativa de la página de llamada para una sala. */
export const rutaLlamada = (roomUrl: string) => `/llamada/${encodeURIComponent(nombreDeSala(roomUrl))}`
