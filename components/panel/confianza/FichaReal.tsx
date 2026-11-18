import Link from 'next/link'
import Aviso from '@/components/ui/base/Aviso'
import { EtiquetaAtencion, EtiquetaEtapa, Marca, TarjetaCf } from '@/components/panel/confianza/piezas'
import type { FilaReal } from '@/lib/confianza/real'
import type { FichaReal as FichaCargada } from '@/lib/confianza/lectura-real'

// Ficha de un aspirante con los datos REALES del CMC (fase 2A, solo lectura). Componente de servidor.
// Lo normalizado (requisitos de habilitación) es lo que calcula el propio CMC; el resto se muestra tal como llega, sin rellenar
// lo que falte. Las pestañas son enlaces (cada una vuelve a leer la ficha, que el servidor guarda 30 segundos).

export const TABS_REAL = [['resumen', 'Resumen'], ['preentrevista', 'Preentrevista'], ['entrevista', 'Entrevista'], ['verificaciones', 'Verificaciones'], ['onboarding', 'Onboarding'], ['disponibilidad', 'Disponibilidad'], ['alertas', 'Alertas'], ['historial', 'Historial']] as const
export type TabReal = (typeof TABS_REAL)[number][0]

type Obj = Record<string, unknown>
const OCULTAS = /^(ok|error|v2ms|v2uc|ms|interno|_.*|cache.*)$/i
const esObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)
const NOMBRES_CLAVE: Record<string, string> = { id: 'Código', idAlerta: 'Alerta', idVerificacion: 'Verificación', etapaSeleccion: 'Etapa de selección', estadoPreentrevista: 'Estado de la preentrevista', estadoOperativo: 'Estado operativo', bloqueaMatching: 'Bloquea asignaciones', masReciente: 'Más reciente', puedeHabilitar: 'Se puede habilitar', pendientesHabilitacion: 'Requisitos pendientes', pendienteConfirmar: 'Pendiente de confirmar', aceptaNuevos: 'Acepta nuevos servicios', fechaVencimiento: 'Vence', verificadoPor: 'Verificado por' }
const etiqueta = (k: string) => NOMBRES_CLAVE[k] ?? k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
const vacio = (x: unknown) => x == null || x === '' || (Array.isArray(x) && x.length === 0) || (esObj(x) && Object.keys(x).filter((k) => !OCULTAS.test(k)).length === 0)
function texto(x: unknown): string {
  if (x == null) return ''
  if (typeof x === 'boolean') return x ? 'Sí' : 'No'
  if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x)) { const d = new Date(x); return isNaN(+d) ? x : d.toLocaleString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false }) }
  if (Array.isArray(x)) return x.every((y) => !esObj(y) && !Array.isArray(y)) ? x.map(texto).join(', ') : `${x.length} elementos`
  if (esObj(x)) return Object.entries(x).filter(([k, v]) => !OCULTAS.test(k) && !vacio(v)).map(([k, v]) => `${etiqueta(k)}: ${texto(v)}`).join(' · ')
  return String(x)
}

