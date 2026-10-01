'use client'

import { useState } from 'react'

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
      if (d.url) {
        setRoomUrl(d.url)
        setEnLlamada(true)
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
