import Link from 'next/link'
import InfoBoton from '@/components/ui/InfoBoton'
import BotonReintentar from '@/components/panel/mas/BotonReintentar'
import { CLASE_LISTA, Paginador, clasesChip } from '@/components/panel/ui'
import { PuntoUrgencia } from '@/components/panel/Personas'
import { nombreDePlantilla, paginaDe, type FilaAviso } from '@/lib/panel-mas-tipos'
import { cuandoLinea } from '@/lib/panel-personas-tipos'

type Enlace = (cambios: Record<string, string | null>) => string
const ESTADO = { enviado: { u: 'verde', t: 'Enviado' }, pendiente: { u: 'neutro', t: 'Pendiente' }, fallido: { u: 'rojo', t: 'Fallido' }, cancelado: { u: 'neutro', t: 'Cancelado' } } as const
const ROL = { cliente: 'Cliente', compita: 'Compita', admin: 'Equipo' } as const

// Avisos enviados: qué se le mandó a cada persona, por qué canal y si llegó. Cada uno queda guardado con su resultado; los fallidos se reintentan aquí.
export default function Avisos({ filas, ver, pagina, enlace, puedeReintentar }: { filas: FilaAviso[]; ver: 'todos' | 'fallidos'; pagina: unknown; enlace: Enlace; puedeReintentar: boolean }) {
  const fallidos = filas.filter((a) => a.estado === 'fallido')
  const lista = ver === 'fallidos' ? fallidos : filas
  const p = paginaDe(pagina, lista.length)
  return (
    <section className="max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <InfoBoton que="Qué es esta pantalla" texto="Cada aviso queda guardado con su resultado. Si falla, se reintenta solo cuando el fallo es pasajero; los que no tienen arreglo (por ejemplo, un compita sin Telegram vinculado) quedan aquí como Fallidos para que los reintentes o le escribas directamente." />
        <Link prefetch={false} href={enlace({ av_ver: null, av_pag: null })} aria-pressed={ver === 'todos'} className={clasesChip(ver === 'todos')}>Todos <span className="ml-1 opacity-70">{filas.length}</span></Link>
        <Link prefetch={false} href={enlace({ av_ver: 'fallidos', av_pag: null })} aria-pressed={ver === 'fallidos'} className={clasesChip(ver === 'fallidos')}>Fallidos <span className="ml-1 opacity-70">{fallidos.length}</span></Link>
      </div>
      <ul className={CLASE_LISTA}>
        {lista.slice(p.desde, p.hasta).map((a) => (
          <li key={a.id} className="flex items-start gap-3 px-3 py-2">
            <span className="mt-1.5"><PuntoUrgencia u={ESTADO[a.estado].u} texto={ESTADO[a.estado].t} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 text-sm"><b>{a.para}</b><span className="rounded bg-gris100 px-1.5 text-[11px] font-bold text-texto-medio">{ROL[a.rol]}</span><span className="text-xs text-texto-sutil">{a.canal === 'telegram' ? 'Telegram' : 'Correo'} · {cuandoLinea(a.creado)}</span></div>
              <div className="text-sm text-texto-medio">{nombreDePlantilla(a.plantilla)}</div>
              {a.estado === 'fallido' && <div className="text-xs font-bold text-rojo-oscuro">{a.error ?? 'No se pudo entregar'} · {a.intentos} {a.intentos === 1 ? 'intento' : 'intentos'}</div>}
            </div>
            {a.estado === 'fallido' && puedeReintentar && <BotonReintentar avisoId={a.id} />}
          </li>
        ))}
        {!lista.length && <li className="p-6 text-center text-texto-sutil">{ver === 'fallidos' ? 'No hay avisos fallidos.' : 'Todavía no se ha enviado ningún aviso.'}</li>}
      </ul>
      <Paginador resumen={`${lista.length} ${lista.length === 1 ? 'aviso' : 'avisos'}`} pag={p.pag} paginas={p.paginas} hrefAnterior={p.pag > 1 ? enlace({ av_pag: p.pag - 1 > 1 ? String(p.pag - 1) : null }) : null} hrefSiguiente={p.pag < p.paginas ? enlace({ av_pag: String(p.pag + 1) }) : null} />
    </section>
  )
}
