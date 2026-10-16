'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  compitaNombre: string
  tieneFecha: boolean
}

export default function PreVisitaActions({ compitaNombre, tieneFecha }: Props) {
  const router = useRouter()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function scrollAFecha() {
    document.getElementById('fecha-programada')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function confirmarCancelacion() {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/visita/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje }),
      })
      if (res.ok) {
        setModalAbierto(false)
        router.refresh()
      } else {
        const d = await res.json()
        setError(d.error ?? 'No se pudo cancelar. Inténtalo de nuevo.')
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      {!tieneFecha && (
        <div style={{ marginTop: '16px', background: '#FFFBF0', border: '2px solid #FCD34D', borderRadius: '16px', padding: '20px' }}>
          <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, color: '#92400E', fontSize: '15px', margin: '0 0 6px' }}>
            ⚠️ Falta registrar la fecha en el sistema
          </p>
          <p style={{ color: '#78350F', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
            Acuerda la fecha con {compitaNombre} en el chat y luego ingrésala arriba. No basta con hablar de la fecha en el chat — tiene que quedar registrada para que Compaz active el seguimiento y te mande el recordatorio.
          </p>
          <button
            onClick={scrollAFecha}
            style={{ background: '#D97706', color: 'white', border: 'none', borderRadius: '9999px', padding: '12px 24px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
          >
            📅 Ingresar la fecha →
          </button>
        </div>
      )}

      <div style={{ marginTop: '12px', textAlign: 'right' }}>
        <button
          onClick={() => { setModalAbierto(true); setMensaje(''); setError(null) }}
          style={{ background: 'none', border: 'none', color: '#9B8AB8', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
        >
          Cancelar esta visita
        </button>
      </div>

      {modalAbierto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,60,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: '20px', color: '#1A0A3C', margin: '0 0 8px' }}>
              ¿Cancelar la visita?
            </h2>
            <p style={{ color: '#6B5C90', fontSize: '14px', margin: '0 0 24px', lineHeight: 1.6 }}>
              {compitaNombre} será notificado. Esta acción no se puede deshacer.
            </p>

            <label style={{ display: 'block', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', color: '#4A3B6B', marginBottom: '8px' }}>
              Mensaje para {compitaNombre} <span style={{ fontWeight: 400, color: '#9B8AB8' }}>(opcional)</span>
            </label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Ej: surgió un imprevisto, lo reagendamos pronto…"
              maxLength={500}
              rows={3}
              style={{ width: '100%', borderRadius: '12px', border: '2px solid #E8E0D4', padding: '12px', fontSize: '14px', fontFamily: 'Inter, sans-serif', resize: 'vertical', boxSizing: 'border-box', outline: 'none', color: '#1A0A3C' }}
            />

            {error && (
              <p style={{ color: '#DC2626', fontSize: '13px', marginTop: '8px' }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={confirmarCancelacion}
                disabled={cargando}
                style={{ flex: 1, background: '#DC2626', color: 'white', border: 'none', borderRadius: '9999px', padding: '14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '15px', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1 }}
              >
                {cargando ? 'Cancelando…' : 'Sí, cancelar visita'}
              </button>
              <button
                onClick={() => setModalAbierto(false)}
                disabled={cargando}
                style={{ flex: 1, background: '#F5F0FF', color: '#4A3B6B', border: 'none', borderRadius: '9999px', padding: '14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
