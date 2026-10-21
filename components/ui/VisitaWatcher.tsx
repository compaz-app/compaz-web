'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'

interface Props {
  usuarioId: string
  visitaActivaId: string | null
  compitaNombre?: string
}

export default function VisitaWatcher({ usuarioId, visitaActivaId, compitaNombre }: Props) {
  const router = useRouter()
  const ultimaLlamadaRef = useRef<string | null>(null)
  const [llamadaEntrante, setLlamadaEntrante] = useState<{ roomUrl: string; compita: string } | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabase()
    const canal = supabase
      .channel(`visita-status-${usuarioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitas', filter: `usuario_id=eq.${usuarioId}` },
        (payload) => {
          const nueva = (payload.new as Record<string, unknown>)?.llamada_solicitada_at as string | null
          const roomUrl = (payload.new as Record<string, unknown>)?.room_url as string | null

          // Detectar llamada entrante del compita
          if (nueva && nueva !== ultimaLlamadaRef.current && roomUrl) {
            ultimaLlamadaRef.current = nueva
            setLlamadaEntrante({ roomUrl, compita: compitaNombre ?? 'Tu compita' })
            sonarTimbre()
          } else {
            // Cualquier otro cambio: refrescar la página
            router.refresh()
          }
        },
      )
      .subscribe((status) => {
        console.log('[VisitaWatcher] Realtime status:', status)
      })

    return () => { supabase.removeChannel(canal) }
  }, [usuarioId, visitaActivaId, router, compitaNombre])

  function sonarTimbre() {
    try {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
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
      // AudioContext bloqueado sin interacción previa
    }
  }

  if (!llamadaEntrante) return null

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
            {llamadaEntrante.compita} te llama
          </h2>
          <p style={{ color: '#4A3B6B', fontFamily: 'Inter, sans-serif', fontSize: '14px', margin: '0 0 28px' }}>
            Tu compita inició una videollamada durante la visita.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={`${llamadaEntrante.roomUrl}${llamadaEntrante.roomUrl.includes('?') ? '&' : '?'}lang=es`}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#22c55e', color: 'white', borderRadius: '9999px',
                padding: '14px 28px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800,
                fontSize: '16px', textDecoration: 'none', display: 'inline-block',
              }}
            >
              ✅ Contestar
            </a>
            <button
              onClick={() => setLlamadaEntrante(null)}
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
