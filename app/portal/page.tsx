// Portal nuevo del cliente (por etapas reemplaza a /dashboard). Una sola tarjeta que dice dónde está y qué sigue, con la barra de 6 pasos.
// Hoy solo lo ve el equipo en vista previa de un cliente (?preview=<id>) mientras el ajuste `portal_nuevo` esté en 0.
import { redirect } from 'next/navigation'
import { requireAuth, getClienteActivo, isAdminEmail } from '@/lib/auth'
import { clienteVePortalNuevo } from '@/lib/portal-activacion'
import { accesoPortal, cargarPortal } from '@/lib/portal'
import Pasos from '@/components/ui/base/Pasos'
import Aviso from '@/components/ui/base/Aviso'
import TarjetaEstado from '@/components/portal/TarjetaEstado'
import NavPortal from '@/components/portal/NavPortal'
import SeccionVisitas from '@/components/portal/SeccionVisitas'
import SeccionFamiliar from '@/components/portal/SeccionFamiliar'
import SeccionPlan from '@/components/portal/SeccionPlan'
import AutoRefresh from '@/components/ui/AutoRefresh'
import VisitaWatcher from '@/components/ui/VisitaWatcher'
import { cargarDatosPortal } from '@/lib/portal-datos'
import { alertaAdmin } from '@/lib/alertas-admin'
import { esPestana } from '@/lib/portal-secciones'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi portal', robots: { index: false, follow: false } }

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ preview?: string; sec?: string }> }) {
  const session = await requireAuth()
  const { preview, sec } = await searchParams
  const pestana = esPestana(sec) ? sec : 'inicio'
  const esAdmin = isAdminEmail(session.user.email ?? '')
  // Cliente bloqueado o eliminado: fuera, aunque su sesión siga vigente.
  if (!esAdmin && !(await getClienteActivo())) redirect('/login?error=bloqueado')
  const activo = esAdmin ? false : await clienteVePortalNuevo(session.user.id)
  const acceso = accesoPortal({ esAdmin, previewUid: preview ?? null, portalNuevoActivo: activo })
  if (acceso === 'admin') redirect('/panel')
  if (acceso === 'viejo') redirect('/dashboard')

  const uid = esAdmin && preview ? preview : session.user.id
  const portal = await cargarPortal(uid)
  // Ver el portal de otro cliente es un acceso a sus datos: queda anotado ANTES de mostrarlo y, si no se puede anotar, no se muestra.
  if (esAdmin && preview) {
    const anotado = await alertaAdmin('actividad', `${session.user.email} abrió la vista previa del portal de ${portal.nombre || 'un cliente'}`, { categoria: 'acceso_contacto', entidad: { tipo: 'cliente', id: preview, nombre: portal.nombre || 'Cliente' } })
    if (!anotado) redirect('/panel')
  }
  const datos = pestana === 'inicio' ? null : await cargarDatosPortal(uid)
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 pb-24 pt-4 lg:max-w-2xl lg:pb-12">
      {esAdmin && <Aviso tono="advertencia">Vista previa del portal nuevo de {portal.nombre || 'este cliente'}. Los botones de acción no se ejecutan en la vista previa.</Aviso>}
      <header className="flex items-center justify-between">
        <span className="text-lg font-extrabold text-morado-medio">Compaz</span>
        <span className="text-base text-morado-claro">Hola, {portal.nombre.split(' ')[0] || 'bienvenido'}</span>
      </header>
      <NavPortal actual={pestana} preview={esAdmin ? preview : null} />
      {pestana === 'inicio' && (
        <>
          <Pasos pasos={portal.pasos} actual={portal.estado.paso} />
          <TarjetaEstado tarjeta={portal.tarjeta} compita={portal.compita} visitaId={portal.estado.visitaId} estado={portal.estado.codigo} vistaPrevia={esAdmin} />
        </>
      )}
      {datos && pestana === 'visitas' && <SeccionVisitas d={datos} vistaPrevia={esAdmin} />}
      {datos && pestana === 'familiar' && <SeccionFamiliar d={datos} vistaPrevia={esAdmin} />}
      {datos && pestana === 'plan' && <SeccionPlan d={datos} vistaPrevia={esAdmin} />}
      {!esAdmin && <VisitaWatcher usuarioId={uid} visitaActivaId={portal.estado.visitaId ?? null} compitaNombre={portal.compita ?? undefined} />}
      {!esAdmin && <AutoRefresh intervaloSeg={15} />}
    </main>
  )
}
