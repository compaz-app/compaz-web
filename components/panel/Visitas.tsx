import Link from 'next/link'
import { CLASE_LISTA, ChipLink, Conteo, Encabezado, Filtros, Flecha, Paginador } from '@/components/panel/ui'
import { DESCRIPCION_VISITAS, INFO_VISITAS, POR_PAGINA_VISITAS, VISTAS_VISITA, etiquetaVisita, type EstadoVisita, type FilaVisita } from '@/lib/panel-visitas-tipos'

type Enlace = (cambios: Record<string, string | null>) => string
export interface DatosVisitas { fila: FilaVisita[]; conteos: Record<string, number>; vista: string; total: number; paginas: number; pag: number; ahora: number }

const CHIP: Record<EstadoVisita, string> = {
  'Por coordinar': 'bg-amarillo-claro text-ambar-oscuro', Programada: 'bg-gris100 text-texto-medio', 'En curso': 'bg-verde-vivo text-blanco',
  Terminada: 'bg-gris100 text-texto-medio', 'No se presentó': 'bg-rojo text-blanco', 'Sin acceso': 'bg-amarillo text-morado-profundo',
}

// Visitas (servidor): cada vista y página es un enlace. La fila abre el detalle de la visita; el botón de chat solo aparece con el permiso de chats.
export default function Visitas({ d, enlace, puedeChats }: { d: DatosVisitas; enlace: Enlace; puedeChats: boolean }) {
  return (
    <section className="max-w-3xl space-y-3">
      <Encabezado titulo="Visitas" descripcion={DESCRIPCION_VISITAS} info={INFO_VISITAS} infoQue="Para qué sirve Visitas" pista="Toca una fila para ver el detalle de la visita y qué hacer." />
      <Filtros info={`Elige qué visitas ver. El número es cuántas hay. No cambia nada. ${VISTAS_VISITA.filter((v) => v.ayuda).map((v) => `${v.t}: ${v.ayuda}`).join(' ')}`} infoQue="Qué significa cada vista">
        {VISTAS_VISITA.map((v) => <ChipLink key={v.id} href={enlace({ vv: v.id === 'hoy' ? null : v.id, pv: null })} activo={d.vista === v.id}>{v.t}<Conteo n={d.conteos[v.id]} /></ChipLink>)}
      </Filtros>
      <ul className={CLASE_LISTA}>
        {d.fila.map((v) => (
          <li key={v.id} className="flex items-stretch hover:bg-lavanda-sutil">
            <Link href={enlace({ visita: v.id })} aria-label={`Abrir el detalle de la visita de ${v.cliente} con ${v.compita}`} title="Abrir el detalle de la visita" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="w-28 shrink-0 text-sm font-bold">{etiquetaVisita(v.ts, d.ahora)}</span>
              <span className="min-w-48 flex-1">
                <span className="block truncate text-sm font-bold">{v.cliente}</span>
                <span className="block truncate text-sm text-texto-medio"><span className="text-xs text-texto-sutil">Compita </span>{v.compita}</span>
                {v.motivo ? <span className="block text-xs font-bold text-rojo-oscuro">{v.motivo}</span> : v.zona ? <span className="block truncate text-xs text-texto-sutil">{v.zona}</span> : null}
              </span>
              <span className="shrink-0 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[v.estado]}`}>{v.estado}</span>{v.rating !== null && <span className={`mt-1 block text-xs font-bold ${v.rating <= 3 ? 'text-rojo-oscuro' : 'text-texto-medio'}`}>{'★'.repeat(v.rating)}</span>}</span>
              <Flecha />
            </Link>
            {puedeChats && <Link href={enlace({ chat: `${v.clienteId}:${v.compitaId}` })} aria-label={`Ver el chat de ${v.cliente} y ${v.compita}`} className="flex shrink-0 items-center border-l border-borde px-3 text-sm font-bold text-texto-medio hover:bg-fondo-claro">Chat</Link>}
          </li>
        ))}
        {!d.fila.length && <li className="p-6 text-center text-texto-sutil">No hay visitas en esta vista</li>}
      </ul>
      <Paginador resumen={d.total ? `${(d.pag - 1) * POR_PAGINA_VISITAS + 1} a ${Math.min(d.pag * POR_PAGINA_VISITAS, d.total)} de ${d.total}` : '0 resultados'} pag={d.pag} paginas={d.paginas}
        hrefAnterior={d.pag > 1 ? enlace({ pv: d.pag - 1 > 1 ? String(d.pag - 1) : null }) : null} hrefSiguiente={d.pag < d.paginas ? enlace({ pv: String(d.pag + 1) }) : null} />
    </section>
  )
}
