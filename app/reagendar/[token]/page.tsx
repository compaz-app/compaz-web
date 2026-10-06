'use client'

import { useState, useEffect, use } from 'react'

interface Slot {
  iso: string
  label: string
}

interface SolicitudInfo {
  compita_nombre: string
  compita_foto: string | null
  estado: string
}

const HORAS_VE = [8, 9, 10, 11, 14, 15, 16, 17, 18]

function generarSlots(): { diaLabel: string; slots: Slot[] }[] {
  const dias: { diaLabel: string; slots: Slot[] }[] = []
  const ahora = new Date()

  for (let d = 1; d <= 14; d++) {
    const refVE = new Date(ahora.getTime() + d * 24 * 60 * 60 * 1000)

    const partsVE = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(refVE)
    const anoVE = Number(partsVE.find(p => p.type === 'year')!.value)
    const mesVE = Number(partsVE.find(p => p.type === 'month')!.value) - 1
    const diaVE = Number(partsVE.find(p => p.type === 'day')!.value)

    const fechaLabel = refVE.toLocaleDateString('es-VE', {
      timeZone: 'America/Caracas',
      weekday: 'long', day: 'numeric', month: 'long',
    })

    const slots: Slot[] = HORAS_VE.map(h => {
      const slotUTC = new Date(Date.UTC(anoVE, mesVE, diaVE, h + 4, 0, 0))
      return {
        iso: slotUTC.toISOString(),
        label: `${String(h).padStart(2, '0')}:00`,
      }
    })

    dias.push({ diaLabel: fechaLabel, slots })
  }

  return dias
}

export default function ReagendarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [info, setInfo] = useState<SolicitudInfo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [slotsElegidos, setSlotsElegidos] = useState<string[]>([])
  const [diasAbiertos, setDiasAbiertos] = useState<Record<string, boolean>>({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')

  const dias = generarSlots()

  useEffect(() => {
    fetch(`/api/solicitud/info-reagendar?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setInfo(d.data)
        else setError(d.error ?? 'No encontramos esta solicitud.')
      })
      .catch(() => setError('Error de conexión.'))
      .finally(() => setCargando(false))
  }, [token])

  function toggleSlot(iso: string) {
    setSlotsElegidos(prev => {
      if (prev.includes(iso)) return prev.filter(s => s !== iso)
      if (prev.length >= 3) return prev
      return [...prev, iso]
    })
  }

  async function enviar() {
    if (slotsElegidos.length === 0) {
      setErrorEnvio('Elige al menos un horario.')
      return
    }
    setEnviando(true)
    setErrorEnvio('')
    try {
      const res = await fetch('/api/solicitud/proponer-reagendado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slots: slotsElegidos }),
      })
      const data = await res.json()
      if (data.ok) {
        setEnviado(true)
      } else {
        setErrorEnvio(data.error ?? 'Error al enviar.')
      }
    } catch {
      setErrorEnvio('Error de conexión.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6B5C90', fontFamily: 'Inter, sans-serif' }}>Cargando…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '24px', padding: '40px 32px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <h2 style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px' }}>Enlace inválido</h2>
          <p style={{ color: '#4A3B6B', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>{error}</p>
        </div>
      </div>
    )
  }

  if (enviado) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '24px', padding: '40px 32px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗓️</div>
          <h2 style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px', marginBottom: '12px' }}>
            ¡Horarios enviados!
          </h2>
          <p style={{ color: '#4A3B6B', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
            {info?.compita_nombre} revisará tus horarios y confirmará el que mejor le quede. Te avisaremos por correo cuando confirme.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', padding: '24px 0 64px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 16px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '8px' }}>
            Compaz
          </div>
          <h1 style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px', margin: '0 0 8px' }}>
            Reagendar con {info?.compita_nombre}
          </h1>
          <p style={{ color: '#6B5C90', fontFamily: 'Inter, sans-serif', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
            Elige hasta 3 horarios. {info?.compita_nombre} confirmará el que mejor le quede.
          </p>
        </div>

        {/* Contador de slots elegidos */}
        {slotsElegidos.length > 0 && (
          <div style={{ background: '#F0FDF4', border: '2px solid #22C55E', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ color: '#166534', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', margin: 0 }}>
              {slotsElegidos.length} horario{slotsElegidos.length > 1 ? 's' : ''} seleccionado{slotsElegidos.length > 1 ? 's' : ''}
              {slotsElegidos.length < 3 ? ` — puedes elegir hasta ${3 - slotsElegidos.length} más` : ''}
            </p>
          </div>
        )}

        {/* Días colapsables */}
        {dias.map(({ diaLabel, slots }) => {
          const tieneElegido = slots.some(s => slotsElegidos.includes(s.iso))
          const abierto = diasAbiertos[diaLabel] ?? tieneElegido

          return (
            <div key={diaLabel} style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', marginBottom: '12px', overflow: 'hidden' }}>
              <button
                onClick={() => setDiasAbiertos(prev => ({ ...prev, [diaLabel]: !abierto }))}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '15px',
                  color: tieneElegido ? '#166534' : '#1A0A3C',
                }}
              >
                <span style={{ textTransform: 'capitalize' }}>
                  {tieneElegido ? '✅ ' : ''}{diaLabel}
                </span>
                <span style={{ color: '#9B8AB8', fontSize: '12px', fontWeight: 400 }}>
                  {abierto ? '▲' : '▼'}
                </span>
              </button>

              {abierto && (
                <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {slots.map(slot => {
                    const elegido = slotsElegidos.includes(slot.iso)
                    const bloqueado = !elegido && slotsElegidos.length >= 3
                    return (
                      <button
                        key={slot.iso}
                        onClick={() => !bloqueado && toggleSlot(slot.iso)}
                        disabled={bloqueado}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '9999px',
                          border: elegido ? '2px solid #22C55E' : '2px solid #E8E0D4',
                          background: elegido ? '#F0FDF4' : bloqueado ? '#F5F5F5' : 'white',
                          color: elegido ? '#166534' : bloqueado ? '#BDBDBD' : '#1A0A3C',
                          fontFamily: 'Bricolage Grotesque, sans-serif',
                          fontWeight: elegido ? 700 : 500,
                          fontSize: '14px',
                          cursor: bloqueado ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {slot.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Botón enviar */}
        <div style={{ marginTop: '24px', position: 'sticky', bottom: '24px' }}>
          {errorEnvio && (
            <p style={{ color: '#E05520', fontFamily: 'Inter, sans-serif', fontSize: '14px', textAlign: 'center', marginBottom: '12px' }}>
              {errorEnvio}
            </p>
          )}
          <button
            onClick={enviar}
            disabled={enviando || slotsElegidos.length === 0}
            style={{
              width: '100%',
              background: slotsElegidos.length === 0 || enviando ? '#E8E0D4' : '#FF6B2B',
              color: slotsElegidos.length === 0 || enviando ? '#9B8AB8' : 'white',
              border: 'none',
              borderRadius: '9999px',
              padding: '18px',
              fontSize: '16px',
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontWeight: 800,
              cursor: slotsElegidos.length === 0 || enviando ? 'not-allowed' : 'pointer',
            }}
          >
            {enviando ? 'Enviando…' : 'Enviar horarios'}
          </button>
        </div>
      </div>
    </div>
  )
}
