'use client'

import { useState } from 'react'

interface Props {
  visitaId: string
  compitaNombre: string
  estrellas: number
  yaComento: boolean
  token: string
}

export default function FeedbackForm({ visitaId, compitaNombre, estrellas, yaComento, token }: Props) {
  const [comentario, setComentario] = useState('')
  const [quiereResena, setQuiereResena] = useState(false)
  const [enviado, setEnviado] = useState(yaComento)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const MENSAJES: Record<number, string> = {
    1: 'Gracias por tu honestidad. Vamos a revisarlo para mejorar.',
    2: 'Gracias por contarnos. Tu opinión nos ayuda a mejorar el servicio.',
    3: 'Gracias por tu calificación.',
    4: '¡Nos alegra saber que estuvo bien!',
    5: '¡Nos alegra mucho saberlo! Tu compita está haciendo un gran trabajo. 💙',
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!comentario.trim()) return
    setGuardando(true)
    setError('')
    try {
      const res = await fetch(`/api/visita/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visita_id: visitaId, comentario: comentario.trim(), quiere_resena: quiereResena, t: token }),
      })
      if (res.ok) {
        setEnviado(true)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'No pudimos guardar tu comentario. Intenta de nuevo.')
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setGuardando(false)
  }

  const card: React.CSSProperties = {
    fontFamily: 'Inter, sans-serif',
    background: 'white',
    border: '2px solid #E8E0D4',
    borderRadius: '24px',
    padding: '40px 32px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
  }

  if (enviado) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={card}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>{'⭐'.repeat(estrellas)}</div>
          <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', margin: '0 0 12px' }}>¡Gracias por tu comentario!</h2>
          <p style={{ color: '#4A3B6B', lineHeight: '1.6', fontSize: '15px', marginBottom: '24px' }}>{MENSAJES[estrellas]}</p>
          {quiereResena && (
            <p style={{ color: '#6B5C90', fontSize: '13px', marginBottom: '20px' }}>
              Tu reseña será revisada y publicada en el perfil de {compitaNombre} pronto.
            </p>
          )}
          <a href="/dashboard" style={{ display: 'inline-block', background: '#FF6B2B', color: 'white', padding: '14px 28px', borderRadius: '9999px', textDecoration: 'none', fontWeight: 800, fontSize: '16px' }}>
            Ir al dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={card}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>{'⭐'.repeat(estrellas)}</div>
        <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', margin: '0 0 8px' }}>
          {MENSAJES[estrellas]}
        </h2>
        <p style={{ color: '#6B5C90', fontSize: '15px', marginBottom: '24px' }}>
          ¿Quieres contarnos algo más sobre la visita con <strong>{compitaNombre}</strong>?
        </p>

        <form onSubmit={enviar} style={{ textAlign: 'left' }}>
          <label style={{ display: 'block', color: '#2D1464', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Tu comentario (opcional)
          </label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="¿Cómo estuvo la visita? ¿Hay algo que mejorar?"
            maxLength={600}
            rows={4}
            style={{
              width: '100%', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px',
              padding: '12px 16px', fontSize: '15px', fontFamily: 'Inter, sans-serif',
              color: '#1A0A3C', resize: 'vertical', boxSizing: 'border-box', outline: 'none',
            }}
          />
          <p style={{ color: '#9B8AB8', fontSize: '12px', textAlign: 'right', margin: '4px 0 16px' }}>
            {comentario.length}/600
          </p>

          {comentario.trim().length > 10 && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '20px', color: '#4A3B6B', fontSize: '14px', lineHeight: '1.5' }}>
              <input
                type="checkbox"
                checked={quiereResena}
                onChange={(e) => setQuiereResena(e.target.checked)}
                style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#2D1464', flexShrink: 0 }}
              />
              Publicar este comentario como reseña en el perfil de {compitaNombre}
            </label>
          )}

          {error && <p style={{ color: '#E05520', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={guardando || !comentario.trim()}
              style={{
                flex: 1, background: comentario.trim() ? '#2D1464' : '#E8E0D4',
                color: 'white', border: 'none', borderRadius: '9999px',
                padding: '14px 20px', fontWeight: 800, fontSize: '15px', cursor: comentario.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {guardando ? 'Guardando…' : 'Enviar comentario'}
            </button>
            <a
              href="/dashboard"
              style={{
                flex: 1, background: 'none', border: '2px solid #D4C9E8', color: '#4A3B6B',
                borderRadius: '9999px', padding: '14px 20px', fontWeight: 700, fontSize: '15px',
                textDecoration: 'none', textAlign: 'center',
              }}
            >
              Saltar
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
