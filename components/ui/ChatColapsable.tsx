'use client'

import { useState } from 'react'
import Chat from './Chat'
import type { Visita, Mensaje } from '@/types'

interface Props {
  visita: Visita & { estado?: string }
  mensajesIniciales: Mensaje[]
  compitaNombre: string
}

export default function ChatColapsable({ visita, mensajesIniciales, compitaNombre }: Props) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
      <button
        onClick={() => setAbierto(a => !a)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#2D1464', fontSize: '15px' }}>
          💬 Escribirle a {compitaNombre}
        </span>
        <span style={{ color: '#9B8AB8', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
          {abierto ? '▲ Cerrar' : '▼ Abrir'}
        </span>
      </button>
      {abierto && (
        <div style={{ height: '360px', display: 'flex', flexDirection: 'column', borderTop: '2px solid #E8E0D4' }}>
          <Chat visita={visita} mensajesIniciales={mensajesIniciales} compitaNombre={compitaNombre} />
        </div>
      )}
    </div>
  )
}
