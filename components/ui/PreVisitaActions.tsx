'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  visitaId: string
  compitaNombre: string
  fechaActual: string | null
}

export default function PreVisitaActions({ visitaId, compitaNombre, fechaActual }: Props) {
  const [cerrando, setCerrando] = useState(false)
  const [reagendando, setReagendando] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const tieneFecha = !!fechaActual

  function scrollAFecha() {
    document.getElementById('fecha-programada')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function confirmarCoordinacion() {
    if (!tieneFecha || cerrando) return
    setCerrando(true)
    setError('')
    try {
      const res = await fetch('/api/visita/cerrar-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visita_id: visitaId }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'No se pudo confirmar.')
        setCerrando(false)
      }
    } catch {
      setError('Error de conexión.')
      setCerrando(false)
    }
  }

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
    <div style={{ marginTop: '16px', background: tieneFecha ? '#F0FDF4' : '#FFFBF0', border: `2px solid ${tieneFecha ? '#86EFAC' : '#FCD34D'}`, borderRadius: '16px', padding: '20px' }}>
      {!tieneFecha ? (
        <>
          <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, color: '#92400E', fontSize: '15px', margin: '0 0 6px' }}>
            ⚠️ Falta registrar la fecha en el sistema
          </p>
          <p style={{ color: '#78350F', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
            Acuerda la fecha con {compitaNombre} en el chat y luego ingrésala arriba en el campo de fecha. No basta con hablar de la fecha en el chat: tiene que quedar registrada en el sistema para que Compaz pueda enviarte el recordatorio y activar el seguimiento de la visita.
          </p>
          <button
            onClick={scrollAFecha}
            style={{
              background: '#D97706',
              color: 'white',
              border: 'none',
              borderRadius: '9999px',
              padding: '12px 24px',
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            📅 Ingresar la fecha →
          </button>
        </>
      ) : (
        <>
          <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, color: '#15803d', fontSize: '15px', margin: '0 0 6px' }}>
            ✓ Fecha registrada. ¿Ya quedaron de acuerdo?
          </p>
          <p style={{ color: '#166534', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
            Si ya coordinaron todo con {compitaNombre}, confirma para cerrar esta etapa. El chat seguirá disponible por si surge algo antes de la visita.
          </p>
          {error && (
            <p style={{ color: '#E05520', fontSize: '13px', margin: '0 0 10px', fontFamily: 'Inter, sans-serif' }}>{error}</p>
          )}
          <button
            onClick={confirmarCoordinacion}
            disabled={cerrando}
            style={{
              background: cerrando ? '#D4C9E8' : '#2D1464',
              color: 'white',
              border: 'none',
              borderRadius: '9999px',
              padding: '14px 28px',
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              cursor: cerrando ? 'not-allowed' : 'pointer',
              marginBottom: '10px',
              width: '100%',
            }}
          >
            {cerrando ? 'Confirmando…' : '¡Listo, ya acordamos todo! →'}
          </button>
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
              width: '100%',
            }}
          >
            {reagendando ? 'Reagendando…' : '🔄 Necesito cambiar la fecha'}
          </button>
        </>
      )}
    </div>
  )
}
