import PlanesPago from '@/components/ui/PlanesPago'
import EliminarCuenta from '@/components/portal/EliminarCuenta'
import Tarjeta from '@/components/ui/base/Tarjeta'
import type { DatosPortal } from '@/lib/portal-datos'

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'long' }) : '')

// Mi plan: cuántas visitas le quedan, cuándo se renueva, sus pagos y cómo pagar. Compaz nunca pide un pago por teléfono ni por mensaje.
export default function SeccionPlan({ d, vistaPrevia }: { d: DatosPortal; vistaPrevia: boolean }) {
  const c = d.cupo
  return (
    <div className="space-y-4">
      {c && c.limite > 0 ? (
        <Tarjeta tono="destacada">
          <div className="text-sm font-bold uppercase tracking-wider text-morado-sutil">Plan actual</div>
          <h2 className="mt-1 text-2xl font-extrabold text-morado-profundo">{c.planNombre}</h2>
          <p className="mt-2 text-lg text-morado-claro">Te quedan <b>{c.restantes} {c.restantes === 1 ? 'visita' : 'visitas'}</b> de {c.limite}.</p>
          {c.renueva && <p className="text-base text-morado-sutil">Se renueva el {fecha(c.renueva)}.</p>}
          {c.vence && <p className="text-base text-morado-sutil">Las visitas sin usar vencen el {fecha(c.vence)}.</p>}
        </Tarjeta>
      ) : (
        <Tarjeta><h2 className="text-xl font-extrabold text-morado-profundo">Todavía no tienes un plan</h2><p className="mt-1 text-lg text-morado-claro">Tu plan aparece aquí cuando elijas a tu compita y confirmemos tu pago.</p></Tarjeta>
      )}
      <section>
        <h2 className="text-lg font-extrabold text-morado-profundo">Mis pagos</h2>
        <p className="mt-1 text-sm text-morado-claro">Compaz nunca te pedirá un pago por teléfono o mensaje. Si ves un cobro que no reconoces, avísanos.</p>
        {d.pagos.filter((p) => p.estado === 'activo').length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-borde bg-blanco p-4 text-center text-morado-claro">Todavía no hay pagos.</p>
        ) : (
          <ul className="mt-2 divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-blanco">
            {d.pagos.filter((p) => p.estado === 'activo').map((p) => (
              <li key={p.id} className="flex min-h-14 items-center justify-between gap-3 px-4"><span className="font-bold text-morado-profundo">{fecha(p.created_at)} · {p.tipo === 'plan' ? (p.plan ?? 'Plan') : 'Visita extra'}</span><b className="text-morado-profundo">${p.monto_usd}</b></li>
            ))}
          </ul>
        )}
      </section>
      {!vistaPrevia && <PlanesPago pendiente={d.pendientePago as never} />}
      {!vistaPrevia && <EliminarCuenta restantes={d.cupo?.restantes ?? 0} vence={d.cupo?.vence ?? null} />}
    </div>
  )
}
