import { createAdminSupabase } from '@/lib/supabase-server'
import { feedbackValido } from '@/lib/links'
import FeedbackForm from './FeedbackForm'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ visitaId: string }>
  searchParams: Promise<{ t?: string; estrellas?: string }>
}

function ErrorPage({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '24px', padding: '40px 32px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', margin: '0 0 12px' }}>{titulo}</h2>
        <p style={{ color: '#4A3B6B', lineHeight: '1.6' }}>{texto}</p>
      </div>
    </div>
  )
}

export default async function FeedbackPage({ params, searchParams }: Props) {
  const { visitaId } = await params
  const { t, estrellas } = await searchParams

  if (!feedbackValido(visitaId, t ?? null)) {
    return <ErrorPage titulo="Enlace inválido" texto="Este enlace no es válido o ya expiró." />
  }

  const admin = createAdminSupabase()
  const { data: visita } = await admin
    .from('visitas')
    .select('id, estado, comentario_cliente, compita:compitas(nombre)')
    .eq('id', visitaId)
    .maybeSingle()

  if (!visita) notFound()
  if (visita!.estado !== 'terminada') {
    return <ErrorPage titulo="Visita no terminada" texto="Solo puedes dejar comentarios de visitas que ya terminaron." />
  }

  const compitaNombre = (visita!.compita as unknown as { nombre: string } | null)?.nombre ?? 'tu compita'
  const estrellasNum = Math.max(1, Math.min(5, parseInt(estrellas ?? '5', 10) || 5))

  return (
    <FeedbackForm
      visitaId={visitaId}
      compitaNombre={compitaNombre}
      estrellas={estrellasNum}
      yaComento={!!visita!.comentario_cliente}
      token={t ?? ''}
    />
  )
}
