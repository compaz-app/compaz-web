import Link from 'next/link'
import { clasesChip } from '@/components/panel/ui'
import InfoBoton from '@/components/ui/InfoBoton'
import Boton from '@/components/ui/base/Boton'
import { ENTRADAS, SECCIONES, buscarEnManual, limitesDelManual, permisosDelManual, puedeLaEntrada, type EntradaManual } from '@/lib/manual'
import { ETIQUETA_PERMISO } from '@/lib/permisos-catalogo'
import { HUB } from '@/lib/panel-mas-tipos'
import { hrefSeccion, esSeccionPanel } from '@/lib/panel-secciones'
import type { ActorVista } from '@/lib/panel-secciones'
import type { FilaRetencion } from '@/lib/retencion'

type Enlace = (cambios: Record<string, string | null>) => string

/** A dónde lleva "Ir a esta pantalla": a su sección del panel o a su herramienta de Más; null si no hay dónde ir. */
function rutaPantalla(p: string, como: boolean): string | null {
  if (esSeccionPanel(p) && p !== 'mas') return hrefSeccion(p, como)
  const h = HUB.find((x) => x.id === p)
  return h ? hrefSeccion('mas', como, { mas: h.id }) : null
}

// Manual del equipo, organizado por preguntas. El contenido sale de lib/manual.ts (lo escrito a mano más lo automático de permisos y límites,
// que nunca queda viejo). Búsqueda, sección y pregunta abierta viven en la dirección.
export default function Manual({ actor, q, sec, abierta, enlace, como, paramsForm, retencion }: { actor: ActorVista; q: string; sec: string; abierta: string; enlace: Enlace; como: boolean; paramsForm: Record<string, string>; retencion: FilaRetencion[] }) {
  const esAdmin = actor.rol === 'admin'
  const lista = buscarEnManual(q).filter((e) => !sec || e.seccion === sec)
  const tarjeta = (e: EntradaManual) => {
    const ok = puedeLaEntrada(e, actor.permisos, esAdmin)
    const abiertaAhora = abierta === e.id
    const ir = e.pantalla && e.pantalla !== 'manual' ? rutaPantalla(e.pantalla, como) : null
    return (
      <li key={e.id} className={`overflow-hidden rounded-xl border bg-blanco ${abiertaAhora ? 'border-morado-medio' : 'border-borde'} ${ok ? '' : 'opacity-70'}`}>
        <h3>
          <Link prefetch={false} href={enlace({ man_abierta: abiertaAhora ? null : e.id })} aria-expanded={abiertaAhora} scroll={false} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left">
            <span className="flex-1 text-sm font-extrabold">{e.titulo}</span>
            {!ok && <span className="shrink-0 rounded bg-gris100 px-1.5 text-[11px] font-bold">Sin permiso</span>}
            <span aria-hidden className="text-texto-sutil">{abiertaAhora ? '▾' : '▸'}</span>
          </Link>
        </h3>
        {abiertaAhora && (
          <div className="space-y-2.5 border-t border-borde px-3 pb-3 pt-2.5">
            <p className="text-sm font-bold">{e.paraQue}</p>
            {!ok && <p role="note" className="rounded-lg bg-amarillo-claro px-3 py-2 text-sm font-semibold text-ambar-oscuro">{e.permiso === 'raiz' ? 'Solo un administrador puede hacer esto.' : `Necesitas el permiso "${ETIQUETA_PERMISO[e.permiso as keyof typeof ETIQUETA_PERMISO] ?? e.permiso}". Pídeselo a un administrador.`}</p>}
            <ol className="space-y-1.5">
              {e.pasos.map((p, i) => <li key={i} className="flex gap-2.5 text-sm"><span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gris100 text-xs font-extrabold text-texto-medio">{i + 1}</span><span>{p}</span></li>)}
            </ol>
            {e.despues && <p className="rounded-lg bg-fondo-claro px-3 py-2 text-sm text-texto-medio">{e.despues}</p>}
            {ir && <Boton tamano="compacto" variante="secundario" href={ir} info="Te lleva a la pantalla del panel donde se hace esto. No cambia nada.">Ir a esta pantalla</Boton>}
          </div>
        )}
      </li>
    )
  }
  const mostrarAuto = !q && (!sec || sec === 'cuentas' || sec === 'configuracion')
  return (
    <section className="max-w-3xl space-y-3">
      <form action="/panel" method="get" role="search" className="flex items-center gap-2">
        {Object.entries(paramsForm).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input type="search" name="man_q" defaultValue={q} placeholder="Busca: pago, no abre, pausa…" aria-label="Buscar en el manual" className="min-h-10 min-w-0 flex-1 rounded-xl border border-borde bg-blanco px-3 text-sm" />
        <Boton tamano="compacto" variante="secundario" navegacion type="submit">Buscar</Boton>
        <InfoBoton que="Qué es el manual" texto="Responde las preguntas más comunes del equipo y se mantiene al día con el sistema. Busca con tus palabras o elige una sección. Las preguntas con candado necesitan un permiso que no tienes." />
      </form>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Secciones del manual">
        <Link prefetch={false} href={enlace({ man_sec: null, man_abierta: null })} aria-pressed={sec === ''} className={clasesChip(sec === '', 'shrink-0 whitespace-nowrap')}>Todo</Link>
        {SECCIONES.map((x) => <Link prefetch={false} key={x.id} href={enlace({ man_sec: x.id, man_abierta: null })} aria-pressed={sec === x.id} className={clasesChip(sec === x.id, 'shrink-0 whitespace-nowrap')}>{x.titulo}</Link>)}
      </div>
      {lista.length === 0 && <p role="status" className="rounded-xl border border-dashed border-borde bg-blanco p-5 text-center text-sm text-texto-medio">No encontré nada con esas palabras. Prueba con otras, o quita el filtro de sección.</p>}
      {q && lista.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-texto-medio"><b>{lista.length}</b> {lista.length === 1 ? 'resultado' : 'resultados'}, los más parecidos primero.</p>
          <ul className="grid gap-2">{lista.map(tarjeta)}</ul>
        </div>
      )}
      {!q && SECCIONES.map((x) => {
        const delaSeccion = lista.filter((e) => e.seccion === x.id)
        if (delaSeccion.length === 0) return null
        return (
          <div key={x.id} className="space-y-1.5">
            <div><h2 className="text-base font-extrabold">{x.titulo}</h2><p className="text-xs text-texto-medio">{x.descripcion}</p></div>
            <ul className="grid gap-2">{delaSeccion.map(tarjeta)}</ul>
          </div>
        )
      })}
      {mostrarAuto && (
        <div className="space-y-2">
          <details className="rounded-xl border border-borde bg-blanco">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-extrabold">Qué puede hacer cada permiso</summary>
            <ul className="divide-y divide-borde border-t border-borde">{permisosDelManual().map((p) => <li key={p.id} className="px-3 py-2 text-sm"><b>{p.titulo}</b><span className="text-texto-medio"> · {p.texto}</span></li>)}</ul>
          </details>
          <details className="rounded-xl border border-borde bg-blanco">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-extrabold">Cuánto tiempo se guarda cada cosa</summary>
            <ul className="divide-y divide-borde border-t border-borde">{retencion.map((r) => <li key={r.id} className="px-3 py-2 text-sm"><span className="block">{r.que}</span><b>{r.plazo}</b><span className="text-xs text-texto-sutil"> · se cambia en: {r.dondeCambia}</span></li>)}</ul>
          </details>
          <details className="rounded-xl border border-borde bg-blanco">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-extrabold">Límites del sistema y por qué existen</summary>
            <ul className="divide-y divide-borde border-t border-borde">{limitesDelManual().map((l) => <li key={l.id} className="px-3 py-2 text-sm"><b>{l.titulo}</b><span className="block text-texto-medio">{l.texto}</span></li>)}</ul>
          </details>
        </div>
      )}
      <p className="text-xs text-texto-sutil">{ENTRADAS.length} preguntas respondidas.</p>
    </section>
  )
}
