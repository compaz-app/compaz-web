// Regla de «una sola pestaña del portal» (pura, sin navegador): cuando el cliente abre el portal en una pestaña nueva (por ejemplo desde el botón de un correo)
// y ya lo tiene abierto en otra, la pestaña vieja avisa y la nueva se queda quieta en vez de duplicar el portal. Un navegador no deja que una página
// pase otra pestaña al frente, así que esto es lo más cerca posible de «llevarlo a la que ya tiene abierta».

export const CANAL_PESTANA = 'compaz-portal-pestana'
/** Cuánto espera una pestaña nueva a que otra le diga «ya estoy abierta». */
export const ESPERA_RESPUESTA_MS = 400

export type MensajePestana = { t: 'hola' | 'ocupada' | 'tomar'; id: string }

/** ¿Debo responder «ocupada» a quien acaba de abrirse? Sí si ya soy la pestaña vigente; y si aún estoy esperando (abrimos casi a la vez), gana el id menor. */
export const debeResponder = (yo: { id: string; vigente: boolean; esperando: boolean }, hola: { id: string }): boolean =>
  yo.vigente || (yo.esperando && yo.id < hola.id)
