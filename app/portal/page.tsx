// Portal nuevo del cliente (por etapas reemplaza a /dashboard). Una sola tarjeta que dice dónde está y qué sigue, con la barra de 6 pasos.
// Hoy solo lo ve el equipo en vista previa de un cliente (?preview=<id>) mientras el ajuste `portal_nuevo` esté en 0.
import { redirect } from 'next/navigation'
import { requireAuth, getClienteActivo, isAdminEmail } from '@/lib/auth'
import { clienteVePortalNuevo } from '@/lib/portal-activacion'
import { accesoPortal, cargarPortal, refrescoRapido } from '@/lib/portal'
import Pasos from '@/components/ui/base/Pasos'
import Aviso from '@/components/ui/base/Aviso'
import TarjetaEstado from '@/components/portal/TarjetaEstado'
import NavPortal from '@/components/portal/NavPortal'
import SeccionVisitas from '@/components/portal/SeccionVisitas'
import SeccionCuenta from '@/components/portal/SeccionCuenta'
import AutoRefresh from '@/components/ui/AutoRefresh'
import UnaSolaPestana from '@/components/ui/UnaSolaPestana'
import NovedadesEnVivo from '@/components/ui/NovedadesEnVivo'
import { TarjetasProximamente } from '@/components/ui/Proximamente'
import VisitaWatcher from '@/components/ui/VisitaWatcher'
import { cargarDatosPortal } from '@/lib/portal-datos'
import { registrarAcceso } from '@/lib/alertas-admin'
import { ventanaVigente, marcarVentana } from '@/lib/cron'
import { pestanaDeSec, esParteCuenta } from '@/lib/portal-secciones'
import { contarNovedadesSinAbrir, marcarNovedadesAbiertas } from '@/lib/novedades'
import { contarMensajesSinLeer, marcarChatLeido } from '@/lib/portal-mensajes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi portal', robots: { index: false, follow: false } }

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ preview?: string; sec?: string }> }) {
  const session = await requireAuth()
  const { preview, sec } = await searchParams
  const pestana = pestanaDeSec(sec)
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
    const clavePrev = `preview_acceso:${session.user.id}:${preview}`
    // Anotar cada cambio de pestaña llenaría el registro: se anota una vez cada 30 minutos por persona y cliente, y la ventana solo se marca si la anotación salió bien.
    const anotado = (await ventanaVigente(clavePrev, 30 * 60_000)) || await registrarAcceso(`${session.user.email} abrió la vista previa del portal de ${portal.nombre || 'un cliente'}`, { categoria: 'acceso_contacto', entidad: { tipo: 'cliente', id: preview, nombre: portal.nombre || 'Cliente' } })
    if (!anotado) redirect('/panel')
    await marcarVentana(clavePrev)
  }
  // Círculo rojo de Visitas: lo nuevo que aún no abrió. Al entrar a Visitas se quita. El equipo en vista previa no marca nada (no es el cliente).
  let nuevasVisitas = 0
  if (!esAdmin) {
    if (pestana === 'visitas') await Promise.all([marcarNovedadesAbiertas(uid), marcarChatLeido(uid)])
    else nuevasVisitas = (await Promise.all([contarNovedadesSinAbrir(uid), contarMensajesSinLeer(uid)])).reduce((a, b) => a + b, 0)
  }
  const datos = pestana === 'inicio' ? null : await cargarDatosPortal(uid)
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 pb-24 pt-4 lg:max-w-2xl lg:pb-12">
      {esAdmin && <Aviso tono="advertencia">Vista previa del portal nuevo de {portal.nombre || 'este cliente'}. Los botones de acción no se ejecutan en la vista previa.</Aviso>}
      <header className="flex items-center justify-between">
        <span className="text-lg font-extrabold text-morado-medio">Compaz</span>
        <span className="text-base text-morado-claro">Hola, {portal.nombre.split(' ')[0] || 'bienvenido'}</span>
      </header>
      <NavPortal actual={pestana} preview={esAdmin ? preview : null} insignias={{ visitas: nuevasVisitas }} />
      {pestana !== 'inicio' && <TarjetaEstado tarjeta={portal.tarjeta} compita={null} visitaId={portal.estado.visitaId} estado={portal.estado.codigo} vistaPrevia={esAdmin} />}
      {pestana === 'inicio' && (
        <>
          <Pasos pasos={portal.pasos} actual={portal.estado.paso} />
          <TarjetaEstado tarjeta={portal.tarjeta} compita={portal.compita} visitaId={portal.estado.visitaId} estado={portal.estado.codigo} vistaPrevia={esAdmin} />
          <details className="group rounded-2xl border border-borde bg-blanco px-4 py-1">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-base font-extrabold text-morado-claro [&::-webkit-details-marker]:hidden">Pronto en Compaz<span aria-hidden className="text-morado-sutil group-open:rotate-90">▸</span></summary>
            <div className="pb-3"><TarjetasProximamente grande={false} ids={['voluntariado', 'mascotas']} /></div>
          </details>
        </>
      )}
      {datos && pestana === 'visitas' && <SeccionVisitas d={datos} vistaPrevia={esAdmin} />}
      {datos && pestana === 'cuenta' && <SeccionCuenta d={datos} vistaPrevia={esAdmin} pedida={esParteCuenta(sec) ? sec : null} />}
      {!esAdmin && <VisitaWatcher usuarioId={uid} visitaActivaId={portal.estado.visitaId ?? null} compitaNombre={portal.compita ?? undefined} />}
      {!esAdmin && <UnaSolaPestana />}
      {!esAdmin && <NovedadesEnVivo usuarioId={uid} />}
      {!esAdmin && <AutoRefresh intervaloSeg={15} rapido={refrescoRapido(portal.estado)} reposoSeg={90} />}
    </main>
  )
}
