import Link from 'next/link'
import Boton from '@/components/ui/base/Boton'
import InfoBoton from '@/components/ui/InfoBoton'
import { CLASE_LISTA, ChipLink, Conteo, Filtros, Flecha, Paginador, Rol } from '@/components/panel/ui'
import {
  COLUMNAS_COMPITA, LEYENDA_COMPITA, POR_PAGINA_PERSONAS, VISTAS_COMPITA, puntoCompita,
  type FilaCliente, type FilaCompita, type Urgencia,
} from '@/lib/panel-personas-tipos'

// Personas (servidor, sin JavaScript en el navegador): cada filtro, orden y página es un enlace, así el estado vive en la dirección
// y se restaura solo al refrescar. La ficha se abre con ?persona=<tipo>:<id>.
const PUNTO: Record<Urgencia | 'neutro', { clase: string; texto: string }> = {
  verde: { clase: 'bg-verde-vivo', texto: 'Al día' }, amarillo: { clase: 'bg-amarillo', texto: 'Atención' }, rojo: { clase: 'bg-rojo', texto: 'Revisar' },
  neutro: { clase: 'bg-gris400', texto: 'Sin evaluar (nuevo o en pausa)' },
}
/** El color de urgencia como un punto pequeño (antes era un círculo con la inicial, que no decía nada más y ocupaba espacio). */
export function PuntoUrgencia({ u, texto }: { u: Urgencia | 'neutro'; /** Nombre del color en esta pantalla, si es distinto al general. */ texto?: string }) {
  const t = texto ?? PUNTO[u].texto
  return <span role="img" aria-label={t} title={t} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${PUNTO[u].clase}`} />
}
type Enlace = (cambios: Record<string, string | null>) => string

type Estados = { estado: string; n: number }[]
/** Selección de filas (solo el administrador, para eliminar en lote). Si no se da, las tablas son como siempre. */
export interface Seleccion { marcadas: ReadonlySet<string>; alternar: (id: string) => void; paginaCompleta: boolean; alternarPagina: () => void }
const Casilla = ({ marcada, alCambiar, etiqueta }: { marcada: boolean; alCambiar: () => void; etiqueta: string }) => (
  <input type="checkbox" checked={marcada} onChange={alCambiar} aria-label={etiqueta} className="h-4 w-4 cursor-pointer accent-morado-medio" />
)
export interface DatosCompitas { fila: FilaCompita[]; total: number; paginas: number; pag: number; conteos: Record<string, number>; vista: string; orden: string; dir: string; q: string; enTotal: number; estados: Estados; estado: string }
export interface DatosClientes { fila: FilaCliente[]; total: number; paginas: number; pag: number; q: string; enTotal: number; estados: Estados; estado: string }

/** Filtro por estado de Venezuela. Solo lista los estados donde hay gente en lo que ya se está viendo; no hace falta JavaScript (cada estado es un enlace). */
function FiltroEstado({ estados, estado, enlace }: { estados: Estados; estado: string; enlace: Enlace }) {
  if (estados.length === 0) return null
  const item = 'flex min-h-9 items-center justify-between gap-3 rounded-lg px-3 text-sm hover:bg-lavanda-sutil'
  return (
    <details className="relative">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-borde bg-blanco px-3 text-sm font-bold text-texto-oscuro [&::-webkit-details-marker]:hidden">
        <span className="font-normal text-texto-medio">Estado</span>{estado || 'Todos'}<span aria-hidden className="text-texto-sutil">▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-borde bg-blanco p-1 shadow-lg">
        <Link prefetch={false} href={enlace({ estado: null, pag: null })} className={`${item} ${!estado ? 'font-extrabold' : ''}`}>Todos</Link>
        {estados.map((e) => (
          <Link prefetch={false} key={e.estado} href={enlace({ estado: e.estado, pag: null })} aria-current={estado === e.estado ? 'true' : undefined} className={`${item} ${estado === e.estado ? 'bg-fondo-lavanda font-extrabold' : ''}`}>
            <span className="truncate">{e.estado}</span><span className="text-xs text-texto-sutil">{e.n}</span>
          </Link>
        ))}
      </div>
    </details>
  )
}

function Buscador({ q, lista, params, alBuscar }: { q: string; lista: string; params: Record<string, string>; /** Si se da, la búsqueda se resuelve en el navegador, letra por letra, sin pedirle nada al servidor. */ alBuscar?: (q: string) => void }) {
  if (alBuscar) {
    return (
      <form role="search" onSubmit={(e) => e.preventDefault()} className="flex items-center gap-2">
        <input name="q" defaultValue={q} onChange={(e) => alBuscar(e.target.value)} placeholder="Buscar por nombre o zona" aria-label="Buscar personas" autoComplete="off" className="min-h-10 w-full rounded-xl border border-borde bg-blanco px-3 text-sm sm:w-72" />
      </form>
    )
  }
  return (
    <form action="/panel" method="get" role="search" className="flex items-center gap-2">
      {Object.entries({ ...params, sec: 'personas', lista }).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input name="q" defaultValue={q} placeholder="Buscar por nombre o zona" aria-label="Buscar personas" className="min-h-10 w-full rounded-xl border border-borde bg-blanco px-3 text-sm sm:w-72" />
      <Boton tamano="compacto" variante="secundario" navegacion type="submit">Buscar</Boton>
    </form>
  )
}

function Paginas({ pag, paginas, total, enlace }: { pag: number; paginas: number; total: number; enlace: Enlace }) {
  return <Paginador resumen={total ? `${(pag - 1) * POR_PAGINA_PERSONAS + 1} a ${Math.min(pag * POR_PAGINA_PERSONAS, total)} de ${total}` : '0 resultados'} pag={pag} paginas={paginas} hrefAnterior={pag > 1 ? enlace({ pag: String(pag - 1) }) : null} hrefSiguiente={pag < paginas ? enlace({ pag: String(pag + 1) }) : null} />
}

export function Selector({ lista, enlace }: { lista: 'compitas' | 'clientes'; enlace: Enlace }) {
  const t = (id: 'compitas' | 'clientes', texto: string) => (
    <Link prefetch={false} href={enlace({ lista: id, pag: null, q: null, vista: null, orden: null, dir: null, estado: null, persona: null })} aria-current={lista === id ? 'page' : undefined}
      className={`flex min-h-9 items-center justify-center rounded-lg px-4 text-sm ${lista === id ? 'bg-morado-medio font-extrabold text-blanco' : 'font-bold text-morado-claro hover:bg-fondo-claro'}`}>{texto}</Link>
  )
  return <div className="flex w-fit gap-1 rounded-xl border border-borde bg-blanco p-1">{t('compitas', 'Compitas')}{t('clientes', 'Clientes')}</div>
}

export function TablaCompitas({ d, enlace, params, alBuscar, seleccion }: { d: DatosCompitas; enlace: Enlace; params: Record<string, string>; alBuscar?: (q: string) => void; seleccion?: Seleccion }) {
  const textoVistas = VISTAS_COMPITA.filter((v) => v.ayuda).map((v) => `${v.t}: ${v.ayuda}`).join(' ')
  const textoColumnas = COLUMNAS_COMPITA.filter((c) => c.ayuda).map((c) => `${c.t}: ${c.ayuda}`).join(' ')
  return (
    <section className="space-y-3">
      <h2 className="sr-only">Compitas</h2>
      <p className="text-sm text-texto-medio">{d.enTotal} {d.enTotal === 1 ? 'compita' : 'compitas'} en total. Por defecto, primero los que necesitan atención.</p>
      <Filtros info={textoVistas} infoQue="Qué significa cada vista">
        {VISTAS_COMPITA.map((v) => (
          <ChipLink key={v.id} href={enlace({ vista: v.id === 'todas' ? null : v.id, pag: null })} activo={d.vista === v.id}>{v.t}<Conteo n={d.conteos[v.id]} /></ChipLink>
        ))}
      </Filtros>
      <div className="flex flex-wrap items-center gap-2">
        <Buscador alBuscar={alBuscar} q={d.q} lista="compitas" params={{ ...params, ...(d.vista !== 'todas' ? { vista: d.vista } : {}), ...(d.estado ? { estado: d.estado } : {}) }} />
        <FiltroEstado estados={d.estados} estado={d.estado} enlace={enlace} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-medio">
        <span className="inline-flex items-center gap-1.5"><PuntoUrgencia u="verde" />Al día</span>
        <span className="inline-flex items-center gap-1.5"><PuntoUrgencia u="amarillo" />Atención</span>
        <span className="inline-flex items-center gap-1.5"><PuntoUrgencia u="rojo" />Revisar</span>
        <span className="inline-flex items-center gap-1.5"><PuntoUrgencia u="neutro" />Nuevo o en pausa</span>
        <InfoBoton que="Qué significan los colores" texto={LEYENDA_COMPITA} />
        <span className="ml-2 inline-flex items-center gap-1">Columnas <InfoBoton que="Qué significa cada columna" texto={textoColumnas} /></span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-borde bg-blanco">
        <table className="w-full text-left text-sm">
          <thead className="bg-fondo-claro text-xs text-texto-medio">
            <tr>
              {seleccion && <th scope="col" className="w-10 px-2.5"><Casilla marcada={seleccion.paginaCompleta} alCambiar={seleccion.alternarPagina} etiqueta="Marcar o quitar todas las de esta página" /></th>}
              {COLUMNAS_COMPITA.map((c) => (
                <th key={c.id} scope="col" title={c.ayuda} className={`whitespace-nowrap p-0 font-extrabold ${c.clase}`}>
                  <Link prefetch={false} href={enlace({ orden: c.id, dir: d.orden === c.id && d.dir === 'asc' ? 'desc' : 'asc', pag: null })} className="flex min-h-9 items-center px-2.5">
                    {c.t}{d.orden === c.id ? (d.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {d.fila.map((p) => (
              <tr key={p.id} className={seleccion?.marcadas.has(p.id) ? 'bg-lavanda-sutil' : 'hover:bg-lavanda-sutil'}>
                {seleccion && <td className="w-10 px-2.5"><Casilla marcada={seleccion.marcadas.has(p.id)} alCambiar={() => seleccion.alternar(p.id)} etiqueta={`Marcar a ${p.nombre}`} /></td>}
                <td className="w-full min-w-44 max-w-0 px-2.5 py-2">
                  <Link prefetch={false} href={enlace({ persona: `compita:${p.id}` })} className="flex items-center gap-2.5" title={p.nombre}>
                    <PuntoUrgencia u={puntoCompita(p)} />
                    <span className="min-w-0"><span className="block truncate font-bold">{p.nombre}</span>
                      <span className="block truncate text-xs text-texto-medio @2xl:hidden">{p.zona} · {p.estado}{p.tardias > 0 && <b className="text-ambar-oscuro"> · {p.tardias} cancelación{p.tardias > 1 ? 'es' : ''} tardía{p.tardias > 1 ? 's' : ''}</b>}</span></span>
                  </Link>
                </td>
                <td className="hidden whitespace-nowrap px-2.5 @2xl:table-cell"><span className="block max-w-56 truncate" title={p.zona}>{p.zona}</span></td>
                <td className="hidden whitespace-nowrap px-2.5 @lg:table-cell">{p.estado}</td>
                <td className="hidden whitespace-nowrap px-2.5 @4xl:table-cell">{p.activos}</td>
                <td className="hidden whitespace-nowrap px-2.5 @4xl:table-cell">{p.visitas}</td>
                <td className="whitespace-nowrap px-2.5">{p.rating ? p.rating.toFixed(1) : '·'}</td>
                <td className="hidden whitespace-nowrap px-2.5 @lg:table-cell">{p.respuesta === null ? '·' : `${p.respuesta}%`}</td>
                <td className="hidden whitespace-nowrap px-2.5 @2xl:table-cell">{p.canc === 0 ? <span className="text-texto-sutil">·</span> : <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.tardias >= 3 ? 'bg-rojo text-blanco' : p.tardias >= 2 ? 'bg-amarillo text-morado-profundo' : 'bg-gris100 text-texto-medio'}`}>{p.canc}{p.tardias > 0 ? ` (${p.tardias} tardía${p.tardias > 1 ? 's' : ''})` : ''}</span>}</td>
                <td className="hidden whitespace-nowrap px-2.5 @4xl:table-cell">{p.inactivoH === null ? '·' : p.inactivoH < 1 ? 'ahora' : `${p.inactivoH} h`}</td>
              </tr>
            ))}
            {!d.fila.length && <tr><td colSpan={COLUMNAS_COMPITA.length + (seleccion ? 1 : 0)} className="p-6 text-center text-texto-sutil">Sin resultados</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginas pag={d.pag} paginas={d.paginas} total={d.total} enlace={enlace} />
    </section>
  )
}

