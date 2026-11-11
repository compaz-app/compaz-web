import Boton from '@/components/ui/base/Boton'
import Tarjeta from '@/components/ui/base/Tarjeta'
import type { BotonPortal, TarjetaPortal } from '@/lib/portal-estados'

// La tarjeta del estado actual del cliente: qué pasa, qué espera de él y un botón principal (a lo sumo uno más). Todo botón lleva su ⓘ.
// Los destinos que son una ACCIÓN (avisar el pago, confirmar el inicio...) se conectan en el siguiente paso de la migración: hasta entonces se
// ven apagados (la ruta /portal solo la ve el equipo en vista previa).
const TONO = { accion: 'destacada', espera: 'neutro', alerta: 'alerta' } as const

function BotonDelPortal({ b, principal, tono }: { b: BotonPortal; principal: boolean; tono: TarjetaPortal['tono'] }) {
  const variante = principal ? (tono === 'espera' ? 'secundario' : 'primario') : 'secundario'
  if ('ruta' in b.destino) return <Boton href={b.destino.ruta} variante={variante} info={b.info}>{b.texto}</Boton>
  return <Boton variante={variante} disabled info={`${b.info} (Se activa en el siguiente paso de la migración.)`}>{b.texto}</Boton>
}

export default function TarjetaEstado({ tarjeta, compita }: { tarjeta: TarjetaPortal; compita?: string | null }) {
  return (
    <Tarjeta tono={TONO[tarjeta.tono]}>
      {compita && (
        <div className="mb-3 flex items-center gap-3">
          <div aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-morado-medio text-xl font-extrabold text-blanco">{compita[0]?.toUpperCase()}</div>
          <div><div className="text-sm text-morado-sutil">Tu compita</div><div className="font-extrabold text-morado-profundo">{compita}</div></div>
        </div>
      )}
      <h2 className="text-2xl font-extrabold leading-tight text-morado-profundo">{tarjeta.titulo}</h2>
      <p className="mt-2 text-lg leading-snug text-morado-claro">{tarjeta.texto}</p>
      {(tarjeta.principal || tarjeta.secundario) && (
        <div className="mt-5 grid gap-3">
          {tarjeta.principal && <BotonDelPortal b={tarjeta.principal} principal tono={tarjeta.tono} />}
          {tarjeta.secundario && <BotonDelPortal b={tarjeta.secundario} principal={false} tono={tarjeta.tono} />}
        </div>
      )}
    </Tarjeta>
  )
}
