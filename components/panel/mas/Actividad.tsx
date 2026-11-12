import Link from 'next/link'
import InfoBoton from '@/components/ui/InfoBoton'
import Boton from '@/components/ui/base/Boton'
import AutoRefresh from '@/components/ui/AutoRefresh'
import { CLASE_LISTA, Paginador, clasesChip } from '@/components/panel/ui'
import { PuntoUrgencia } from '@/components/panel/Personas'
import { DIAS_ACTIVIDAD, DIAS_REGISTRO, NIVELES_ACTIVIDAD } from '@/lib/panel-mas-tipos'
import { cuandoLinea } from '@/lib/panel-personas-tipos'
import type { FilaActividad } from '@/lib/panel-actividad'

type Enlace = (cambios: Record<string, string | null>) => string
export interface DatosActividad { filas: FilaActividad[]; total: number; porPagina: number; nivel: string; dias: number; q: string; pagina: number }

const PUNTO = { urgente: { u: 'rojo', t: 'Urgente' }, tarea: { u: 'amarillo', t: 'Tarea' }, actividad: { u: 'neutro', t: 'Informativo' } } as const

/**
 * Actividad (y, con `acceso`, el Registro de accesos): lo que pasó, en orden. Los filtros son enlaces y el buscador un formulario,
 * así todo vive en la dirección. Se actualiza sola cada 30 segundos. `pre` es el prefijo de los parámetros (act o reg).
 */
export default function Actividad({ d, enlace, pre, acceso = false, paramsForm, plazo }: { d: DatosActividad; enlace: Enlace; pre: 'act' | 'reg'; acceso?: boolean; paramsForm: Record<string, string>; /** Cuánto tiempo se guarda (lib/retencion.ts), para decirlo en pantalla. */ plazo: string }) {
  const paginas = Math.max(1, Math.ceil(d.total / d.porPagina))
  return (
    <section className="max-w-3xl space-y-3">
      <AutoRefresh intervaloSeg={30} />
      <p className="text-sm text-texto-medio">{acceso ? 'Cada vez que alguien del equipo consulta un teléfono, un correo o un chat queda anotado aquí. Protege a los clientes y al equipo.' : 'Todo lo que pasó en el sistema, en orden. Aquí no suena nada: se consulta cuando hace falta.'}</p>
      <p className="flex items-center gap-1 text-xs text-texto-sutil">Se conserva {plazo}; después se borra sola.<InfoBoton que="Cuánto se conserva" texto={acceso ? 'Quién vio un dato sensible y por qué se guarda más tiempo que el resto de la actividad, porque es la garantía de privacidad de las familias. El plazo se cambia en Más, Ajustes. En Manual está la lista de cuánto se guarda cada cosa.' : 'Pasado ese plazo la actividad se borra en la limpieza diaria de las 3 am. Los accesos a datos sensibles se guardan más tiempo (ver Registro de accesos). El plazo se cambia en Más, Ajustes.'} /></p>
      {!acceso && (
        <div className="flex flex-wrap items-center gap-1.5">
          <InfoBoton que="Filtrar por tipo" texto="Urgentes: lo que hubo que atender ya. Tareas: lo que alguien debía hacer. Informativo: lo que solo pasó. No cambia ni resuelve nada." />
          {NIVELES_ACTIVIDAD.map(([v, t]) => <Link prefetch={false} key={v} href={enlace({ [`${pre}_nivel`]: v || null, [`${pre}_pag`]: null })} aria-pressed={d.nivel === v} className={clasesChip(d.nivel === v)}>{t}</Link>)}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <InfoBoton que="Filtrar por días" texto={`Cuánto tiempo atrás mirar. Se conserva ${plazo}.`} />
        {(acceso ? DIAS_REGISTRO : DIAS_ACTIVIDAD).map(([v, t]) => <Link prefetch={false} key={v} href={enlace({ [`${pre}_dias`]: v, [`${pre}_pag`]: null })} aria-pressed={String(d.dias) === v} className={clasesChip(String(d.dias) === v)}>{t}</Link>)}
      </div>
      <form action="/panel" method="get" role="search" className="flex items-center gap-2">
        {Object.entries(paramsForm).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input name={`${pre}_q`} defaultValue={d.q} placeholder={acceso ? 'Buscar por persona o motivo' : 'Buscar por compita, cliente o texto'} aria-label="Buscar" className="min-h-10 min-w-0 flex-1 rounded-xl border border-borde bg-blanco px-3 text-sm sm:max-w-sm" />
        <Boton tamano="compacto" variante="secundario" navegacion type="submit">Buscar</Boton>
      </form>
      <ul className={CLASE_LISTA}>
        {d.filas.map((a) => (
          <li key={a.id} className="flex items-start gap-3 px-3 py-2">
            <span className="mt-1.5"><PuntoUrgencia u={PUNTO[a.nivel].u} texto={PUNTO[a.nivel].t} /></span>
            <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{a.resumen}</span>
            <time className="shrink-0 pt-0.5 text-xs text-texto-sutil" dateTime={a.creado_en}>{cuandoLinea(a.creado_en)}</time>
          </li>
        ))}
        {!d.filas.length && <li className="p-6 text-center text-texto-sutil">{acceso ? 'Nadie ha consultado datos sensibles en este periodo.' : 'No hay actividad con estos filtros.'}</li>}
      </ul>
      <Paginador resumen={`${d.total} ${d.total === 1 ? 'registro' : 'registros'}`} pag={d.pagina + 1} paginas={paginas} hrefAnterior={d.pagina > 0 ? enlace({ [`${pre}_pag`]: d.pagina - 1 > 0 ? String(d.pagina - 1) : null }) : null} hrefSiguiente={d.pagina + 1 < paginas ? enlace({ [`${pre}_pag`]: String(d.pagina + 1) }) : null} />
    </section>
  )
}
