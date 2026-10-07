import { redirect } from 'next/navigation'
import { validarTokenPerfil } from '@/lib/compita-tokens'
import { getCompitaAdminById } from '@/lib/compitas'
import EditarPerfil from './EditarPerfil'

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function CompitaPerfilPage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return (
      <main style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontSize: 48, margin: '0 0 16px' }}>🔗</p>
          <h1 style={{ color: '#1A0A3C', fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Enlace no válido</h1>
          <p style={{ color: '#4A3B6B', fontSize: 16, lineHeight: 1.6 }}>
            Para editar tu perfil, escribe <strong>/perfil</strong> en Telegram y usa el enlace que te enviamos.
          </p>
        </div>
      </main>
    )
  }

  const compitaId = await validarTokenPerfil(token)
  if (!compitaId) {
    return (
      <main style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontSize: 48, margin: '0 0 16px' }}>⏳</p>
          <h1 style={{ color: '#1A0A3C', fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Enlace inválido o expirado</h1>
          <p style={{ color: '#4A3B6B', fontSize: 16, lineHeight: 1.6 }}>
            Este enlace ya fue usado o expiró. Escribe <strong>/perfil</strong> en Telegram para obtener uno nuevo.
          </p>
        </div>
      </main>
    )
  }

  const compita = await getCompitaAdminById(compitaId)
  if (!compita) redirect('/')

  return (
    <main style={{ minHeight: '100vh', background: '#FDFAF6', padding: '24px 16px 64px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <p style={{ color: '#6B5C90', fontSize: 14, margin: '0 0 4px' }}>Compaz</p>
          <h1 style={{ color: '#1A0A3C', fontSize: 26, fontWeight: 800, margin: 0 }}>Mi perfil</h1>
          <p style={{ color: '#4A3B6B', fontSize: 15, margin: '8px 0 0' }}>
            Edita tu información. Los cambios se publican de inmediato.
          </p>
        </div>
        <EditarPerfil
          token={token}
          inicial={{
            nombre: compita.nombre ?? '',
            zona: compita.zona ?? '',
            descripcion: compita.descripcion ?? '',
            servicios: compita.servicios ?? [],
            youtube_url: compita.youtube_url ?? '',
            foto_url: compita.foto_url ?? '',
            horarios_disponibles: compita.horarios_disponibles ?? [],
          }}
        />
      </div>
    </main>
  )
}