/** Muestra un dato del CMC tal como viene: valores, listas como tabla y objetos como secciones. Nunca rellena lo que falta. */
function VistaDatos({ datos, nivel = 0 }: { datos: unknown; nivel?: number }) {
  if (vacio(datos)) return <p className="text-sm text-cf-texto-suave">Sin datos en el CMC.</p>
  if (Array.isArray(datos)) {
    if (!datos.every(esObj)) return <p className="text-sm">{texto(datos)}</p>
    const cols = [...new Set((datos as Obj[]).flatMap((d) => Object.keys(d).filter((k) => !OCULTAS.test(k))))].slice(0, 7)
    return (
      <div className="overflow-x-auto rounded-lg border border-cf-borde">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-cf-cabecera"><tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-semibold">{etiqueta(c)}</th>)}</tr></thead>
          <tbody className="divide-y divide-cf-borde">{(datos as Obj[]).slice(0, 300).map((d, i) => <tr key={i}>{cols.map((c) => <td key={c} className="px-3 py-2 align-top">{texto(d[c])}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
  if (!esObj(datos)) return <p className="text-sm">{texto(datos)}</p>
  const entradas = Object.entries(datos).filter(([k, v]) => !OCULTAS.test(k) && !vacio(v))
  const simples = entradas.filter(([, v]) => !esObj(v) && !(Array.isArray(v) && v.some(esObj)))
  const compuestas = entradas.filter(([, v]) => esObj(v) || (Array.isArray(v) && v.some(esObj)))
  return (
    <div className="space-y-3">
      {simples.length > 0 && (
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {simples.map(([k, v]) => <div key={k}><dt className="text-xs font-semibold text-cf-texto-suave">{etiqueta(k)}</dt><dd className="[overflow-wrap:anywhere]">{texto(v)}</dd></div>)}
        </dl>
      )}
      {compuestas.map(([k, v]) => (
        <div key={k} className="space-y-2">
          <p className={`font-semibold ${nivel === 0 ? 'text-sm' : 'text-xs text-cf-texto-suave'}`}>{etiqueta(k)}</p>
          {nivel < 3 ? <VistaDatos datos={v} nivel={nivel + 1} /> : <p className="text-sm">{texto(v)}</p>}
        </div>
      ))}
    </div>
  )
}

const pick = (o: unknown, k: string): unknown => (esObj(o) ? o[k] : undefined)

/** Los requisitos de habilitación tal como los calcula el CMC (panel_obtenerPanelElegibilidad). */
function Requisitos({ eleg }: { eleg: unknown }) {
  const reqs = pick(eleg, 'requisitos')
  if (!Array.isArray(reqs) || reqs.length === 0) return <VistaDatos datos={eleg} />
  const cumple = (e: unknown) => /cumple|ok|verificad|complet|s[ií]$/i.test(String(e ?? '')) && !/no cumple|pendiente|falta/i.test(String(e ?? ''))
  return (
    <ul className="space-y-2">
      {(reqs as Obj[]).map((r, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Marca estado={cumple(r.estado) ? 'hecho' : 'pendiente'} />
          <span><span className="font-semibold">{String(r.etiqueta ?? r.clave ?? 'Requisito')}</span>{r.estado != null && <span className="text-cf-texto-suave"> · {String(r.estado)}</span>}{r.detalle != null && r.detalle !== '' && <span className="block text-cf-texto-suave">{texto(r.detalle)}</span>}</span>
        </li>
      ))}
    </ul>
  )
}

export default function FichaReal({ id, fila, carga, tab, hrefTab, hrefVolver, urlV2 }: {
  id: string; fila: FilaReal | null; carga: FichaCargada; tab: TabReal; hrefTab: (t: TabReal) => string; hrefVolver: string; urlV2: string | null
}) {
  const f = carga.estado === 'ok' ? carga.datos.ficha : null
  const p = carga.estado === 'ok' ? carga.datos.pestanas : null
  const eleg = pick(f, 'elegibilidad')
  // data-clarity-mask: Clarity se carga en todo el sitio; con esto no graba el texto de la ficha.
  return (
    <div className="space-y-4" data-clarity-mask="True">
      <Link prefetch={false} href={hrefVolver} className="inline-flex min-h-9 items-center text-sm font-bold text-cf-morado">‹ Volver a la lista</Link>
      <header className="space-y-3 rounded-xl bg-cf-lateral p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="text-xs font-bold text-cf-texto-suave">{id}{carga.estado === 'ok' && carga.fuente === 'sintetica' ? ' · fuente sintética' : ''}</p>
            <h2 className="text-2xl font-extrabold leading-tight">{fila?.nombre || 'Aspirante del CMC'}</h2>
            {fila?.zona && <p className="text-sm text-cf-texto-suave">{fila.zona}</p>}
          </div>
          {fila && <span className="ml-auto flex items-center gap-3"><EtiquetaEtapa etapa={fila.etapa === 'Habilitado' && fila.enWeb === 'catalogo' ? 'En operación' : fila.etapa} /><EtiquetaAtencion estado={fila.atencion} /></span>}
        </div>
        {fila && <div className="rounded-lg border-l-[3px] border-cf-morado-secundario bg-cf-cabecera py-2 pl-3 pr-3 text-sm"><span className="font-bold">Próxima acción (orientativa):</span> {fila.proxima}</div>}
        <p className="flex flex-wrap items-center gap-2 text-xs text-cf-texto-suave">
          <span className="rounded-full bg-verde-claro px-2 py-0.5 font-semibold text-verde-oscuro">Solo lectura</span>
          Las decisiones se registran en el Centro Compitas V2.{urlV2 && <a href={urlV2} target="_blank" rel="noopener noreferrer" className="font-semibold text-cf-morado underline">Abrir la V2 ›</a>}
        </p>
      </header>

      {carga.estado === 'no_existe' && <Aviso tamano="compacto" tono="advertencia">Ese código no existe en el CMC.</Aviso>}
      {carga.estado === 'error' && <Aviso tamano="compacto" tono="peligro">No se pudo leer la ficha del CMC ({carga.codigo}). Vuelve a intentarlo en un momento; la lista sigue disponible.</Aviso>}
      {carga.estado === 'no_configurado' && <Aviso tamano="compacto" tono="info">La conexión con el CMC no está configurada.</Aviso>}

      {carga.estado === 'ok' && (
        <>
          <nav aria-label="Partes de la ficha" className="-mx-4 overflow-x-auto overflow-y-hidden border-b border-cf-borde px-4">
            <ul className="flex w-max gap-1">
              {TABS_REAL.map(([t, nombre]) => (
                <li key={t}><Link prefetch={false} href={hrefTab(t)} aria-current={tab === t ? 'page' : undefined}
                  className={`-mb-px flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold ${tab === t ? 'border-cf-morado text-cf-morado' : 'border-transparent text-cf-texto-suave hover:text-cf-texto'}`}>{nombre}</Link></li>
              ))}
            </ul>
          </nav>
          {tab === 'resumen' && (
            <div className="grid gap-4 md:grid-cols-2">
              <TarjetaCf titulo="Requisitos de habilitación (según el CMC)"><Requisitos eleg={eleg} /></TarjetaCf>
              <TarjetaCf titulo="Estado operativo"><VistaDatos datos={pick(f, 'ops')} /></TarjetaCf>
              <TarjetaCf titulo="Ficha" className="md:col-span-2"><VistaDatos datos={pick(f, 'ficha')} /></TarjetaCf>
            </div>
          )}
          {tab === 'preentrevista' && <TarjetaCf titulo="Preentrevista"><VistaDatos datos={pick(p, 'preentrevista')} /></TarjetaCf>}
          {tab === 'entrevista' && <TarjetaCf titulo="Entrevistas registradas"><VistaDatos datos={pick(p, 'entrevista')} /></TarjetaCf>}
          {tab === 'verificaciones' && (
            <div className="space-y-4">
              <TarjetaCf titulo="Estado de identidad y referencias"><VistaDatos datos={pick(f, 'atributos')} /></TarjetaCf>
              <TarjetaCf titulo="Historial de verificaciones"><VistaDatos datos={pick(pick(p, 'verificaciones'), 'items')} /></TarjetaCf>
            </div>
          )}
          {tab === 'onboarding' && <TarjetaCf titulo="Onboarding"><VistaDatos datos={pick(f, 'onboarding')} /></TarjetaCf>}
          {tab === 'disponibilidad' && (
            <div className="space-y-4">
              <TarjetaCf titulo="Disponibilidad"><VistaDatos datos={pick(f, 'disponibilidad')} /></TarjetaCf>
              <TarjetaCf titulo="Cobertura"><VistaDatos datos={pick(f, 'cobertura')} /></TarjetaCf>
            </div>
          )}
          {tab === 'alertas' && <TarjetaCf titulo="Alertas"><VistaDatos datos={pick(f, 'alertas')} /></TarjetaCf>}
          {tab === 'historial' && <TarjetaCf titulo="Historial de eventos (hoja 17)"><VistaDatos datos={pick(pick(p, 'historial'), 'eventos')} /></TarjetaCf>}
          <p className="text-xs text-cf-texto-suave">{carga.fuente === 'cmc' ? 'Leído del CMC' : 'Datos inventados, generados'} el {texto(carga.generado)}.</p>
        </>
      )}
    </div>
  )
}
