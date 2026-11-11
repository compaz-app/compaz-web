import Link from 'next/link'
import { PESTANAS, type PestanaPortal } from '@/lib/portal-secciones'

// El menú del portal: arriba como pestañas en escritorio y abajo como barra en el teléfono (la barra inferior es un patrón de móvil).
// La pestaña vive en la dirección (?sec=) y la vista previa del equipo (?preview=) se conserva al cambiar de pestaña.
export default function NavPortal({ actual, preview }: { actual: PestanaPortal; preview?: string | null }) {
  const href = (id: PestanaPortal) => `/portal?${new URLSearchParams({ ...(id === 'inicio' ? {} : { sec: id }), ...(preview ? { preview } : {}) }).toString()}`.replace(/\?$/, '')
  const item = (id: PestanaPortal, icono: string, texto: string, clases: string) => (
    <Link key={id} href={href(id)} aria-current={actual === id ? 'page' : undefined} className={`${clases} ${actual === id ? 'font-extrabold' : 'font-bold'}`}><span aria-hidden className="text-2xl lg:text-base">{icono}</span><span>{texto}</span></Link>
  )
  return (
    <>
      <nav aria-label="Secciones del portal" className="hidden gap-1 rounded-2xl border border-borde bg-blanco p-1 lg:flex">
        {PESTANAS.map((p) => item(p.id, p.icono, p.texto, `flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl text-base ${actual === p.id ? 'bg-morado-medio text-blanco' : 'text-morado-claro hover:bg-fondo-claro'}`))}
      </nav>
      <nav aria-label="Secciones del portal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-borde bg-blanco lg:hidden">
        {PESTANAS.map((p) => item(p.id, p.icono, p.texto, `flex min-h-16 flex-col items-center justify-center text-xs ${actual === p.id ? 'text-naranja-oscuro' : 'text-morado-claro'}`))}
      </nav>
    </>
  )
}
