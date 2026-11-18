import type { Viewport } from 'next'

// Solo el portal del cliente: usa toda la pantalla del teléfono (hasta debajo de la barra de inicio, y el menú de abajo se apoya en `env(safe-area-inset-bottom)`)
// y, en Chrome de Android, achica la página cuando sube el teclado en lugar de taparla.
export const viewport: Viewport = { viewportFit: 'cover', interactiveWidget: 'resizes-content' }

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children
}
