import Link from 'next/link'
import InfoBoton from '@/components/ui/InfoBoton'

// Botón base del sistema. Toda acción lleva su ⓘ (prop `info`, obligatoria); solo la navegación pura (`navegacion`) puede ir sin él.
// Usa los tokens de lib/design.ts a través de Tailwind (bg-naranja, text-morado-medio...). No escribir colores a mano.

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma'
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-naranja text-blanco hover:bg-naranja-hover disabled:opacity-40',
  secundario: 'border-2 border-morado-medio bg-blanco text-morado-medio hover:bg-fondo-lavanda disabled:opacity-40',
  peligro: 'border-2 border-rojo-oscuro bg-blanco text-rojo-oscuro hover:bg-rojo-claro disabled:opacity-40',
  fantasma: 'text-morado-claro hover:bg-fondo-claro disabled:opacity-40',
}
const BASE = 'inline-flex w-full min-h-14 items-center justify-center rounded-2xl px-5 text-lg font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-morado-medio'

type Comun = { variante?: Variante; children: React.ReactNode; className?: string }
type ConAccion = Comun & { info: string; navegacion?: false; /** Nombre corto para lectores de pantalla (por defecto, el texto del botón si es texto). */ queHace?: string }
type SoloNavegacion = Comun & { navegacion: true; info?: string; queHace?: string }

export type BotonProps = (ConAccion | SoloNavegacion) & (
  | ({ href: string } & Record<never, never>)
  | ({ href?: undefined; type?: 'button' | 'submit'; onClick?: () => void; disabled?: boolean; cargando?: boolean })
)

export default function Boton(p: BotonProps) {
  const variante = p.variante ?? 'primario'
  const clases = `${BASE} ${VARIANTES[variante]} ${p.className ?? ''}`
  const nombre = p.queHace ?? (typeof p.children === 'string' ? p.children : 'este botón')
  const elemento = 'href' in p && p.href !== undefined
    ? <Link href={p.href} className={clases}>{p.children}</Link>
    : (
      <button type={p.type ?? 'button'} onClick={p.onClick} disabled={p.disabled || p.cargando} aria-busy={p.cargando || undefined} className={clases}>
        {p.cargando ? 'Un momento…' : p.children}
      </button>
    )
  if (!p.info) return elemento
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">{elemento}</div>
      <InfoBoton que={nombre} texto={p.info} />
    </div>
  )
}
