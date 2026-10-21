'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'

interface Props {
  visitaId: string
  compitaNombre: string
  roomUrlInicial: string | null
}

export default function VideoCall({ visitaId, compitaNombre, roomUrlInicial }: Props) {
  const [roomUrl, setRoomUrl] = useState<string | null>(roomUrlInicial)
  const [llamandoVideo, setLlamandoVideo] = useState(false)
  const [llamandoAudio, setLlamandoAudio] = useState(false)
  const [enLlamada, setEnLlamada] = useState(!!roomUrlInicial)
  const [compitaLlamando, setCompitaLlamando] = useState(false)
  const ultimaLlamadaRef = useRef<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Supabase Realtime: escuchar cambios en llamada_solicitada_at de esta visita
  useEffect(() => {
    const supabase = createBrowserSupabase()
    const canal = supabase
      .channel(`visita-llamada-${visitaId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visitas', filter: `id=eq.${visitaId}` },
        (payload) => {
          const nueva = (payload.new as Record<string, unknown>).llamada_solicitada_at as string | null
          if (nueva && nueva !== ultimaLlamadaRef.current) {
            ultimaLlamadaRef.current = nueva
            const url = (payload.new as Record<string, unknown>).room_url as string | null
            if (url) setRoomUrl(url)
            setCompitaLlamando(true)
            sonarTimbre()
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [visitaId])

  function sonarTimbre() {
    try {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      // Timbre simple: dos tonos cortos
      function tono(freq: number, start: number, dur: number) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(0, ctx.currentTime + start)
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.02)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + dur + 0.05)
      }
      tono(880, 0, 0.25)
      tono(1100, 0.35, 0.25)
      tono(880, 0.7, 0.25)
      tono(1100, 1.05, 0.25)
    } catch {
      // Si el browser bloquea AudioContext (sin interacción previa) no pasa nada
    }
  }

  async function iniciarLlamada(soloAudio: boolean) {
    if (soloAudio) setLlamandoAudio(true)
    else setLlamandoVideo(true)
    try {
      const res = await fetch('/api/create-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visita_id: visitaId, solo_audio: soloAudio }),
      })
      const d = await res.json()
      if (d.ok && d.data?.url) {
        setRoomUrl(d.data.url)
        setEnLlamada(true)
        setCompitaLlamando(false)
      } else {
        alert(d.error ?? 'Error al iniciar la llamada')
      }
    } finally {
      setLlamandoVideo(false)
      setLlamandoAudio(false)
    }
  }

  function colgar() {
    setEnLlamada(false)
    setRoomUrl(null)
  }

  function aceptarLlamada() {
    setCompitaLlamando(false)
    setEnLlamada(true)
  }

  // Banner de llamada entrante del compita
  if (compitaLlamando && roomUrl) {
    return (
      <>
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9998,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{
            background: 'white', borderRadius: '24px', padding: '40px 32px', maxWidth: '400px', width: '100%',
            textAlign: 'center', boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            animation: 'pulse-ring 0.8s ease-in-out infinite alternate',
            border: '3px solid #22c55e',
          }}>
            <div style={{ fontSize: '56px', marginBottom: '8px' }}>📹</div>
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px', color: '#1A0A3C', margin: '0 0 8px' }}>
              {compitaNombre} te llama
            </h2>
            <p style={{ color: '#4A3B6B', fontFamily: 'Inter, sans-serif', fontSize: '14px', margin: '0 0 28px' }}>
              Tu compita inició una videollamada durante la visita.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={aceptarLlamada}
                style={{
                  background: '#22c55e', color: 'white', border: 'none', borderRadius: '9999px',
                  padding: '14px 28px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800,
                  fontSize: '16px', cursor: 'pointer',
                }}
              >
                ✅ Contestar
              </button>
              <button
                onClick={() => setCompitaLlamando(false)}
                style={{
                  background: 'white', color: '#6B5C90', border: '2px solid #D4C9E8', borderRadius: '9999px',
                  padding: '14px 28px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700,
                  fontSize: '16px', cursor: 'pointer',
                }}
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
        <style>{`
          @keyframes pulse-ring {
            from { box-shadow: 0 0 0 0 rgba(34,197,94,0.5), 0 25px 60px rgba(0,0,0,0.3); }
            to   { box-shadow: 0 0 0 20px rgba(34,197,94,0), 0 25px 60px rgba(0,0,0,0.3); }
          }
        `}</style>
      </>
    )
  }

  if (enLlamada && roomUrl) {
    return (
      <div style={{ background: 'white', border: '2px solid #2D1464', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '12px 20px', borderBottom: '2px solid #E8E0D4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px' }}>
            📹 Llamada con {compitaNombre}
          </span>
          <button
            onClick={colgar}
            style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '9999px', padding: '6px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
          >
            Colgar
          </button>
        </div>
        <iframe
          src={roomUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture"
          style={{ width: '100%', height: '480px', border: 'none', display: 'block' }}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
      <button
        onClick={() => iniciarLlamada(false)}
        disabled={llamandoVideo || llamandoAudio}
        style={{ background: '#2D1464', color: 'white', border: 'none', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', opacity: (llamandoVideo || llamandoAudio) ? 0.6 : 1 }}
      >
        {llamandoVideo ? 'Iniciando…' : '📹 Videollamada'}
      </button>
      <button
        onClick={() => iniciarLlamada(true)}
        disabled={llamandoVideo || llamandoAudio}
        style={{ background: 'white', color: '#2D1464', border: '2px solid #2D1464', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', opacity: (llamandoVideo || llamandoAudio) ? 0.6 : 1 }}
      >
        {llamandoAudio ? 'Iniciando…' : '📞 Solo audio'}
      </button>
    </div>
  )
}
