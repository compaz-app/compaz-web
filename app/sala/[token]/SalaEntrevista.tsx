'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Paso = 'antes' | 'en_llamada' | 'terminado' | 'problema_tecnico' | 'reconectando' | 'resultado'
type Resultado = 'contratar' | 'reagendar' | 'no_contratar'

interface Props {
  token: string
  quien: 'cliente' | 'compita'
  roomUrl: string
  compitaNombre: string
  clienteNombre: string
  slotLabel: string
}

export default function SalaEntrevista({ token, quien, roomUrl, compitaNombre, clienteNombre, slotLabel }: Props) {
  const [paso, setPaso] = useState<Paso>('antes')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [cargando, setCargando] = useState(false)
  const [nuevaRoomUrl, setNuevaRoomUrl] = useState<string | null>(null)
  const router = useRouter()

  const urlActual = nuevaRoomUrl ?? roomUrl

  function abrirSala(url?: string) {
    window.open(url ?? urlActual, '_blank', 'noopener,noreferrer')
    if (paso === 'antes') setPaso('en_llamada')
  }

  async function reconectarAhora() {
    setCargando(true)
    try {
      const res = await fetch(`/api/solicitud/reconectar-llamada?token=${token}&quien=cliente`)
      const data = await res.json()
      if (data.room_url) {
        setNuevaRoomUrl(data.room_url)
        setPaso('reconectando')
        window.open(data.room_url, '_blank', 'noopener,noreferrer')
      } else {
        alert('No pudimos crear la sala. Intenta de nuevo o escríbenos a hola@micompaz.com.')
      }
    } catch (e) {
      console.error(e)
      alert('Hubo un error de conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  async function confirmarResultado(r: Resultado) {
    setCargando(true)
    setResultado(r)
    try {
      if (r === 'reagendar' && quien === 'cliente') {
        window.location.href = `/api/solicitud/resultado-llamada?token=${token}&resultado=reagendar&quien=cliente`
        return
      }
      // contratar y no_contratar redirigen vía el servidor (303)
      if (r === 'contratar' || r === 'no_contratar') {
        window.location.href = `/api/solicitud/resultado-llamada?token=${token}&resultado=${r}&quien=cliente`
        return
      }
      const res = await fetch(`/api/solicitud/resultado-llamada?token=${token}&resultado=${r}&quien=${quien}`)
      if (!res.ok) {
        alert('No pudimos registrar tu decisión. Intenta de nuevo o escríbenos a hola@micompaz.com.')
        return
      }
      setPaso('resultado')
    } catch (e) {
      console.error(e)
      alert('Hubo un error de conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  async function terminarLlamada() {
    if (quien === 'compita') {
      setCargando(true)
      try {
        await fetch(`/api/solicitud/resultado-llamada?token=${token}&resultado=bien&quien=compita`)
        setPaso('resultado')
      } catch (e) {
        console.error(e)
        alert('Error al registrar. Intenta de nuevo.')
      } finally {
        setCargando(false)
      }
      return
    }
    setPaso('terminado')
  }

  async function reconectarCompita() {
    setCargando(true)
    try {
      const res = await fetch(`/api/solicitud/reconectar-llamada?token=${token}&quien=compita`)
      const data = await res.json()
      if (data.room_url) {
        setNuevaRoomUrl(data.room_url)
        setPaso('reconectando')
        window.open(data.room_url, '_blank', 'noopener,noreferrer')
      } else {
        alert('No pudimos crear la sala. Intenta de nuevo o escríbenos a hola@micompaz.com.')
      }
    } catch (e) {
      console.error(e)
      alert('Hubo un error de conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  const nombreCorto = quien === 'cliente' ? compitaNombre.split(' ')[0] : clienteNombre.split(' ')[0]

  const btnPrimario = { background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px 32px', fontWeight: 800, fontSize: '17px', cursor: 'pointer', width: '100%', marginTop: '8px' } as const
  const btnSecundario = { background: '#F5F0E8', color: '#4A3B6B', border: '2px solid #D4C9E8', borderRadius: '9999px', padding: '12px 24px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', width: '100%', marginBottom: '12px' } as const

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#FDFAF6', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '24px', padding: '40px 32px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>

        {/* ── Antes de entrar ── */}
        {paso === 'antes' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📞</div>
            <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', marginBottom: '8px' }}>
              Tu llamada con {nombreCorto} está lista
            </h2>
            <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: 1.6, marginBottom: '8px' }}>{slotLabel}</p>
            <p style={{ color: '#C84B0E', background: '#FFF3E8', border: '2px solid #FF6B2B', borderRadius: '12px', padding: '12px', fontSize: '13px', margin: '16px 0' }}>
              ⏱️ La llamada dura 20 minutos. La sala se cierra automáticamente a los 23 min.
            </p>
            <button onClick={() => abrirSala()} style={btnPrimario}>Entrar a la llamada →</button>
          </>
        )}

        {/* ── En llamada ── */}
        {paso === 'en_llamada' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🟢</div>
            <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', marginBottom: '12px' }}>Llamada en curso</h2>
            <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
              La sala se abrió en una nueva pestaña. Cuando termines la llamada, regresa aquí y toca el botón de abajo.
            </p>
            <button onClick={() => abrirSala()} style={btnSecundario}>Volver a abrir la sala</button>
            {quien === 'compita' && (
              <button onClick={reconectarCompita} disabled={cargando}
                style={{ background: '#6B5C90', color: 'white', border: 'none', borderRadius: '9999px', padding: '14px 24px', fontWeight: 700, fontSize: '15px', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1, width: '100%', marginBottom: '12px' }}>
                {cargando ? 'Creando nueva sala…' : '⚡ La llamada se cayó — reconectar'}
              </button>
            )}
            <button onClick={terminarLlamada} disabled={cargando} style={{ background: '#1A0A3C', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px 32px', fontWeight: 800, fontSize: '16px', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1, width: '100%' }}>
              {cargando ? 'Registrando…' : '✅ Terminé la llamada'}
            </button>
          </>
        )}

        {/* ── Cliente elige qué hacer ── */}
        {paso === 'terminado' && quien === 'cliente' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤔</div>
            <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', marginBottom: '12px' }}>¿Qué decides sobre {nombreCorto}?</h2>
            <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>Cuéntanos cómo te fue para poder ayudarte mejor.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => confirmarResultado('contratar')} disabled={cargando}
                style={{ background: '#22C55E', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px 24px', fontWeight: 800, fontSize: '16px', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1 }}>
                ✅ Sí, quiero contratar a {nombreCorto}
              </button>
              <button onClick={() => setPaso('problema_tecnico')} disabled={cargando}
                style={{ background: '#6B5C90', color: 'white', border: 'none', borderRadius: '9999px', padding: '14px 24px', fontWeight: 700, fontSize: '15px', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1 }}>
                🔧 La llamada se cortó
              </button>
              <button onClick={() => confirmarResultado('no_contratar')} disabled={cargando}
                style={{ background: '#E8E0D4', color: '#1A0A3C', border: 'none', borderRadius: '9999px', padding: '14px 24px', fontWeight: 700, fontSize: '15px', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1 }}>
                ❌ No es lo que busco — ver otros perfiles
              </button>
            </div>
          </>
        )}

        {/* ── La llamada se cortó — ¿reconectar o reagendar? ── */}
        {paso === 'problema_tecnico' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
            <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', marginBottom: '12px' }}>La llamada se cortó</h2>
            <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
              ¿Fue un problema técnico y quieres reconectarte ahora, o prefieres reagendar para otro día?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={reconectarAhora} disabled={cargando}
                style={{ background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px 24px', fontWeight: 800, fontSize: '16px', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1 }}>
                {cargando ? 'Creando nueva sala…' : '🔁 Reconectarme ahora'}
              </button>
              <button onClick={() => confirmarResultado('reagendar')} disabled={cargando}
                style={{ background: '#E8E0D4', color: '#1A0A3C', border: 'none', borderRadius: '9999px', padding: '14px 24px', fontWeight: 700, fontSize: '15px', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1 }}>
                📅 Reagendar para otro día
              </button>
            </div>
          </>
        )}

        {/* ── Reconectando ── */}
        {paso === 'reconectando' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔁</div>
            <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', marginBottom: '12px' }}>Nueva sala lista</h2>
            <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
              Se abrió en una nueva pestaña. También le avisamos a {nombreCorto} {quien === 'compita' ? 'por email' : 'por Telegram'} con el nuevo link.
            </p>
            <button onClick={() => abrirSala(nuevaRoomUrl ?? undefined)} style={btnSecundario}>Abrir la sala de nuevo</button>
            <button onClick={terminarLlamada} disabled={cargando} style={{ background: '#1A0A3C', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px 32px', fontWeight: 800, fontSize: '16px', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1, width: '100%' }}>
              {cargando ? 'Registrando…' : '✅ Terminé la llamada'}
            </button>
          </>
        )}

        {/* ── Resultado final ── */}
        {paso === 'resultado' && (
          <>
            {resultado === 'contratar' ? (
              <>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', marginBottom: '12px' }}>¡Genial!</h2>
                <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: 1.6 }}>
                  El equipo de Compaz se pondrá en contacto contigo para coordinar los detalles con <strong>{compitaNombre}</strong>.
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>👋</div>
                <h2 style={{ color: '#1A0A3C', fontWeight: 800, fontSize: '22px', marginBottom: '12px' }}>¡Gracias!</h2>
                <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: 1.6 }}>
                  {quien === 'compita'
                    ? 'Registramos tu confirmación. Estaremos en contacto según lo que decida la familia.'
                    : 'Gracias por avisarnos. Estamos aquí si necesitas algo más.'}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
