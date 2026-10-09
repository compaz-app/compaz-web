'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors } from '@/lib/design'
import { PRECIO_HORA_EXTRA_USD, HORAS_MINIMAS_EXTRA } from '@/lib/planes'

interface Props {
  compitaNombre: string
  /** Cupo del plan: null = sin límite registrado */
  cupo?: { limite: number; usadas: number; restantes: number; planNombre: string; renueva: string | null; vence: string | null } | null
}

export default function AgendarOtraVisita({ compitaNombre, cupo }: Props) {
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

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })

  if (cupo && cupo.restantes <= 0) {
    return (
      <div style={{ background: colors.fondoClaro, border: `2px solid ${colors.fondoCard}`, borderRadius: '16px', padding: '20px 24px' }}>
        <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '17px', color: colors.moradoMedio, margin: '0 0 6px' }}>
          Ya no te quedan visitas disponibles
        </p>
        <p style={{ color: colors.textoMedio, fontSize: '14px', margin: '0 0 6px', lineHeight: 1.5 }}>
          Para seguir con {compitaNombre}, paga tu siguiente mes por <strong>Zelle</strong> o transferencia escribiéndonos a <strong>hola@micompaz.com</strong>.
          {cupo.renueva ? ` Tu próximo pago corresponde desde el ${fmt(cupo.renueva)}.` : ''}
        </p>
        <p style={{ color: colors.textoSutil, fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
          ¿Solo necesitas una visita más? La visita extra cuesta ${PRECIO_HORA_EXTRA_USD} por hora, con un mínimo de {HORAS_MINIMAS_EXTRA} horas.
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: colors.blanco, border: `2px solid ${colors.fondoCard}`, borderRadius: '16px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
      <div style={{ flex: '1 1 240px' }}>
        <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '17px', color: colors.moradoMedio, margin: '0 0 4px' }}>
          ¿Quieres otra visita con {compitaNombre}?
        </p>
        <p style={{ color: colors.textoMedio, fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
          Abre el chat con {compitaNombre} para ponerse de acuerdo en la fecha y la hora.
          {cupo ? ` Te quedan ${cupo.restantes} de ${cupo.limite} visitas${cupo.vence ? `; úsalas antes del ${fmt(cupo.vence)}` : ''}.` : ''}
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
