import Link from 'next/link'
import Boton from '@/components/ui/base/Boton'
import Aviso from '@/components/ui/base/Aviso'
import { EncabezadoLateral, TituloBloque } from '@/components/panel/ui'
import AccionCuenta from '@/components/panel/AccionCuenta'
import CerrarConEscape from '@/components/panel/CerrarConEscape'
import { cuandoLinea } from '@/lib/panel-personas-tipos'
import { etiquetaVisita, queHacerConVisita } from '@/lib/panel-visitas-tipos'
import type { DetalleVisita as Detalle } from '@/lib/panel-visitas'

// El detalle de UNA visita: cómo va, quiénes participan, su historia y qué conviene hacer. Desde aquí se abre la ficha de cada uno o el chat.
export default function DetalleVisita({ d, ahora, cerrarHref, fichaClienteHref, fichaCompitaHref, chatHref, puedeAtender }: { puedeAtender: boolean; d: Detalle; ahora: number; cerrarHref: string; fichaClienteHref: string; fichaCompitaHref: string; chatHref: string | null }) {
  const v = d.fila
  const hacer = queHacerConVisita(v)
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-negro/30">
      <CerrarConEscape href={cerrarHref} />
      <Link href={cerrarHref} replace scroll={false} aria-label="Cerrar el detalle de la visita" className="absolute inset-0 cursor-default" />
      <aside role="dialog" aria-label={`Visita de ${v.cliente} con ${v.compita}`} className="relative h-full w-full max-w-md space-y-5 overflow-y-auto bg-blanco p-5 shadow-2xl">
        <EncabezadoLateral etiqueta="Visita" titulo={<>{v.cliente}<span className="font-bold text-texto-medio"> con {v.compita}</span></>} detalle={`${etiquetaVisita(v.ts, ahora)}${v.zona ? ` · ${v.zona}` : ''}`} cerrarHref={cerrarHref} />
        <section className="space-y-2 rounded-xl border border-borde p-3">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-gris100 px-2 py-0.5 text-xs font-bold text-texto-medio">{v.estado}</span>{v.rating !== null && <span className={`text-sm font-bold ${v.rating <= 3 ? 'text-rojo-oscuro' : 'text-texto-medio'}`}>{'★'.repeat(v.rating)}</span>}</div>
          {v.motivo && <p className="text-sm font-bold text-rojo-oscuro">{v.motivo}</p>}
          {hacer ? <Aviso tamano="compacto" tono={v.motivo ? 'advertencia' : 'info'}>{hacer}</Aviso> : <p className="text-sm text-texto-sutil">No hay nada que hacer con esta visita.</p>}
        </section>
        <section className="space-y-2">
          <TituloBloque>Abrir</TituloBloque>
          <div className="flex flex-wrap gap-2">
            <Boton tamano="compacto" variante="secundario" navegacion href={fichaClienteHref}>Ficha del cliente</Boton>
            <Boton tamano="compacto" variante="secundario" navegacion href={fichaCompitaHref}>Ficha del compita</Boton>
            {chatHref && <Boton tamano="compacto" variante="secundario" navegacion href={chatHref}>Chat</Boton>}
          </div>
        </section>
        {puedeAtender && v.estado === 'En curso' && (
          <section className="space-y-2">
            <TituloBloque>Acciones</TituloBloque>
            <div className="flex flex-wrap gap-2">
              <AccionCuenta peligro texto="Cerrar la visita ahora" url="/api/admin/forzar-cierre-visita" cuerpo={{ visita_id: v.id }} titulo="Cerrar la visita ahora"
                mensaje="La visita termina en este momento y se le avisa al compita por Telegram. Úsalo solo si quedó abierta y nadie la puede cerrar: el compita normalmente la termina desde Telegram."
                info="Termina a la fuerza una visita en curso que quedó abierta. Avisa al compita y queda anotado." />
            </div>
          </section>
        )}
        <section>
          <TituloBloque>Historia de la visita</TituloBloque>
          {d.linea.length === 0 ? <p className="mt-2 text-sm text-texto-sutil">Todavía no hay nada que contar.</p> : (
            <ol className="mt-3 border-l border-borde pl-4">
              {d.linea.map((l, i) => (
                <li key={i} className="relative pb-3.5 last:pb-0"><span className="absolute -left-5 top-1.5 h-2 w-2 rounded-full bg-naranja" /><p className="text-xs text-texto-sutil">{cuandoLinea(l.cuando)}</p><p className="text-sm [overflow-wrap:anywhere]">{l.texto}</p></li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  )
}
