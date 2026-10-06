'use client'

import { useState } from 'react'
import type { Visita, Mensaje, ReporteVisita } from '@/types'

type VisitaConDatos = Visita & {
  compita?: { nombre: string }
  mensajes?: Mensaje[]
  reporte?: ReporteVisita | null
}

type Props = {
  visitas: VisitaConDatos[]
  compitaId: string | null
  compitaNombre: string | null
}

const ESCALA: Record<number, { label: string; color: string }> = {
  1: { label: 'Muy bajo', color: '#EF4444' },
  2: { label: 'Bajo', color: '#F97316' },
  3: { label: 'Regular', color: '#EAB308' },
  4: { label: 'Bueno', color: '#22C55E' },
  5: { label: 'Excelente', color: '#16A34A' },
}

const INDICADORES = [
  { key: 'animo' as const, label: 'Ánimo', emoji: '😊' },
  { key: 'fisico' as const, label: 'Condición física', emoji: '💪' },
  { key: 'participacion' as const, label: 'Participación', emoji: '🤝' },
  { key: 'entorno' as const, label: 'Entorno', emoji: '🏠' },
]

function FotoVisita({ url }: { url: string }) {
  const [error, setError] = useState(false)
  if (error) {
    return (
      <div style={{ background: '#F5F0E8', border: '1.5px solid #E8E0D4', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#9B8AB8', lineHeight: '1.5' }}>
        Esta foto fue enviada a través de Telegram. Si ya no carga, es porque los archivos de Telegram tienen una vigencia limitada.
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Foto de la visita"
      onError={() => setError(true)}
      style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }}
    />
  )
}

export default function HistorialVisitas({ visitas, compitaId, compitaNombre }: Props) {
  const [expandido, setExpandido] = useState<string | null>(null)

  if (visitas.length === 0) return null

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, marginBottom: '16px', fontSize: '16px' }}>
        Visitas anteriores
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visitas.map((v) => {
          const fecha = new Date(v.created_at).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          const duracion = v.inicio && v.fin
            ? `${Math.round((new Date(v.fin).getTime() - new Date(v.inicio).getTime()) / 60000)} min`
            : '—'
          const abierto = expandido === v.id
          const fotos = (v.mensajes ?? []).filter((m) => m.tipo === 'foto')
          const tieneDetalle = v.reporte || fotos.length > 0

          return (
            <div key={v.id} style={{ background: 'white', border: '1.5px solid #E8E0D4', borderRadius: '12px', overflow: 'hidden' }}>
              <button
                onClick={() => tieneDetalle ? setExpandido(abierto ? null : v.id) : undefined}
                style={{
                  width: '100%', background: 'transparent', border: 'none', padding: '14px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: tieneDetalle ? 'pointer' : 'default', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#4A3B6B', fontSize: '14px', textTransform: 'capitalize' }}>{fecha}</span>
                  {v.reporte?.novedad && (
                    <span style={{ background: '#FFF3E8', color: '#C84B0E', border: '1px solid #FF6B2B', borderRadius: '9999px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                      Novedad
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#6B5C90', fontSize: '13px' }}>{duracion}</span>
                  {tieneDetalle && (
                    <span style={{ color: '#9B8AB8', fontSize: '12px' }}>{abierto ? '▲' : '▼'}</span>
                  )}
                </div>
              </button>

              {abierto && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid #F0EBE0' }}>
                  {v.reporte?.resumen_ia && (
                    <div style={{ background: '#F5F0FF', borderLeft: '3px solid #7C4DFF', borderRadius: '0 8px 8px 0', padding: '12px 16px', margin: '16px 0 14px' }}>
                      <p style={{ color: '#1A0A3C', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{v.reporte.resumen_ia}</p>
                    </div>
                  )}

                  {v.reporte && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                      {INDICADORES.map(({ key, label, emoji }) => {
                        const val = v.reporte![key] as number | null
                        if (val === null) return null
                        const meta = ESCALA[val]
                        return (
                          <div key={key} style={{ background: '#FDFAF6', border: '1px solid #E8E0D4', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '11px', color: '#9B8AB8', marginBottom: '4px' }}>{emoji} {label}</div>
                            <div style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'Bricolage Grotesque, sans-serif', color: meta?.color ?? '#1A0A3C' }}>{val}/5</div>
                            <div style={{ fontSize: '11px', color: '#6B5C90' }}>{meta?.label}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {v.reporte?.novedad && (
                    <div style={{ background: '#FFF3E8', border: '1.5px solid #FF6B2B', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' }}>
                      <p style={{ color: '#C84B0E', fontSize: '11px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', margin: '0 0 4px' }}>Novedad reportada</p>
                      <p style={{ color: '#1A0A3C', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>{v.reporte.novedad}</p>
                    </div>
                  )}

                  {fotos.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <p style={{ color: '#6B5C90', fontSize: '12px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', margin: 0 }}>Fotos de la visita</p>
                      {fotos.map((f) => (
                        <FotoVisita key={f.id} url={f.contenido!} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reagendar */}
      <div style={{ background: '#F5F0E8', border: '1.5px solid #E8E0D4', borderRadius: '12px', padding: '16px 20px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ color: '#4A3B6B', fontSize: '14px', margin: 0, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>
          ¿Agendar otra visita?
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {compitaId && compitaNombre && (
            <a
              href={`/compitas?compita=${compitaId}`}
              style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '8px 18px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              Con {compitaNombre} →
            </a>
          )}
          <a
            href="/compitas"
            style={{ background: 'transparent', color: '#2D1464', border: '1.5px solid #D4CAE8', borderRadius: '9999px', padding: '8px 18px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Buscar otro compita
          </a>
        </div>
      </div>
    </div>
  )
}
