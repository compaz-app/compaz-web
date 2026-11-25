// Dónde se permite medir a los visitantes (Google Analytics, Microsoft Clarity, píxel de Meta). SOLO en las páginas públicas de presentación. Nunca en el portal, el panel,
// los enlaces con token (sala, reagendar, onboarding, pago, perfil del compita) ni el login: ahí se ven datos de la familia y de su salud (Clarity graba la pantalla) y los
// scripts de terceros solo hacen más lenta la página. Lista de lo permitido (no de lo prohibido): una pantalla nueva queda SIN medición hasta que alguien la agregue aquí.
export const RUTAS_CON_ANALITICA: readonly string[] = ['/', '/privacidad', '/se-compita']

export function esRutaConAnalitica(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const limpia = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  return RUTAS_CON_ANALITICA.includes(limpia)
}
