'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Usuario } from '@/types'

type Props = {
  usuario: Usuario
  readonly?: boolean
}

export default function PerfilFamiliar({ usuario, readonly = false }: Props) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(usuario.familiar_nombre ?? '')
  const [edad, setEdad] = useState(String(usuario.familiar_edad ?? ''))
  const [condicion, setCondicion] = useState(usuario.familiar_condicion ?? '')
  const [notas, setNotas] = useState(usuario.familiar_notas ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const tieneInfo = usuario.familiar_nombre || usuario.familiar_edad || usuario.familiar_condicion || usuario.familiar_notas

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/usuario/familiar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familiar_nombre: nombre,
          familiar_edad: edad ? parseInt(edad, 10) : null,
          familiar_condicion: condicion,
          familiar_notas: notas,
        }),
      })
      if (!res.ok) throw new Error('Error guardando')
      setEditando(false)
      router.refresh()
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: '#2D1464',
    fontFamily: 'Bricolage Grotesque, sans-serif',
    fontWeight: 700,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '6px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'white',
    border: '1.5px solid rgba(45,20,100,0.2)',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    color: '#1A0A3C',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', color: '#1A0A3C', margin: 0 }}>
          👤 Perfil del familiar
        </h3>
        {!readonly && !editando && (
          <button
            onClick={() => setEditando(true)}
            style={{ background: 'transparent', border: '1.5px solid #D4CAE8', borderRadius: '9999px', padding: '6px 14px', fontSize: '13px', color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, cursor: 'pointer' }}
          >
            {tieneInfo ? 'Editar' : 'Completar perfil →'}
          </button>
        )}
      </div>

      {!editando ? (
        tieneInfo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {usuario.familiar_nombre && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ color: '#9B8AB8', fontSize: '13px', minWidth: '120px' }}>Nombre</span>
                <span style={{ color: '#1A0A3C', fontSize: '14px' }}>{usuario.familiar_nombre}</span>
              </div>
            )}
            {usuario.familiar_edad && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ color: '#9B8AB8', fontSize: '13px', minWidth: '120px' }}>Edad</span>
                <span style={{ color: '#1A0A3C', fontSize: '14px' }}>{usuario.familiar_edad} años</span>
              </div>
            )}
            {usuario.familiar_condicion && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ color: '#9B8AB8', fontSize: '13px', minWidth: '120px' }}>Condición</span>
                <span style={{ color: '#1A0A3C', fontSize: '14px', lineHeight: '1.5' }}>{usuario.familiar_condicion}</span>
              </div>
            )}
            {usuario.familiar_notas && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ color: '#9B8AB8', fontSize: '13px', minWidth: '120px' }}>Notas</span>
                <span style={{ color: '#1A0A3C', fontSize: '14px', lineHeight: '1.5' }}>{usuario.familiar_notas}</span>
              </div>
            )}
            {!readonly && (
              <p style={{ color: '#9B8AB8', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
                Esta información la verá tu compita antes de cada visita.
              </p>
            )}
          </div>
        ) : (
          <p style={{ color: '#9B8AB8', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
            Agrega el nombre, edad, condición médica y notas importantes de tu familiar.
            Tu compita verá esta información antes de cada visita para llegar mejor preparada.
          </p>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Nombre del familiar</label>
              <input style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: María González" />
            </div>
            <div>
              <label style={labelStyle}>Edad</label>
              <input style={inputStyle} type="number" min="1" max="120" value={edad} onChange={(e) => setEdad(e.target.value)} placeholder="Ej: 78" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Condición médica</label>
            <textarea
              style={{ ...inputStyle, height: '72px', resize: 'vertical' }}
              value={condicion}
              onChange={(e) => setCondicion(e.target.value)}
              placeholder="Ej: Diabetes tipo 2, hipertensión. Usa silla de ruedas."
            />
          </div>
          <div>
            <label style={labelStyle}>Notas importantes</label>
            <textarea
              style={{ ...inputStyle, height: '72px', resize: 'vertical' }}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Toma metformina a las 8am y 8pm. No puede subir escaleras. Le gusta la música."
            />
          </div>
          {error && <p style={{ color: '#E05520', fontSize: '13px', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={guardar}
              disabled={guardando}
              style={{ background: guardando ? '#E8E0D4' : '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '10px 24px', fontSize: '14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, cursor: guardando ? 'not-allowed' : 'pointer' }}
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => { setEditando(false); setError('') }}
              style={{ background: 'transparent', border: '1.5px solid #E8E0D4', borderRadius: '9999px', padding: '10px 20px', fontSize: '14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#6B5C90', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
