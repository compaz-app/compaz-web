import { notFound } from 'next/navigation'
import { getSolicitudPorToken } from '@/lib/solicitudes'
import SalaEntrevista from './SalaEntrevista'
import { firmaRol, rolValido } from '@/lib/links'

function formatSlotVE(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default async function SalaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ quien?: string; s?: string }>
}) {
  const { token } = await params
  const { quien: quienParam, s: sigParam } = await searchParams
  // El rol viene firmado en el enlace: sin firma válida no hay acceso (evita suplantar a la otra parte)
  if (!rolValido(token, quienParam ?? null, sigParam ?? null)) notFound()
  const quien = quienParam === 'compita' ? 'compita' : 'cliente'

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud || !solicitud.slot_confirmado) notFound()
  if (!solicitud.room_url) {
    return (
      <div style={{ fontFamily: 'Inter,sans-serif', background: '#FDFAF6', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '24px', padding: '40px 32px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', marginBottom: '12px' }}>Sala aún no lista</h2>
          <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: 1.6 }}>
            Recibirás un link por email o Telegram cuando la sala esté lista. Si ya lo tienes, intenta recargar la página.
          </p>
        </div>
      </div>
    )
  }

  const { createAdminSupabase } = await import('@/lib/supabase-server')
  const admin = createAdminSupabase()

  const [{ data: clienteRow }, { data: compitaRow }] = await Promise.all([
    admin.from('usuarios').select('nombre').eq('id', solicitud.cliente_id).single(),
    admin.from('compitas').select('nombre').eq('id', solicitud.compita_id!).single(),
  ])

  return (
    <SalaEntrevista
      token={token}
      quien={quien}
      roomUrl={solicitud.room_url}
      compitaNombre={compitaRow?.nombre ?? solicitud.compita_nombre ?? 'Compita'}
      clienteNombre={clienteRow?.nombre ?? 'Cliente'}
      slotLabel={formatSlotVE(solicitud.slot_confirmado)}
      sig={firmaRol(token, quien)}
    />
  )
}
