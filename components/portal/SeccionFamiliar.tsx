import PerfilFamiliar from '@/components/ui/PerfilFamiliar'
import PrimerAccesoModal from '@/components/ui/PrimerAccesoModal'
import Tarjeta from '@/components/ui/base/Tarjeta'
import { fichaCompleta } from '@/lib/ficha'
import type { DatosPortal } from '@/lib/portal-datos'

// Mi familiar: la ficha de la persona cuidada. Si falta (o faltan los términos) se pide completa; solo la ve su compita.
export default function SeccionFamiliar({ d, vistaPrevia }: { d: DatosPortal; vistaPrevia: boolean }) {
  if (!d.usuario) return null
  return (
    <div className="space-y-4">
      {!vistaPrevia && !fichaCompleta(d.usuario) && <PrimerAccesoModal />}
      <Tarjeta>
        <h2 className="text-xl font-extrabold text-morado-profundo">Mi familiar</h2>
        <p className="mt-1 text-lg text-morado-claro">Esto le ayuda a tu compita a conocer a tu familiar antes de visitarlo. Solo lo ve tu compita.</p>
      </Tarjeta>
      <PerfilFamiliar usuario={d.usuario} readonly={vistaPrevia} />
    </div>
  )
}
