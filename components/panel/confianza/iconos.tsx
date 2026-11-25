// Iconos de línea del CMC (SVG, sin emojis: regla 6d). Trazo fino y color heredado (currentColor), como en la referencia aprobada.
type Nombre = 'personas' | 'reloj' | 'check' | 'alerta' | 'info' | 'lupa' | 'chevron'

export default function IconoCmc({ nombre, className = 'h-5 w-5' }: { nombre: Nombre; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {nombre === 'personas' && (<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="16.5" cy="9" r="2.6" /><path d="M15.8 14.1c2.4.1 4.2 1.7 4.7 4.4" /></>)}
      {nombre === 'reloj' && (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>)}
      {nombre === 'check' && (<><circle cx="12" cy="12" r="8.5" /><path d="m8.3 12.3 2.5 2.5 5-5.2" /></>)}
      {nombre === 'alerta' && (<><path d="M10.4 4.6 3.3 17.2A1.8 1.8 0 0 0 4.9 20h14.2a1.8 1.8 0 0 0 1.6-2.8L13.6 4.6a1.8 1.8 0 0 0-3.2 0Z" /><path d="M12 9.5v4" /><path d="M12 16.6h.01" /></>)}
      {nombre === 'info' && (<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><path d="M12 8h.01" /></>)}
      {nombre === 'lupa' && (<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>)}
      {nombre === 'chevron' && <path d="m9.5 6 6 6-6 6" />}
    </svg>
  )
}
