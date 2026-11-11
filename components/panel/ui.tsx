import Link from 'next/link'
import InfoBoton from '@/components/ui/InfoBoton'
import Boton from '@/components/ui/base/Boton'

// LAS PIEZAS ÚNICAS del panel del equipo. Todas las pantallas se arman con estas: encabezado, filtros, lista, paginador, etiqueta de rol y
// encabezado de los paneles laterales. Así el panel tiene UN solo formato (decidido 2026-11-11). Una prueba (tests/76) impide volver a copiar estos
// estilos en otro archivo: si algo debe verse distinto, se cambia aquí y cambia en todas las pantallas a la vez.

/** El contenedor de toda lista del panel. */
export const CLASE_LISTA = 'divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-blanco'

/** Título de la pantalla, con una línea corta de para qué sirve y, detrás de un ⓘ, la explicación completa. */
export function Encabezado({ titulo, descripcion, info, infoQue, pista }: { titulo: React.ReactNode; descripcion?: string; info?: string; infoQue?: string; /** Una línea chica extra (por ejemplo "Toca una fila para ver el detalle"). */ pista?: string }) {
  return (
    <div>
      <h1 className="text-xl font-extrabold text-texto-oscuro">{titulo}</h1>
      {descripcion && <p className="flex items-center gap-1 text-sm text-texto-medio">{descripcion}{info && <InfoBoton que={infoQue ?? 'Para qué sirve esta pantalla'} texto={info} />}</p>}
      {pista && <p className="text-xs text-texto-sutil">{pista}</p>}
    </div>
  )
}

/** Las clases de un filtro en forma de pastilla (activo o no). */
export const clasesChip = (activo: boolean, extra = '') => `flex min-h-9 items-center rounded-full px-3 text-sm font-bold ${activo ? 'bg-morado-medio text-blanco' : 'border border-borde bg-blanco text-texto-oscuro'} ${extra}`.trim()

/** Fila de filtros: un solo ⓘ al inicio que explica todos, y las pastillas. */
export function Filtros({ info, infoQue = 'Qué significa cada filtro', children }: { info?: string; infoQue?: string; children: React.ReactNode }) {
  return <div role="group" className="flex flex-wrap items-center gap-1.5">{info && <InfoBoton que={infoQue} texto={info} />}{children}</div>
}
export function ChipLink({ href, activo, children, extra }: { href: string; activo: boolean; children: React.ReactNode; extra?: string }) {
  return <Link href={href} aria-pressed={activo} className={clasesChip(activo, extra)}>{children}</Link>
}
export function ChipBoton({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={activo} onClick={onClick} className={clasesChip(activo)}>{children}</button>
}
/** El número de una pastilla ("Todos 4"). */
export const Conteo = ({ n }: { n: number }) => <span className="ml-1 opacity-70">{n}</span>

const BOTON_PAG = 'flex min-h-9 items-center rounded-lg border border-borde bg-blanco px-3 text-sm font-bold'
/** Paginador de las listas. `hrefAnterior` / `hrefSiguiente` en null = apagado. */
export function Paginador({ resumen, pag, paginas, hrefAnterior, hrefSiguiente }: { resumen: string; pag: number; paginas: number; hrefAnterior: string | null; hrefSiguiente: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-texto-medio">{resumen}</span>
      <div className="flex items-center gap-2">
        {hrefAnterior ? <Link href={hrefAnterior} className={BOTON_PAG}>‹ Anterior</Link> : <span className={`${BOTON_PAG} opacity-40`}>‹ Anterior</span>}
        <span className="px-1 font-bold">{pag} / {paginas}</span>
        {hrefSiguiente ? <Link href={hrefSiguiente} className={BOTON_PAG}>Siguiente ›</Link> : <span className={`${BOTON_PAG} opacity-40`}>Siguiente ›</span>}
      </div>
    </div>
  )
}

/** La etiqueta chica y neutra de rol o tipo (Cliente, Compita, Pago...). Sin colores: el color se reserva para la urgencia. */
export const Rol = ({ children }: { children: React.ReactNode }) => <span className="rounded bg-gris100 px-1.5 text-[11px] font-bold text-texto-medio">{children}</span>
/** La flecha que dice "toca para abrir". */
export const Flecha = () => <span aria-hidden className="text-lg text-texto-sutil">›</span>

/** El encabezado de TODO panel lateral (ficha, caso, visita, chat): etiqueta, título, detalle y Cerrar. */
export function EncabezadoLateral({ etiqueta, titulo, detalle, cerrarHref }: { etiqueta: string; titulo: React.ReactNode; detalle?: string; cerrarHref: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="rounded bg-fondo-lavanda px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-morado-claro">{etiqueta}</span>
        <h2 className="mt-1 text-xl font-extrabold leading-tight [overflow-wrap:anywhere]">{titulo}</h2>
        {detalle && <p className="text-sm text-texto-medio">{detalle}</p>}
      </div>
      <Boton tamano="compacto" variante="secundario" navegacion href={cerrarHref}>Cerrar</Boton>
    </div>
  )
}
/** El título de cada bloque dentro de un panel lateral. */
export const TituloBloque = ({ children }: { children: React.ReactNode }) => <h3 className="text-xs font-extrabold uppercase tracking-wider text-texto-sutil">{children}</h3>

/** El título de cada sección dentro de una pantalla (por ejemplo "Procesos automáticos"). */
export const TituloSeccion = ({ children }: { children: React.ReactNode }) => <h2 className="text-sm font-extrabold text-texto-medio">{children}</h2>
