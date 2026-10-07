'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  visitaId: string
  fechaActual: string | null
  horaInicioActual: string | null
  horaFinActual: string | null
  compitaNombre: string
}

export default function FechaProgramada({ visitaId, fechaActual, horaInicioActual, horaFinActual, compitaNombre }: Props) {
  const hoy = new Date().toISOString().split('T')[0]
  const [fecha, setFecha] = useState(fechaActual ?? '')
  const [horaInicio, setHoraInicio] = useState(horaInicioActual ?? '')
  const [horaFin, setHoraFin] = useState(horaFinActual ?? '')
  const [guardando, setGuardando] = useState(false)
  const [guardada, setGuardada] = useState(!!(fechaActual && horaInicioActual && horaFinActual))
  const [errorGuardar, setErrorGuardar] = useState('')
  const router = useRouter()

  const valido = fecha && fecha >= hoy && horaInicio && horaFin && horaFin > horaInicio

  async function guardar() {
    if (!valido) return
    setGuardando(true)
    setErrorGuardar('')
    try {
      const res = await fetch('/api/visita/fecha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visita_id: visitaId, fecha_programada: fecha, hora_inicio: horaInicio, hora_fin: horaFin }),
      })
      if (res.ok) {
        setGuardada(true)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorGuardar(data.error ?? 'No se pudo guardar la fecha.')
      }
    } finally {
      setGuardando(false)
    }
  }

  const fechaFormateada = fecha
    ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-VE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  const inputStyle = {
    border: '2px solid #86EFAC', borderRadius: '8px', padding: '6px 10px',
    fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C',
    background: 'white',
  }

  return (
    <div style={{ background: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: '12px', padding: '14px 18px', marginBottom: '12px' }}>
      <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#15803d', fontSize: '14px', margin: '0 0 8px' }}>
        📅 ¿Acordaron una fecha con {compitaNombre}?
      </p>
      {errorGuardar && (
        <p style={{ color: '#E05520', fontSize: '13px', margin: '0 0 8px', fontFamily: 'Inter, sans-serif' }}>{errorGuardar}</p>
      )}
      {guardada && fecha && horaInicio && horaFin ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ color: '#166534', fontSize: '14px', fontWeight: 600, textTransform: 'capitalize' }}>
            ✓ {fechaFormateada} · {horaInicio} – {horaFin}
          </span>
          <button
            onClick={() => setGuardada(false)}
            style={{ background: 'none', border: 'none', color: '#15803d', fontSize: '12px', cursor: 'pointer', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, textDecoration: 'underline', padding: 0 }}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={fecha}
              min={hoy}
              onChange={(e) => { setFecha(e.target.value); setGuardada(false) }}
              style={{ ...inputStyle, flex: 2, minWidth: '140px' }}
            />
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => { setHoraInicio(e.target.value); setGuardada(false) }}
              style={{ ...inputStyle, flex: 1, minWidth: '100px' }}
              placeholder="Inicio"
            />
            <input
              type="time"
              value={horaFin}
              onChange={(e) => { setHoraFin(e.target.value); setGuardada(false) }}
              style={{ ...inputStyle, flex: 1, minWidth: '100px' }}
              placeholder="Fin"
            />
          </div>
          {horaInicio && horaFin && horaFin <= horaInicio && (
            <p style={{ color: '#E05520', fontSize: '12px', margin: 0, fontFamily: 'Inter, sans-serif' }}>
              La hora de fin debe ser después de la hora de inicio.
            </p>
          )}
          <button
            onClick={guardar}
            disabled={!valido || guardando}
            style={{
              background: (!valido || guardando) ? '#D4C9E8' : '#22C55E',
              color: 'white', border: 'none', borderRadius: '9999px', padding: '8px 20px',
              fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px',
              cursor: (!valido || guardando) ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
            }}
          >
            {guardando ? 'Confirmando…' : '✓ Confirmar visita'}
          </button>
        </div>
      )}
    </div>
  )
}