export function TablaClientes({ d, enlace, params, alBuscar, seleccion }: { d: DatosClientes; enlace: Enlace; params: Record<string, string>; alBuscar?: (q: string) => void; seleccion?: Seleccion }) {
  const alta = (iso: string) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  return (
    <section className="max-w-3xl space-y-3">
      <h2 className="sr-only">Clientes</h2>
      <p className="text-sm text-texto-medio">{d.enTotal} {d.enTotal === 1 ? 'cliente' : 'clientes'} en total. Toca uno para ver su ficha y en qué paso está.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Buscador alBuscar={alBuscar} q={d.q} lista="clientes" params={{ ...params, ...(d.estado ? { estado: d.estado } : {}) }} />
        <FiltroEstado estados={d.estados} estado={d.estado} enlace={enlace} />
      </div>
      <ul className={CLASE_LISTA}>
        {d.fila.map((c) => (
          <li key={c.id} className={`flex items-stretch ${seleccion?.marcadas.has(c.id) ? 'bg-lavanda-sutil' : ''}`}>
            {seleccion && <span className="flex w-10 shrink-0 items-center justify-center"><Casilla marcada={seleccion.marcadas.has(c.id)} alCambiar={() => seleccion.alternar(c.id)} etiqueta={`Marcar a ${c.nombre || 'sin nombre'}`} /></span>}
            <Link prefetch={false} href={enlace({ persona: `cliente:${c.id}` })} className="flex min-h-12 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 hover:bg-lavanda-sutil">
              <span className="min-w-40 flex-1"><span className="block truncate text-sm font-bold">{c.nombre || 'Sin nombre'}</span><span className="block truncate text-xs text-texto-medio">{c.zona || 'Sin zona'}{c.compita ? ` · con ${c.compita}` : ' · sin compita todavía'}</span></span>
              {c.bloqueado && <span className="rounded bg-rojo-claro px-1.5 text-[11px] font-extrabold text-rojo-oscuro">Bloqueado</span>}
              {c.plan && <Rol>{c.plan}</Rol>}
              <span className="text-xs text-texto-sutil">Desde {alta(c.alta)}</span>
              <Flecha />
            </Link>
          </li>
        ))}
        {!d.fila.length && <li className="p-6 text-center text-texto-sutil">Sin resultados</li>}
      </ul>
      <Paginas pag={d.pag} paginas={d.paginas} total={d.total} enlace={enlace} />
    </section>
  )
}
