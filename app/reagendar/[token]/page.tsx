'use client'

import { useState, useEffect, use } from 'react'

// Cambiar la hora de la entrevista. Ya no se proponen horarios a mano: se suelta la hora actual y la persona elige otra de las horas libres del compita
// (/solicitar/hora). Esta pantalla solo confirma el cambio.
interface SolicitudInfo {
  compita_nombre: string
  compita_foto: string | null
  estado: string
  nuevo_flujo?: boolean
  solicitud_id?: string
}

export default function ReagendarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [info, setInfo] = useState<SolicitudInfo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')

  // Si el cliente llegó desde «No se pudo» y la llamada ya pasó, queda anotado de una vez (el servidor decide; es idempotente y no hace falta otro clic).
  useEffect(() => { fetch('/api/solicitud/llamada-no-ocurrio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => undefined) }, [token])

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

  // Entrevista agendada con horas libres: se suelta la hora y se elige otra entre las libres del compita.
  async function cambiarHora() {
    setEnviando(true); setErrorEnvio('')
    try {
      const res = await fetch('/api/solicitud/reagendar-cliente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const data = await res.json()
      if (data.ok) window.location.href = `/solicitar/hora?solicitud=${encodeURIComponent(data.data.solicitud_id)}`
      else setErrorEnvio(data.error ?? 'No pudimos cambiar la hora.')
    } catch { setErrorEnvio('Error de conexión.') } finally { setEnviando(false) }
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6B5C90', fontFamily: 'Inter, sans-serif' }}>Cargando…</p>
      </div>
    )
  }

  if (info?.nuevo_flujo) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '24px', padding: '36px 28px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: '22px', color: '#1A0A3C', margin: '0 0 10px' }}>¿Necesitas cambiar la hora?</h1>
          <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: 1.6, margin: '0 0 20px' }}>Soltamos la hora actual con {info.compita_nombre} y eliges otra de sus horas libres. Le avisamos a {info.compita_nombre}.</p>
          {errorEnvio && <p role="alert" style={{ color: '#DC2626', fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>{errorEnvio}</p>}
          <button onClick={cambiarHora} disabled={enviando} style={{ width: '100%', minHeight: '52px', background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: 800, fontSize: '16px', cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando ? 0.6 : 1 }}>{enviando ? 'Un momento…' : 'Cambiar la hora'}</button>
        </div>
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

  // Una solicitud que no es del modo de horas libres ya no se reagenda aquí.
  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '24px', padding: '40px 32px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <h2 style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px' }}>Este enlace ya no sirve</h2>
        <p style={{ color: '#4A3B6B', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>Entra a tu portal para ver el estado de tu entrevista y elegir otra hora.</p>
        <a href="/portal" style={{ display: 'inline-block', background: '#FF6B2B', color: 'white', padding: '14px 28px', borderRadius: '9999px', textDecoration: 'none', fontWeight: 800, marginTop: '8px' }}>Ir a mi portal</a>
      </div>
    </div>
  )
}
