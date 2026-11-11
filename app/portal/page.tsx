// Portal nuevo del cliente (por etapas reemplaza a /dashboard). Una sola tarjeta que dice dónde está y qué sigue, con la barra de 6 pasos.
// Hoy solo lo ve el equipo en vista previa de un cliente (?preview=<id>) mientras el ajuste `portal_nuevo` esté en 0.
import { redirect } from 'next/navigation'
import { requireAuth, getClienteActivo, isAdminEmail } from '@/lib/auth'
import { getAjustes } from '@/lib/ajustes'
import { accesoPortal, cargarPortal } from '@/lib/portal'
import Pasos from '@/components/ui/base/Pasos'
import Aviso from '@/components/ui/base/Aviso'
import TarjetaEstado from '@/components/portal/TarjetaEstado'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi portal', robots: { index: false, follow: false } }

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const session = await requireAuth()
  const { preview } = await searchParams
  const esAdmin = isAdminEmail(session.user.email ?? '')
  // Cliente bloqueado o eliminado: fuera, aunque su sesión siga vigente.
  if (!esAdmin && !(await getClienteActivo())) redirect('/login?error=bloqueado')
  const activo = Number((await getAjustes()).portal_nuevo) === 1
  const acceso = accesoPortal({ esAdmin, previewUid: preview ?? null, portalNuevoActivo: activo })
  if (acceso === 'admin') redirect('/admin')
  if (acceso === 'viejo') redirect('/dashboard')

  const portal = await cargarPortal(esAdmin && preview ? preview : session.user.id)
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 pb-12 pt-4 lg:max-w-2xl">
      {esAdmin && <Aviso tono="advertencia">Vista previa del portal nuevo de {portal.nombre || 'este cliente'}. Los botones de acción se conectan en el siguiente paso.</Aviso>}
      <header className="flex items-center justify-between">
        <span className="text-lg font-extrabold text-morado-medio">Compaz</span>
        <span className="text-base text-morado-claro">Hola, {portal.nombre.split(' ')[0] || 'bienvenido'}</span>
      </header>
      <Pasos pasos={portal.pasos} actual={portal.estado.paso} />
      <TarjetaEstado tarjeta={portal.tarjeta} compita={portal.compita} />
    </main>
  )
}
