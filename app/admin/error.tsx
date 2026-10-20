'use client'

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', border: '2px solid #fca5a5', borderRadius: '24px', padding: '40px 32px', maxWidth: '520px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px', marginBottom: '12px' }}>
          Error al cargar el dashboard
        </h2>
        <p style={{ color: '#4A3B6B', fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: 1.6, marginBottom: '8px' }}>
          {error.message ?? 'Ocurrió un error inesperado.'}
        </p>
        <button
          onClick={reset}
          style={{ background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '12px 28px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '15px', cursor: 'pointer', marginTop: '16px' }}
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
