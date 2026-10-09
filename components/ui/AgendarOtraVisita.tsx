'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors } from '@/lib/design'

interface Props {
  compitaNombre: string
}

export default function AgendarOtraVisita({ compitaNombre }: Props) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function agendar() {
    if (cargando) return
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/visita/nueva', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        router.refresh()
      } else {
        setError(data.error ?? 'No se pudo agendar la visita.')
        setCargando(false)
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setCargando(false)
    }
  }

  return (
    <div style={{ background: colors.blanco, border: `2px solid ${colors.fondoCard}`, borderRadius: '16px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
      <div style={{ flex: '1 1 240px' }}>
        <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '17px', color: colors.moradoMedio, margin: '0 0 4px' }}>
          ¿Quieres otra visita con {compitaNombre}?
        </p>
        <p style={{ color: colors.textoMedio, fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
          Abre el chat con {compitaNombre} para ponerse de acuerdo en la fecha y la hora.
        </p>
        {error && <p style={{ color: colors.rojo, fontSize: '13px', margin: '8px 0 0' }}>{error}</p>}
      </div>
      <button
        onClick={agendar}
        disabled={cargando}
        style={{
          background: colors.naranja, color: colors.blanco, border: 'none', borderRadius: '9999px',
          padding: '14px 28px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '15px',
          cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.6 : 1, minWidth: '200px',
        }}
      >
        {cargando ? 'Agendando…' : 'Agendar otra visita'}
      </button>
    </div>
  )
}
