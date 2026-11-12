import Link from 'next/link'
import InfoBoton from '@/components/ui/InfoBoton'
import { PuntoUrgencia } from '@/components/panel/Personas'
import { CLASE_LISTA, ChipLink, Conteo, Encabezado, Filtros, Flecha, Paginador } from '@/components/panel/ui'
import { ETIQUETA_ESPERA } from '@/lib/panel-caso-tipos'
import { ETAPAS, TEXTO_SEMAFORO, tiempoEnEtapa, type FilaSeguimiento, type Umbrales } from '@/lib/panel-seguimiento-tipos'

type Enlace = (cambios: Record<string, string | null>) => string
export interface DatosSeguimiento { fila: FilaSeguimiento[]; conteos: Record<string, number>; etapa: string; total: number; paginas: number; pag: number; umbrales: Umbrales }

const TEXTO_TIEMPO = { verde: 'text-texto-sutil', amarillo: 'text-ambar-oscuro', rojo: 'text-rojo-oscuro' } as const
const INFO = 'Seguimiento muestra dónde está cada cliente en el proceso (solicitud, entrevista, decisión, pago, ficha, activo) y a quién le toca moverse: al cliente, al compita o a ti. Es para detectar a quien se atascó. Toca una fila para ver el caso completo: qué pasa, la línea de tiempo y desde ahí las fichas y el chat. Aquí no se cambia nada.'

// Seguimiento (servidor, sin JavaScript en el navegador): cada etapa y página es un enlace, así el estado vive en la dirección.
export default function Seguimiento({ d, enlace }: { d: DatosSeguimiento; enlace: Enlace }) {
  return (
    <section className="max-w-3xl space-y-3">
      <Encabezado titulo="Seguimiento" descripcion="Dónde está cada cliente y a quién le toca moverse." info={INFO} infoQue="Para qué sirve Seguimiento" pista="Toca una fila para ver el caso completo." />
      <Filtros info="Cada botón es una etapa del proceso del cliente y cuántos hay en ella. Tócalo para ver solo esos clientes. No cambia nada. Quien aún no ha pedido nada no aparece." infoQue="Filtrar por etapa">
        {['Todos', ...ETAPAS].map((et) => <ChipLink key={et} href={enlace({ etapa: et === 'Todos' ? null : et, pag: null })} activo={d.etapa === et}>{et}<Conteo n={d.conteos[et]} /></ChipLink>)}
      </Filtros>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-medio">
        <span className="inline-flex items-center gap-1.5"><PuntoUrgencia u="verde" texto={TEXTO_SEMAFORO.verde} />Al día</span>
        <span className="inline-flex items-center gap-1.5"><PuntoUrgencia u="amarillo" texto={TEXTO_SEMAFORO.amarillo} />Esperando más de lo normal</span>
        <span className="inline-flex items-center gap-1.5"><PuntoUrgencia u="rojo" texto={TEXTO_SEMAFORO.rojo} />Atascado</span>
        <InfoBoton que="Qué es el color" texto={`El punto depende de cuántas horas lleva el cliente sin movimiento en su etapa. Amarillo y rojo desde: ${ETAPAS.map((e) => `${e} ${d.umbrales[e][0]} y ${d.umbrales[e][1]} h`).join(', ')}. Se cambian en Más, Ajustes del semáforo.`} />
      </div>
      <ul className={CLASE_LISTA}>
        {d.fila.map((p) => (
          <li key={p.id}>
            <Link prefetch={false} href={enlace({ caso: p.id })} aria-label={`Abrir el seguimiento de ${p.nombre || 'este cliente'}${p.compita ? ` con ${p.compita}` : ''}`} title="Abrir el seguimiento completo del caso"
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-0.5 px-3 py-2 hover:bg-lavanda-sutil sm:grid-cols-[minmax(0,13rem)_minmax(0,12rem)_auto_auto]">
              <span className="flex min-w-0 items-center gap-2.5">
                <PuntoUrgencia u={p.urgencia} texto={TEXTO_SEMAFORO[p.urgencia]} />
                <span className="min-w-0"><span className="block truncate text-sm font-bold">{p.nombre || 'Sin nombre'}</span><span className={`block text-xs ${TEXTO_TIEMPO[p.urgencia]}`}>{tiempoEnEtapa(p.horas)} sin movimiento</span></span>
              </span>
              <span className="row-start-2 min-w-0 truncate pl-5 text-sm text-texto-medio sm:row-start-auto sm:pl-0">{p.compita && <><span className="text-xs text-texto-sutil">Compita </span>{p.compita}</>}</span>
              <span className="row-span-2 justify-self-end text-right sm:row-span-1">
                <span className="block rounded-full bg-gris100 px-2 py-0.5 text-center text-xs font-bold text-texto-medio">{p.etapa}</span>
                <span className={`mt-0.5 block text-[11px] ${p.espera === 'equipo' ? 'font-bold text-rojo-oscuro' : 'text-texto-sutil'}`}>{ETIQUETA_ESPERA[p.espera]}</span>
              </span>
              <span className="row-span-2 sm:row-span-1"><Flecha /></span>
            </Link>
          </li>
        ))}
        {!d.fila.length && <li className="p-6 text-center text-texto-sutil">Nadie en esta etapa</li>}
      </ul>
      <Paginador resumen={`${d.total} ${d.total === 1 ? 'cliente' : 'clientes'}`} pag={d.pag} paginas={d.paginas} hrefAnterior={d.pag > 1 ? enlace({ pag: d.pag - 1 > 1 ? String(d.pag - 1) : null }) : null} hrefSiguiente={d.pag < d.paginas ? enlace({ pag: String(d.pag + 1) }) : null} />
    </section>
  )
}
