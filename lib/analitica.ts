// Dónde se mide (decidido 2026-11-17, antes de conectar la lectura real del CMC).
// Clarity, Google Analytics y Meta Pixel se cargan SOLO en las páginas públicas de captación. Todas las demás rutas
// (panel, portales, sala, pago, login, fichas con token, rutas futuras) quedan fuera por defecto: una página nueva
// no se mide hasta que alguien la agrega aquí a propósito. Así ningún nombre, correo o teléfono de aspirantes,
// Compitas, clientes o familiares llega a terceros por una grabación, una dirección o un evento.
// Las campañas (UTM) y las conversiones (form_submit, Lead) viven en estas páginas y no cambian.

/** Páginas públicas que se miden. Agregar una aquí es una decisión: revisa antes que no muestre datos personales. */
export const RUTAS_CON_ANALITICA = ['/', '/se-compita', '/privacidad'] as const

/** ¿Se puede medir esta ruta? Ignora la barra final; cualquier subruta o ruta desconocida cuenta como privada. */
export function rutaConAnalitica(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return (RUTAS_CON_ANALITICA as readonly string[]).includes(p)
}

export const CLARITY_ID = 'y62sqpjuto'
