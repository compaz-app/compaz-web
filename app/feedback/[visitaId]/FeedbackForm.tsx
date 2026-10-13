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
  const [resena, setResena] = useState('')        // va al perfil público del compita
  const [notaInterna, setNotaInterna] = useState('') // va solo a Compaz (privado)
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
    if (!resena.trim() && !notaInterna.trim()) return
    setGuardando(true)
    setError('')
    try {
      const res = await fetch(`/api/visita/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visita_id: visitaId,
          comentario: resena.trim(),
          quiere_resena: resena.trim().length > 0,
          nota_interna: notaInterna.trim(),
          t: token,
        }),
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
    maxWidth: '520px',
    width: '100%',
    textAlign: 'center',
  }

  if (enviado) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={card}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>{'⭐'.repeat(estrellas)}</div>
          <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', margin: '0 0 12px' }}>¡Gracias!</h2>
          <p style={{ color: '#4A3B6B', lineHeight: '1.6', fontSize: '15px', marginBottom: '24px' }}>{MENSAJES[estrellas]}</p>
          {resena.trim() && (
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

  const textareaStyle: React.CSSProperties = {
    width: '100%', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px',
    padding: '12px 16px', fontSize: '15px', fontFamily: 'Inter, sans-serif',
    color: '#1A0A3C', resize: 'vertical', boxSizing: 'border-box', outline: 'none',
  }

  const tieneAlgo = resena.trim().length > 0 || notaInterna.trim().length > 0

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={card}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>{'⭐'.repeat(estrellas)}</div>
        <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', margin: '0 0 8px' }}>
          {MENSAJES[estrellas]}
        </h2>
        <p style={{ color: '#6B5C90', fontSize: '15px', marginBottom: '28px' }}>
          ¿Quieres dejarnos algo por escrito sobre la visita con <strong>{compitaNombre}</strong>?
        </p>

        <form onSubmit={enviar} style={{ textAlign: 'left' }}>

          {/* Reseña pública */}
          <div style={{ background: '#F5F0FF', border: '2px solid #D4C9E8', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '18px' }}>🌐</span>
              <span style={{ color: '#2D1464', fontWeight: 800, fontSize: '14px', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                Reseña pública
              </span>
              <span style={{ background: '#7C4DFF', color: 'white', borderRadius: '9999px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>
                Se publica en el perfil de {compitaNombre}
              </span>
            </div>
            <p style={{ color: '#6B5C90', fontSize: '13px', margin: '0 0 10px', lineHeight: 1.5 }}>
              La verán otras familias al buscar compitas. <strong style={{ color: '#2D1464' }}>Ayuda a {compitaNombre} a conseguir más trabajo.</strong>
            </p>
            <textarea
              value={resena}
              onChange={(e) => setResena(e.target.value)}
              placeholder={`¿Cómo fue la experiencia con ${compitaNombre}? ¿Lo recomendarías?`}
              maxLength={600}
              rows={3}
              style={textareaStyle}
            />
            <p style={{ color: '#9B8AB8', fontSize: '12px', textAlign: 'right', margin: '4px 0 0' }}>{resena.length}/600</p>
          </div>

          {/* Nota interna */}
          <div style={{ background: '#FFFBEB', border: '2px solid #FCD34D', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '18px' }}>🔒</span>
              <span style={{ color: '#92400E', fontWeight: 800, fontSize: '14px', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                Nota privada para Compaz
              </span>
              <span style={{ background: '#F59E0B', color: 'white', borderRadius: '9999px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>
                Solo la ve el equipo
              </span>
            </div>
            <p style={{ color: '#78350F', fontSize: '13px', margin: '0 0 10px', lineHeight: 1.5 }}>
              Solo la lee el equipo de Compaz. No aparece en ningún perfil ni se comparte con {compitaNombre}.
            </p>
            <textarea
              value={notaInterna}
              onChange={(e) => setNotaInterna(e.target.value)}
              placeholder="Sugerencias, inquietudes, o algo que quieras comunicarnos a nosotros…"
              maxLength={600}
              rows={3}
              style={{ ...textareaStyle, border: '2px solid rgba(245,158,11,0.4)' }}
            />
            <p style={{ color: '#B45309', fontSize: '12px', textAlign: 'right', margin: '4px 0 0' }}>{notaInterna.length}/600</p>
          </div>

          {error && <p style={{ color: '#E05520', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={guardando || !tieneAlgo}
              style={{
                flex: 1, background: tieneAlgo ? '#2D1464' : '#E8E0D4',
                color: 'white', border: 'none', borderRadius: '9999px',
                padding: '14px 20px', fontWeight: 800, fontSize: '15px',
                cursor: tieneAlgo ? 'pointer' : 'not-allowed',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {guardando ? 'Guardando…' : 'Enviar'}
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
