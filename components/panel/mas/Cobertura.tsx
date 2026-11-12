import { CLASE_LISTA } from '@/components/panel/ui'
import InfoBoton from '@/components/ui/InfoBoton'
import type { FilaCobertura } from '@/lib/panel-mas-tipos'

// Cobertura y demanda por estado: compitas que pueden recibir solicitudes frente a solicitudes del último mes. En rojo, donde falta reclutar.
export default function Cobertura({ filas }: { filas: FilaCobertura[] }) {
  const max = Math.max(1, ...filas.map((f) => f.solicitudes))
  return (
    <section className="max-w-3xl space-y-3">
      <div className="flex items-center gap-1.5 text-sm text-texto-medio">
        <InfoBoton que="Qué es esta pantalla" texto="Por estado de Venezuela: cuántos compitas pueden recibir solicitudes (disponibles o con familias) y cuántas solicitudes llegaron en los últimos 30 días de clientes de ese estado. En rojo, donde no hay ningún compita o la demanda duplica a la oferta: ahí conviene reclutar. Un compita que cubre varios estados cuenta en cada uno." />
        Compitas activos por estado contra solicitudes del último mes.
      </div>
      <ul className={CLASE_LISTA}>
        {filas.map((f) => (
          <li key={f.estado} className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-2"><b className="text-sm">{f.estado}</b>{f.falta && <span className="rounded bg-rojo-claro px-1.5 text-[11px] font-extrabold uppercase text-rojo-oscuro">Faltan compitas</span>}</div>
            <div className="text-sm text-texto-medio">{f.compitas} {f.compitas === 1 ? 'compita activo' : 'compitas activos'} · {f.solicitudes} {f.solicitudes === 1 ? 'solicitud' : 'solicitudes'} este mes</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gris100"><div className={`h-full ${f.falta ? 'bg-rojo' : 'bg-verde-vivo'}`} style={{ width: `${Math.round((f.solicitudes / max) * 100)}%` }} /></div>
          </li>
        ))}
        {!filas.length && <li className="p-6 text-center text-texto-sutil">Todavía no hay compitas ni solicitudes con zona.</li>}
      </ul>
    </section>
  )
}
