// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Design tokens centralizados
// Fuente única de verdad para colores, tipografía y espaciado.
// ══════════════════════════════════════════════════════════════════════════════

export const colors = {
  // Brand primario
  moradoProfundo: '#1A0A3C',
  moradoMedio: '#2D1464',
  moradoClaro: '#4A3B6B',
  moradoSutil: '#6B5C90',

  // Acento naranja
  naranja: '#FF6B2B',
  naranjaHover: '#E55A1F',

  // Fondos
  fondoCrudo: '#FDFAF6',
  fondoClaro: '#F5F0E8',
  fondoCard: '#E8E0D4',

  // Texto
  textoOscuro: '#1A0A3C',
  textoMedio: '#4A3B6B',
  textoSutil: '#6B5C90',

  // Estados
  verde: '#16A34A',
  verdeClaro: '#DCFCE7',
  rojo: '#DC2626',
  rojoClaro: '#FEE2E2',
  amarillo: '#D97706',
  amarilloClaro: '#FEF3C7',

  // Neutros
  blanco: '#FFFFFF',
  negro: '#000000',
  gris100: '#F3F4F6',
  gris200: '#E5E7EB',
  gris400: '#9CA3AF',
  gris600: '#4B5563',
} as const

export const fonts = {
  base: 'Inter, system-ui, sans-serif',
  mono: 'JetBrains Mono, Fira Code, monospace',
} as const

export const radius = {
  sm: '6px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  pill: '9999px',
} as const

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  xxxl: '64px',
} as const

export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  leaflet: 1000,
  modal: 2000,
  toast: 3000,
} as const

// Sombras reutilizables
export const shadows = {
  card: '0 2px 8px rgba(26, 10, 60, 0.08)',
  modal: '0 20px 60px rgba(26, 10, 60, 0.3)',
  btn: '0 4px 12px rgba(255, 107, 43, 0.3)',
} as const
