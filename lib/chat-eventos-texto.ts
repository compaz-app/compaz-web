// Los avisos de estado dentro del chat de la visita («Visita agendada: …», «Visita iniciada»). Parte PURA (la usa también el navegador): cómo se reconoce uno y cómo se lee.
// Se guardan como un mensaje más (origen «admin», que el chat nunca muestra como conversación) con este prefijo en el texto, así no hace falta cambiar la base de datos.
export const PREFIJO_EVENTO_CHAT = 'evento::'

export const esEventoChat = (contenido: string | null | undefined): boolean => (contenido ?? '').startsWith(PREFIJO_EVENTO_CHAT)
export const textoEventoChat = (contenido: string | null | undefined): string => (contenido ?? '').slice(PREFIJO_EVENTO_CHAT.length).trim()
