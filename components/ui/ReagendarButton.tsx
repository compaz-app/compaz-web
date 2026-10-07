'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  visitaId: string
  compitaNombre: string
}

export default function ReagendarButton({ visitaId, compitaNombre }: Props) {
  const [reagendando, setReagendando] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function reagendar() {
    if (reagendando) return
    setReagendando(true)
    setError('')
    try {
      const res = await fetch('/api/visita/reagendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visita_id: visitaId }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'No se pudo reagendar.')
        setReagendando(false)
      }
    } catch {
      setError('Error de conexión.')
      setReagendando(false)
    }
  }

  return (
    <div style={{ marginTop: '16px' }}>
      {error && (
        <p style={{ color: '#E05520', fontSize: '13px', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>{error}</p>
      )}
      <button
        onClick={reagendar}
        disabled={reagendando}
        style={{
          background: 'none',
          color: '#6B5C90',
          border: '1.5px solid #D4C9E8',
          borderRadius: '9999px',
          padding: '10px 20px',
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontWeight: 700,
          fontSize: '13px',
          cursor: reagendando ? 'not-allowed' : 'pointer',
          opacity: reagendando ? 0.6 : 1,
        }}
      >
        {reagendando ? 'Reagendando…' : `🔄 Necesito cambiar la fecha con ${compitaNombre}`}
      </button>
    </div>
  )
}
