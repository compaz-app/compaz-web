import SeccionFamiliar from '@/components/portal/SeccionFamiliar'
import SeccionPlan from '@/components/portal/SeccionPlan'
import { fichaCompleta } from '@/lib/ficha'
import type { DatosPortal } from '@/lib/portal-datos'
import type { ParteCuenta } from '@/lib/portal-secciones'

/** Qué parte de Mi cuenta empieza abierta: la que pidió el enlace; si no, la ficha cuando falta (es lo que bloquea agendar); si no, el plan. */
export const parteAbierta = (pedida: ParteCuenta | null, fichaLista: boolean): ParteCuenta => pedida ?? (fichaLista ? 'plan' : 'familiar')

// Mi cuenta: Mi familiar y Mi plan en una sola pestaña, cada una plegable. Solo se pliegan con <details> (sin JavaScript): lo que está cerrado sigue ahí.
export default function SeccionCuenta({ d, vistaPrevia, pedida }: { d: DatosPortal; vistaPrevia: boolean; pedida: ParteCuenta | null }) {
  const abierta = parteAbierta(pedida, !!d.usuario && fichaCompleta(d.usuario))
  const parte = (id: ParteCuenta, titulo: string, hijo: React.ReactNode) => (
    <details open={abierta === id} className="group rounded-2xl border border-borde bg-blanco px-4 py-1">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-lg font-extrabold text-morado-profundo [&::-webkit-details-marker]:hidden">
        {titulo}<span aria-hidden className="text-morado-sutil group-open:rotate-90">▸</span>
      </summary>
      <div className="pb-4">{hijo}</div>
    </details>
  )
  return (
    <div className="space-y-3">
      {parte('familiar', 'Mi familiar', <SeccionFamiliar d={d} vistaPrevia={vistaPrevia} />)}
      {parte('plan', 'Mi plan y pagos', <SeccionPlan d={d} vistaPrevia={vistaPrevia} />)}
    </div>
  )
}
