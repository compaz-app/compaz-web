import InfoBoton from '@/components/ui/InfoBoton'
import ResolverPostulacion from '@/components/panel/mas/ResolverPostulacion'
import { CLASE_LISTA, ChipLink, Encabezado, Filtros, Paginador, Rol, TituloSeccion } from '@/components/panel/ui'
import { cuandoLinea } from '@/lib/panel-personas-tipos'
import { DESCRIPCION_POSTULACIONES, ETIQUETA_CLASIF, ETIQUETA_FUENTE, ETIQUETA_TIPO, FILTROS_CLASIF, FILTROS_TIPO, INFO_POSTULACIONES, type ConsultaPost } from '@/lib/panel-postulaciones-tipos'
import type { PostulacionPorResolver } from '@/lib/captacion'

type Enlace = (cambios: Record<string, string | null>) => string
interface Pend { activa: boolean; error: boolean; soloSupabase?: boolean; filas: PostulacionPorResolver[] }

// Postulaciones y origen: arriba lo que no llegó a Airtable (hay que resolverlo), luego qué campañas traen gente y el listado de postulaciones.
export default function Postulaciones({ q, pend, enlace }: { q: ConsultaPost; pend: Pend; enlace: Enlace }) {
  const sin = { po_tipo: null, po_clasif: null, po_pag: null }
  return (
    <section className="max-w-3xl space-y-4">
      <Encabezado titulo="Postulaciones y origen (CMC)" descripcion={DESCRIPCION_POSTULACIONES} info={INFO_POSTULACIONES} infoQue="Para qué sirve esta pantalla" />

      {pend.error && <p role="alert" className="rounded-xl border border-borde bg-blanco p-3 text-sm font-bold text-rojo-oscuro">No se pudo leer lo que falta por resolver. Inténtalo en unos minutos.</p>}
      {pend.activa && pend.soloSupabase && <p className="rounded-xl border border-borde bg-blanco p-3 text-sm text-texto-medio">La copia a Airtable está desactivada: las postulaciones nuevas llegan al CMC directo desde Supabase y no aparecen en la lista de abajo. Lo que quede ahí es anterior: comprueba su ID en el CMC y ciérralo con "La registré directamente en el CMC".</p>}
      {pend.activa && !pend.error && pend.filas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1"><TituloSeccion>Sin llegar a Airtable ({pend.filas.length})</TituloSeccion><InfoBoton que="Qué es esto" texto="Están guardadas en Compaz pero no se pudieron copiar a Airtable, así que el equipo de selección no las ve. Resuélvelas: vincúlalas a un registro de Airtable, regístralas directamente en el CMC o márcalas como no procedentes." /></div>
          <ul className={CLASE_LISTA}>
            {pend.filas.map((p) => (
              <li key={p.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-sm"><b>{p.nombre}</b> <span className="text-texto-medio">· {p.tipo === 'compita' ? 'Aspirante a compita' : p.tipo === 'familia' ? 'Familia' : 'Sin tipo'} · {p.ubicacion}</span></span>
                  <Rol>{p.airtable_estado === 'conflicto' ? 'Posible duplicado' : `Falló ${p.airtable_intentos} veces`}</Rol>
                </div>
                <div className="break-all text-xs text-texto-sutil">{p.telefono} · {p.email} · {cuandoLinea(p.recibida_en)}</div>
                {p.airtable_ultimo_error && <div className="break-words font-mono text-[11px] text-texto-sutil">{p.airtable_ultimo_error}</div>}
                <ResolverPostulacion id={p.id} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {pend.activa && !pend.error && pend.filas.length === 0 && <p className="text-sm text-texto-medio">Todo lo recibido llegó a Airtable: no hay nada por resolver.</p>}
      {!pend.activa && <p className="text-sm text-texto-sutil">La copia a Airtable no está activada en este entorno, así que no hay nada por resolver.</p>}

      <div className="space-y-2">
        <div className="flex items-center gap-1"><TituloSeccion>De dónde llegan</TituloSeccion><InfoBoton que="Cómo leerlo" texto="Cada fila es una campaña de anuncios (o la página, si llegó sin campaña): cuántas postulaciones trajo y cuántas calificaron. Si una campaña trae muchas pero casi ninguna califica, está atrayendo a la gente equivocada. Cuenta las últimas 500 postulaciones." /></div>
        <ul className={CLASE_LISTA}>
          {q.resumen.map((r) => (
            <li key={r.origen} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
              <b className="min-w-0 truncate">{r.origen}</b>
              <span className="shrink-0 text-texto-medio">{r.total} {r.total === 1 ? 'postulación' : 'postulaciones'} · {r.calificadas} {r.calificadas === 1 ? 'calificó' : 'calificaron'} ({r.porcentaje}%)</span>
            </li>
          ))}
          {!q.resumen.length && <li className="p-6 text-center text-sm text-texto-sutil">Todavía no hay postulaciones.</li>}
        </ul>
      </div>

      <div className="space-y-2">
        <TituloSeccion>Postulaciones</TituloSeccion>
        <Filtros info="Tipo: familia que busca el servicio o aspirante a compita. Estado: si el equipo ya la revisó y la calificó. Toca el estado activo para quitarlo." infoQue="Qué significan los filtros">
          <ChipLink href={enlace({ ...sin })} activo={!q.tipo && !q.clasif}>Todas</ChipLink>
          {FILTROS_TIPO.map((t) => <ChipLink key={t} href={enlace({ ...sin, po_tipo: q.tipo === t ? null : t, po_clasif: q.clasif || null })} activo={q.tipo === t}>{ETIQUETA_TIPO[t]}</ChipLink>)}
          <span aria-hidden className="mx-0.5 h-5 w-px bg-borde" />
          {FILTROS_CLASIF.map((c) => <ChipLink key={c} href={enlace({ ...sin, po_tipo: q.tipo || null, po_clasif: q.clasif === c ? null : c })} activo={q.clasif === c}>{ETIQUETA_CLASIF[c]}</ChipLink>)}
        </Filtros>
        <ul className={CLASE_LISTA}>
          {q.filas.map((f) => (
            <li key={f.id} className="px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm"><b>{f.nombre}</b> <span className="text-texto-medio">· {ETIQUETA_TIPO[f.tipo]}{f.ubicacion ? ` · ${f.ubicacion}` : ''}</span></span>
                <Rol>{ETIQUETA_CLASIF[f.clasificacion]}</Rol>
              </div>
              <div className="text-xs text-texto-sutil">{cuandoLinea(f.recibida)} · {ETIQUETA_FUENTE[f.fuente] ?? f.fuente}{f.campana ? ` · campaña ${f.campana}` : ''}{f.origen ? ` · ${f.origen}` : ''}</div>
            </li>
          ))}
          {!q.filas.length && <li className="p-6 text-center text-sm text-texto-sutil">No hay postulaciones con ese filtro.</li>}
        </ul>
        <Paginador resumen={`${q.total} ${q.total === 1 ? 'postulación' : 'postulaciones'}`} pag={q.pag} paginas={q.paginas}
          hrefAnterior={q.pag > 1 ? enlace({ po_pag: q.pag - 1 > 1 ? String(q.pag - 1) : null }) : null} hrefSiguiente={q.pag < q.paginas ? enlace({ po_pag: String(q.pag + 1) }) : null} />
      </div>
    </section>
  )
}
