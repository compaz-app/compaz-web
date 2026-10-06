'use client'

import { useState } from 'react'
import type { ReporteVisita } from '@/types'

type Props = {
  reportes: ReporteVisita[]
  compitaNombre: string
}

const INDICADORES: { key: keyof Pick<ReporteVisita, 'animo' | 'fisico' | 'participacion' | 'entorno'>; label: string; emoji: string }[] = [
  { key: 'animo', label: 'Ánimo', emoji: '😊' },
  { key: 'fisico', label: 'Condición física', emoji: '💪' },
  { key: 'participacion', label: 'Participación', emoji: '🤝' },
  { key: 'entorno', label: 'Ambiente y entorno', emoji: '🏠' },
]

const ESCALA: Record<number, { label: string; color: string }> = {
  1: { label: 'Muy bajo', color: '#EF4444' },
  2: { label: 'Bajo', color: '#F97316' },
  3: { label: 'Regular', color: '#EAB308' },
  4: { label: 'Bueno', color: '#22C55E' },
  5: { label: 'Excelente', color: '#16A34A' },
}

const DEMO_REPORTES: ReporteVisita[] = [
  { id: 'demo1', visita_id: 'd1', animo: 4, fisico: 3, participacion: 4, entorno: 5, novedad: null, resumen_ia: 'El familiar estuvo de buen ánimo durante toda la visita.', created_at: new Date(Date.now() - 14 * 86400000).toISOString() },
  { id: 'demo2', visita_id: 'd2', animo: 3, fisico: 3, participacion: 3, entorno: 4, novedad: 'Mencionó dolor de rodilla derecha.', resumen_ia: 'La visita transcurrió con normalidad aunque con algo de fatiga.', created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
  { id: 'demo3', visita_id: 'd3', animo: 5, fisico: 4, participacion: 5, entorno: 5, novedad: null, resumen_ia: 'Excelente visita. Notablemente más activo que la semana pasada.', created_at: new Date(Date.now() - 86400000).toISOString() },
]

function TrendArrow({ current, prev }: { current: number | null; prev: number | null }) {
  if (current === null || prev === null) return null
  const diff = current - prev
  if (diff === 0) return <span style={{ color: '#9B8AB8', fontSize: '14px' }}>→</span>
  return diff > 0
    ? <span style={{ color: '#22C55E', fontSize: '14px' }}>↑</span>
    : <span style={{ color: '#EF4444', fontSize: '14px' }}>↓</span>
}

function MiniChart({ data, color }: { data: (number | null)[]; color: string }) {
  const valid = data.filter((v) => v !== null) as number[]
  if (valid.length < 2) return null

  const W = 120
  const H = 40
  const PAD = 4

  // Map each non-null to x position based on its index in original array
  const points: { x: number; y: number }[] = []
  const totalSlots = data.length
  data.forEach((v, i) => {
    if (v !== null) {
      const x = PAD + (i / (totalSlots - 1)) * (W - 2 * PAD)
      const y = PAD + ((5 - v) / 4) * (H - 2 * PAD)
      points.push({ x, y })
    }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
      ))}
    </svg>
  )
}

export default function SeguimientoBienestar({ reportes, compitaNombre }: Props) {
  const [showDemo, setShowDemo] = useState(false)
  const mostrandoDatos = showDemo ? DEMO_REPORTES : reportes
  const sinDatos = reportes.length === 0

  return (
    <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', color: '#1A0A3C', margin: 0 }}>
          📊 Seguimiento de bienestar
        </h3>
        {sinDatos && (
          <button
            onClick={() => setShowDemo((v) => !v)}
            style={{ background: showDemo ? '#F5F0FF' : 'transparent', border: '1.5px solid #D4CAE8', borderRadius: '9999px', padding: '6px 14px', fontSize: '13px', color: '#7C4DFF', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, cursor: 'pointer' }}
          >
            {showDemo ? 'Ocultar ejemplo' : 'Ver ejemplo →'}
          </button>
        )}
      </div>

      {sinDatos && !showDemo && (
        <p style={{ color: '#9B8AB8', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
          Después de cada visita, {compitaNombre} registra cómo estuvo tu familiar. Aquí verás el historial de bienestar visita a visita.
        </p>
      )}

      {showDemo && sinDatos && (
        <div style={{ background: '#F5F0FF', border: '1.5px solid #D4CAE8', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px' }}>
          <p style={{ color: '#7C4DFF', fontSize: '12px', fontWeight: 700, margin: '0 0 2px', fontFamily: 'Bricolage Grotesque, sans-serif' }}>Ejemplo con datos ilustrativos</p>
          <p style={{ color: '#4A3B6B', fontSize: '12px', margin: 0 }}>Así lucirá la sección cuando haya visitas registradas.</p>
        </div>
      )}

      {mostrandoDatos.length > 0 && (
        <>
          {/* Indicadores con último valor */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {INDICADORES.map(({ key, label, emoji }) => {
              const valores = mostrandoDatos.map((r) => r[key] as number | null)
              const ultimo = valores[valores.length - 1]
              const penultimo = valores.length >= 2 ? valores[valores.length - 2] : null
              const meta = ultimo !== null ? ESCALA[ultimo] : null

              return (
                <div key={key} style={{ background: '#FDFAF6', border: '1.5px solid #E8E0D4', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '13px', color: '#6B5C90', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{emoji}</span>
                    <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>{label}</span>
                  </div>
                  {ultimo !== null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'Bricolage Grotesque, sans-serif', color: meta?.color ?? '#1A0A3C' }}>{ultimo}/5</span>
                      <TrendArrow current={ultimo} prev={penultimo} />
                      <span style={{ fontSize: '12px', color: '#6B5C90' }}>{meta?.label}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '13px', color: '#9B8AB8' }}>No aplica</span>
                  )}
                  {mostrandoDatos.length >= 2 && (
                    <div style={{ marginTop: '8px' }}>
                      <MiniChart data={valores} color={meta?.color ?? '#7C4DFF'} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Leyenda */}
          <div style={{ background: '#F5F0FF', border: '1.5px solid #D4CAE8', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ color: '#2D1464', fontSize: '12px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', margin: '0 0 6px' }}>Escala de referencia</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(ESCALA).map(([v, { label, color }]) => (
                <span key={v} style={{ fontSize: '12px', color: '#4A3B6B' }}>
                  <span style={{ color, fontWeight: 700 }}>{v}</span> {label}
                </span>
              ))}
              <span style={{ fontSize: '12px', color: '#9B8AB8' }}>N/A No aplica</span>
            </div>
          </div>

          {/* Última novedad */}
          {(() => {
            const ultimaNovedad = [...mostrandoDatos].reverse().find((r) => r.novedad)
            if (!ultimaNovedad) return null
            const fecha = new Date(ultimaNovedad.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })
            return (
              <div style={{ background: '#FFF3E8', border: '1.5px solid #FF6B2B', borderRadius: '10px', padding: '12px 16px' }}>
                <p style={{ color: '#C84B0E', fontSize: '12px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', margin: '0 0 4px' }}>Última novedad reportada ({fecha})</p>
                <p style={{ color: '#1A0A3C', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>{ultimaNovedad.novedad}</p>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
