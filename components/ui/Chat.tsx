'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'
import type { Mensaje, Visita } from '@/types'
import { fotoSrc } from '@/lib/fotos'

interface ChatProps {
  visita: Visita & { estado?: string }
  mensajesIniciales: Mensaje[]
  compitaNombre: string
}

const MENSAJE_SISTEMA_BIENVENIDA = {
  id: '__sistema_bienvenida__',
  visit_id: '',
  origen: 'sistema' as const,
  tipo: 'texto' as const,
  contenido: 'Bienvenido al chat seguro de Compaz. Mantén toda la coordinación aquí para que podamos garantizarte el servicio. Compaz nunca te pedirá contraseñas, datos bancarios ni información personal sensible por este medio. Si alguien te los solicita, repórtalo de inmediato.',
  created_at: '',
}

const MENSAJE_SISTEMA_RECORDATORIO = {
  id: '__sistema_recordatorio__',
  visit_id: '',
  origen: 'sistema' as const,
  tipo: 'texto' as const,
  contenido: 'Recuerda: coordina todo dentro de Compaz para mantener la garantía del servicio.',
  created_at: '',
}

function MensajeSistema({ texto }: { texto: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
      <div style={{ background: '#F5F0FF', border: '1.5px solid rgba(124,77,255,0.2)', borderRadius: '12px', padding: '8px 14px', maxWidth: '85%', textAlign: 'center' }}>
        <p style={{ color: '#6B5C90', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0, lineHeight: '1.5', fontStyle: 'italic' }}>
          🔒 {texto}
        </p>
      </div>
    </div>
  )
}

export default function Chat({ visita, mensajesIniciales, compitaNombre }: ChatProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(mensajesIniciales)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [mensajes])

  // Suscripción Realtime
  useEffect(() => {
    const supabase = createBrowserSupabase()
    let channel: ReturnType<typeof supabase.channel>

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(`visita-${visita.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'mensajes' },
          (payload) => {
            const nuevo = payload.new as Mensaje
            if (nuevo.visit_id === visita.id) {
              setMensajes((prev) => [...prev, nuevo])
            }
          }
        )
        .subscribe((status, err) => {
          console.log('[Realtime] status:', status, err)
        })
    })

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [visita.id])

  async function enviarMensaje(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() || enviando) return

    setEnviando(true)
    setErrorEnvio('')
    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: texto.trim() }),
      })
      if (res.ok) {
        setTexto('')
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorEnvio(data.error ?? 'No se pudo enviar el mensaje.')
      }
    } catch {
      setErrorEnvio('Error de conexión. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', borderBottom: '2px solid #E8E0D4' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: visita.estado === 'pre_visita' ? '#7C4DFF' : '#22c55e', flexShrink: 0 }} />
        <span style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>
          {visita.estado === 'pre_visita' ? `Coordina con ${compitaNombre}` : `Visita en curso con ${compitaNombre}`}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#9B8AB8', fontFamily: 'Inter, sans-serif' }}>🔒 Chat seguro</span>
      </div>

      {/* Mensajes */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Mensaje de bienvenida del sistema — siempre primero */}
        <MensajeSistema texto={MENSAJE_SISTEMA_BIENVENIDA.contenido} />

        {mensajes.length === 0 && (
          <p style={{ color: '#6B5C90', textAlign: 'center', fontFamily: 'Inter, sans-serif', marginTop: '20px', fontSize: '14px' }}>
            {visita.estado === 'pre_visita'
              ? `Usa este chat para coordinar con ${compitaNombre} la fecha y hora de la primera visita.`
              : 'La visita acaba de comenzar. Los mensajes aparecerán aquí.'}
          </p>
        )}

        {mensajes.filter((m) => m.origen !== 'admin').map((m, idx) => {
          const esCliente = m.origen === 'cliente'
          const esAdmin = m.origen === 'admin'
          const mostrarRecordatorio = (idx + 1) % 10 === 0
          return (
            <div key={m.id}>
              <div style={{ display: 'flex', justifyContent: esCliente ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: '75%',
                    background: esCliente ? '#FF6B2B' : esAdmin ? '#FFD23F' : 'white',
                    color: esCliente ? 'white' : '#1A0A3C',
                    border: esCliente ? 'none' : '2px solid #E8E0D4',
                    borderRadius: esCliente ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '10px 14px',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '15px',
                    lineHeight: '1.5',
                  }}
                >
                  {m.tipo === 'foto' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotoSrc(m)} alt="Foto" style={{ maxWidth: '100%', borderRadius: '8px', display: 'block' }} />
                  ) : (
                    <span>{m.contenido}</span>
                  )}
                  <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px', textAlign: 'right' }}>
                    {new Date(m.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              {mostrarRecordatorio && <MensajeSistema texto={MENSAJE_SISTEMA_RECORDATORIO.contenido} />}
            </div>
          )
        })}
        <div />
      </div>

      {/* Input */}
      <form onSubmit={enviarMensaje} style={{ padding: '16px 20px', borderTop: '2px solid #E8E0D4', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {errorEnvio && (
          <p style={{ color: '#E05520', fontSize: '13px', margin: 0, fontFamily: 'Inter, sans-serif' }}>{errorEnvio}</p>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`Escríbele a ${compitaNombre}...`}
          disabled={enviando}
          style={{
            flex: 1,
            background: 'white',
            border: '2px solid rgba(45,20,100,0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '16px',
            fontFamily: 'Inter, sans-serif',
            color: '#1A0A3C',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          style={{
            background: '#FF6B2B',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 20px',
            fontFamily: 'Bricolage Grotesque, sans-serif',
            fontWeight: 700,
            cursor: enviando || !texto.trim() ? 'not-allowed' : 'pointer',
            opacity: enviando || !texto.trim() ? 0.5 : 1,
          }}
        >
          {enviando ? '…' : '→'}
        </button>
        </div>
      </form>
    </div>
  )
}
