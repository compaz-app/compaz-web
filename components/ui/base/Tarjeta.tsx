// Tarjeta base: contenedor con borde y esquinas redondeadas. `tono` cambia el borde según la importancia.
const TONOS = { neutro: 'border border-borde', destacada: 'border-2 border-naranja', alerta: 'border-2 border-rojo' } as const

export default function Tarjeta({ tono = 'neutro', children, className = '' }: { tono?: keyof typeof TONOS; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-blanco p-5 ${TONOS[tono]} ${className}`}>{children}</section>
}
