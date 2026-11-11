import Boton from '@/components/ui/base/Boton'
import Tarjeta from '@/components/ui/base/Tarjeta'
import AccionPortal from '@/components/portal/AccionPortal'
import type { BotonPortal, TarjetaPortal } from '@/lib/portal-estados'

// La tarjeta del estado actual del cliente: qué pasa, qué espera de él y un botón principal (a lo sumo uno más). Todo botón lleva su ⓘ.
// Los destinos que son una RUTA son enlaces; los que son una ACCIÓN (avisar el pago, confirmar el inicio...) ejecutan la llamada real (AccionPortal).
const TONO = { accion: 'destacada', espera: 'neutro', alerta: 'alerta' } as const

function BotonDelPortal({ b, principal, tono, visitaId, estado, vistaPrevia }: { b: BotonPortal; principal: boolean; tono: TarjetaPortal['tono']; visitaId?: string; estado?: string; vistaPrevia?: boolean }) {
  const variante = principal ? (tono === 'espera' ? 'secundario' : 'primario') : 'secundario'
  if ('ruta' in b.destino) return <Boton href={b.destino.ruta} variante={variante} info={b.info}>{b.texto}</Boton>
  // El equipo mira el portal de un cliente: ahí los botones de acción NO se ejecutan (actuarían con la sesión del equipo, no con la del cliente).
  if (vistaPrevia) return <Boton variante={variante} disabled info={`${b.info} (En la vista previa del equipo no se ejecuta.)`}>{b.texto}</Boton>
  return <AccionPortal accion={b.destino.accion} texto={b.texto} info={b.info} variante={variante} visitaId={visitaId} estado={estado} />
}

export default function TarjetaEstado({ tarjeta, compita, visitaId, estado, vistaPrevia }: { tarjeta: TarjetaPortal; compita?: string | null; visitaId?: string; estado?: string; vistaPrevia?: boolean }) {
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
          {tarjeta.principal && <BotonDelPortal b={tarjeta.principal} principal tono={tarjeta.tono} visitaId={visitaId} estado={estado} vistaPrevia={vistaPrevia} />}
          {tarjeta.secundario && <BotonDelPortal b={tarjeta.secundario} principal={false} tono={tarjeta.tono} visitaId={visitaId} estado={estado} vistaPrevia={vistaPrevia} />}
        </div>
      )}
    </Tarjeta>
  )
}
