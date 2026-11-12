import Link from 'next/link'
import InfoBoton from '@/components/ui/InfoBoton'
import { CLASE_LISTA, Paginador, clasesChip } from '@/components/panel/ui'
import AnularPago from '@/components/panel/mas/AnularPago'
import { paginaDe, type FilaPago } from '@/lib/panel-mas-tipos'
import { cuandoLinea } from '@/lib/panel-personas-tipos'

type Enlace = (cambios: Record<string, string | null>) => string
const METODO: Record<string, string> = { zelle: 'Zelle', transferencia: 'Transferencia', stripe: 'Tarjeta (Stripe)', otro: 'Otro' }

// Pagos registrados, con la opción de anular uno si hubo un error. La confirmación de un pago nuevo se hace desde la Bandeja.
export default function Pagos({ filas, ver, pagina, enlace }: { filas: FilaPago[]; ver: 'activos' | 'anulados'; pagina: unknown; enlace: Enlace }) {
  const act = filas.filter((p) => !p.anulado), anu = filas.filter((p) => p.anulado)
  const lista = ver === 'anulados' ? anu : act
  const p = paginaDe(pagina, lista.length)
  return (
    <section className="max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <InfoBoton que="Qué es esta pantalla" texto="Los pagos registrados, el más reciente primero. Anular un pago libera las visitas que no se cobraron y recalcula el cupo del cliente; úsalo solo si hubo un error. Para confirmar un pago nuevo, usa el botón de la Bandeja." />
        <Link href={enlace({ pag_ver: null, pag_pag: null })} aria-pressed={ver === 'activos'} className={clasesChip(ver === 'activos')}>Activos <span className="ml-1 opacity-70">{act.length}</span></Link>
        <Link href={enlace({ pag_ver: 'anulados', pag_pag: null })} aria-pressed={ver === 'anulados'} className={clasesChip(ver === 'anulados')}>Anulados <span className="ml-1 opacity-70">{anu.length}</span></Link>
      </div>
      <ul className={CLASE_LISTA}>
        {lista.slice(p.desde, p.hasta).map((g) => (
          <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
            <div className="min-w-48 flex-1">
              <div className="text-sm"><b>{g.cliente}</b> <span className="text-texto-medio">· {g.plan} · ${g.monto}</span></div>
              <div className="text-xs text-texto-sutil">{cuandoLinea(g.creado)} · {METODO[g.metodo] ?? g.metodo}{g.referencia ? ` · ${g.referencia}` : ''}</div>
              {g.anulado && g.motivo && <div className="text-xs text-rojo-oscuro">Motivo: {g.motivo}</div>}
            </div>
            {g.anulado ? <span className="text-sm font-bold text-rojo-oscuro">Anulado</span> : <AnularPago id={g.id} cliente={g.cliente} monto={g.monto} />}
          </li>
        ))}
        {!lista.length && <li className="p-6 text-center text-texto-sutil">{ver === 'anulados' ? 'No hay pagos anulados.' : 'Todavía no hay pagos registrados.'}</li>}
      </ul>
      <Paginador resumen={`${lista.length} ${lista.length === 1 ? 'pago' : 'pagos'}`} pag={p.pag} paginas={p.paginas} hrefAnterior={p.pag > 1 ? enlace({ pag_pag: p.pag - 1 > 1 ? String(p.pag - 1) : null }) : null} hrefSiguiente={p.pag < p.paginas ? enlace({ pag_pag: String(p.pag + 1) }) : null} />
    </section>
  )
}
