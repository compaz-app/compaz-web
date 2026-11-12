import Link from 'next/link'
import { hrefSeccion, seccionesVisibles, type ActorVista, type SeccionPanel } from '@/lib/panel-secciones'

// Marco del panel nuevo: menú lateral en escritorio, barra inferior en el teléfono (patrón de móvil, igual que el portal).
// El administrador además elige "ver el panel como" administrador o colaborador; eso solo cambia la pantalla, no el poder real.
export default function MarcoPanel({ actor, actual, comoColaborador, puedeElegirVista, correo, children }: {
  actor: ActorVista; actual: SeccionPanel; comoColaborador: boolean; puedeElegirVista: boolean; correo: string; children: React.ReactNode
}) {
  const secciones = seccionesVisibles(actor)
  const lateral = (s: (typeof secciones)[number]) => (
    <Link key={s.id} href={hrefSeccion(s.id, comoColaborador)} aria-current={actual === s.id ? 'page' : undefined}
      className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base ${actual === s.id ? 'bg-morado-medio font-extrabold text-blanco' : 'font-bold text-morado-claro hover:bg-fondo-claro'}`}>
      <span>{s.texto}</span>
    </Link>
  )
  const inferior = (s: (typeof secciones)[number]) => (
    <Link key={s.id} href={hrefSeccion(s.id, comoColaborador)} aria-current={actual === s.id ? 'page' : undefined}
      className={`flex min-h-16 flex-col items-center justify-center text-xs ${actual === s.id ? 'font-extrabold text-naranja-oscuro' : 'font-bold text-morado-claro'}`}>
      <span>{s.texto}</span>
    </Link>
  )
  const vista = (como: boolean, texto: string) => (
    <Link href={hrefSeccion(actual, como)} aria-pressed={comoColaborador === como}
      className={`flex min-h-10 flex-1 items-center justify-center rounded-lg px-2 text-sm ${comoColaborador === como ? 'bg-morado-medio font-extrabold text-blanco' : 'font-bold text-morado-claro hover:bg-fondo-claro'}`}>{texto}</Link>
  )
  return (
    <div className="min-h-dvh bg-fondo-claro lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-borde bg-blanco p-3 lg:flex">
        <div className="px-3 pb-3 pt-2"><span className="text-lg font-extrabold text-morado-medio">Compaz</span> <span className="text-sm font-bold text-texto-medio">Panel</span></div>
        <nav aria-label="Secciones del panel" className="flex flex-col gap-1">{secciones.map(lateral)}</nav>
        <div className="mt-auto space-y-2 px-1 pt-4">
          {puedeElegirVista && (
            <div>
              <p className="px-2 pb-1 text-xs font-bold text-texto-medio">Ver el panel como</p>
              <div className="flex gap-1 rounded-xl border border-borde p-1">{vista(false, 'Admin')}{vista(true, 'Colaborador')}</div>
            </div>
          )}
          <p className="truncate px-2 text-xs text-texto-sutil" title={correo}>{correo}</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-2 border-b border-borde bg-blanco px-4 py-2 lg:hidden">
          <span className="text-lg font-extrabold text-morado-medio">Compaz <span className="text-sm text-texto-medio">Panel</span></span>
          {puedeElegirVista && <div className="flex w-48 gap-1 rounded-xl border border-borde p-1">{vista(false, 'Admin')}{vista(true, 'Colab.')}</div>}
        </header>
        <main className="@container mx-auto max-w-5xl px-4 pb-24 pt-5 lg:pb-10">{children}</main>
      </div>
      <nav aria-label="Secciones del panel" style={{ gridTemplateColumns: `repeat(${secciones.length}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-30 grid border-t border-borde bg-blanco lg:hidden">{secciones.map(inferior)}</nav>
    </div>
  )
}
