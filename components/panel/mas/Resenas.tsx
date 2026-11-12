import Link from 'next/link'
import { CLASE_LISTA, clasesChip } from '@/components/panel/ui'
import InfoBoton from '@/components/ui/InfoBoton'
import AccionResena from '@/components/panel/mas/AccionResena'
import { resenaCritica, type FilaResena } from '@/lib/panel-mas-tipos'
import { cuandoLinea } from '@/lib/panel-personas-tipos'

type Enlace = (cambios: Record<string, string | null>) => string

// Reseñas: una reseña no se muestra al público hasta que la apruebas. Las de 3 estrellas o menos se marcan.
export default function Resenas({ filas, ver, enlace, puedeActuar }: { filas: FilaResena[]; ver: 'pendientes' | 'publicadas'; enlace: Enlace; puedeActuar: boolean }) {
  const pend = filas.filter((r) => !r.publicada), pub = filas.filter((r) => r.publicada)
  const lista = ver === 'publicadas' ? pub : pend
  return (
    <section className="max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <InfoBoton que="Qué es esta pantalla" texto="Lo que el cliente escribe sobre su compita no se ve en el perfil hasta que lo apruebas. Por aprobar son las que esperan; Publicadas son las que ya se ven. Ocultar una publicada la devuelve a Por aprobar." />
        <Link prefetch={false} href={enlace({ res_ver: null })} aria-pressed={ver === 'pendientes'} className={clasesChip(ver === 'pendientes')}>Por aprobar <span className="ml-1 opacity-70">{pend.length}</span></Link>
        <Link prefetch={false} href={enlace({ res_ver: 'publicadas' })} aria-pressed={ver === 'publicadas'} className={clasesChip(ver === 'publicadas')}>Publicadas <span className="ml-1 opacity-70">{pub.length}</span></Link>
      </div>
      <ul className={CLASE_LISTA}>
        {lista.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-2.5">
            <div className="min-w-48 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 text-sm"><b>{r.cliente}</b><span className="text-texto-sutil">sobre</span><b>{r.compita}</b>
                <span className={resenaCritica(r) ? 'font-bold text-rojo-oscuro' : 'text-texto-medio'} aria-label={`${r.estrellas} estrellas`}>{'★'.repeat(r.estrellas)}</span>
                <span className="text-xs text-texto-sutil">{cuandoLinea(r.creada)}</span></div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-texto-medio [overflow-wrap:anywhere]">{r.texto}</p>
            </div>
            {puedeActuar && <AccionResena id={r.id} publicada={r.publicada} />}
          </li>
        ))}
        {!lista.length && <li className="p-6 text-center text-texto-sutil">{ver === 'publicadas' ? 'Todavía no hay reseñas publicadas.' : 'No hay reseñas esperando. Todo al día'}</li>}
      </ul>
    </section>
  )
}
