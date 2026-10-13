'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfirmarInicioVisita({ visitaId, compitaNombre }: { visitaId: string; compitaNombre: string }) {
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function confirmar() {
    setConfirmando(true)
    setError('')
    try {
      const res = await fetch('/api/visita/confirmar-inicio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitaId }),
      })
      const data = await res.json()
      if (data.ok) {
        router.refresh()
      } else {
        setError(data.error ?? 'Error al confirmar. Intenta de nuevo.')
        setConfirmando(false)
      }
    } catch {
      setError('Error de conexión.')
      setConfirmando(false)
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
      border: '3px solid #22c55e',
      borderRadius: '20px',
      padding: '32px 28px',
      marginBottom: '20px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚪</div>
      <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px', color: '#15803d', margin: '0 0 8px' }}>
        {compitaNombre} ya llegó
      </h3>
      <p style={{ color: '#166534', fontSize: '15px', margin: '0 0 24px', lineHeight: 1.6 }}>
        Confirma que está en la puerta para que empiece la visita.
      </p>
      {error && (
        <p style={{ color: '#E05520', fontSize: '14px', marginBottom: '12px' }}>{error}</p>
      )}
      <button
        onClick={confirmar}
        disabled={confirmando}
        style={{
          background: confirmando ? '#86EFAC' : '#22c55e',
          color: 'white',
          border: 'none',
          borderRadius: '9999px',
          padding: '16px 40px',
          fontSize: '18px',
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontWeight: 800,
          cursor: confirmando ? 'not-allowed' : 'pointer',
          width: '100%',
          maxWidth: '360px',
          transition: 'background 0.15s',
        }}
      >
        {confirmando ? 'Confirmando…' : `✅ Sí, ${compitaNombre} ya llegó`}
      </button>
      <p style={{ color: '#4A7C59', fontSize: '12px', marginTop: '12px', margin: '12px 0 0' }}>
        Si no confirmas en 5 minutos la visita arranca automáticamente.
      </p>
    </div>
  )
}
