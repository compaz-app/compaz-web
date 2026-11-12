// Silueta de persona (sin emojis) para los círculos de foto cuando todavía no hay foto. Toma el color del texto y el tamaño del círculo que la contiene.
import { colors } from '@/lib/design'

export default function IconoPersona() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: colors.textoSutil }}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6" />
    </svg>
  )
}
