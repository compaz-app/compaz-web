'use client'

// El perfil público de un compita, tal como lo ve la familia (foto, nombre, calificación, sobre mí, servicios, zonas, disponibilidad, video y reseñas
// publicadas). Es la MISMA pieza para el listado de la familia y para la vista del equipo: así lo que el equipo revisa es lo que de verdad se publica.
import { useState, useEffect } from 'react'
import type { Compita } from '@/types'
import IconoPersona from '@/components/ui/IconoPersona'
import FotoRedonda from '@/components/ui/FotoRedonda'

const estilo = {
  badge: { background: 'white', border: '2px solid #E8E0D4', borderRadius: '9999px', padding: '2px 8px', fontSize: '11px', color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: '3px' },
  chip: { background: '#F5F0E8', color: '#4A3B6B', borderRadius: '9999px', padding: '4px 10px', fontSize: '12px', fontFamily: 'Bricolage Grotesque, sans-serif' } as React.CSSProperties,
}

type ResenaPublica = { id: string; texto: string; estrellas: number; created_at: string }

function ResenasCompita({ compitaId }: { compitaId: string }) {
  const [resenas, setResenas] = useState<ResenaPublica[] | null>(null)
  useEffect(() => {
    fetch(`/api/compita/resenas?compita_id=${compitaId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.data)) setResenas(d.data) })
      .catch(() => setResenas([]))
  }, [compitaId])

  if (!resenas || resenas.length === 0) return null
  return (
    <div style={{ marginBottom: '20px' }}>
      <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '12px' }}>Reseñas de clientes</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {resenas.map((r) => (
          <div key={r.id} style={{ background: '#F5F0FF', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span style={{ color: '#F59E0B', fontSize: '13px' }}>{'★'.repeat(r.estrellas)}{'☆'.repeat(5 - r.estrellas)}</span>
            </div>
            <p style={{ color: '#1A0A3C', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{r.texto}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PerfilPublicoCompita({ compita }: { compita: Compita }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px', paddingRight: '28px' }}>
        {compita.foto_url
          ? <FotoRedonda src={compita.foto_url} alt={compita.nombre} size={80} />
          : <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#F0EBF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', flexShrink: 0 }}><IconoPersona /></div>
        }
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px', color: '#1A0A3C', margin: '0 0 4px' }}>{compita.nombre}</h2>
          {compita.verificado && <span style={estilo.badge}>✓ Verificada</span>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {compita.rating_promedio != null && compita.total_ratings > 0 && (
          <span style={{ fontSize: '14px', color: '#F59E0B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
            ★ <span style={{ color: '#1A0A3C' }}>{compita.rating_promedio.toFixed(1)}</span>
            <span style={{ color: '#9B8AB8', fontWeight: 400, fontSize: '13px' }}>({compita.total_ratings} {compita.total_ratings === 1 ? 'calificación' : 'calificaciones'})</span>
          </span>
        )}
        <span style={{ color: '#6B5C90', fontSize: '13px' }}>{compita.visitas_realizadas} visitas realizadas</span>
        {compita.tasa_aceptacion != null && (
          <span style={{
            fontSize: '12px', fontWeight: 700, borderRadius: '9999px', padding: '3px 10px',
            fontFamily: 'Bricolage Grotesque, sans-serif',
            background: compita.tasa_aceptacion >= 80 ? '#DCFCE7' : compita.tasa_aceptacion >= 60 ? '#FEF9C3' : '#FEE2E2',
            color: compita.tasa_aceptacion >= 80 ? '#166534' : compita.tasa_aceptacion >= 60 ? '#854D0E' : '#991B1B',
          }}>
            {compita.tasa_aceptacion}% de aceptación
          </span>
        )}
      </div>

      {compita.descripcion && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '8px' }}>Sobre mí</p>
          <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: '1.7', whiteSpace: 'pre-line' }}>{compita.descripcion}</p>
        </div>
      )}

      {compita.servicios && compita.servicios.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '10px' }}>Servicios</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {compita.servicios.map((sv) => (
              <span key={sv} style={estilo.chip}>{sv}</span>
            ))}
          </div>
        </div>
      )}

      {compita.zona && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '10px' }}>Zonas que cubre</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {compita.zona.split(',').map((z) => (
              <span key={z} style={{ ...estilo.chip, background: '#EDE8FF', color: '#2D1464' }}>{z.trim()}</span>
            ))}
          </div>
        </div>
      )}

      {compita.horarios_disponibles && compita.horarios_disponibles.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '10px' }}>Disponibilidad</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {['lunes','martes','miércoles','jueves','viernes','sábado','domingo'].map((dia) => {
              const bloques = compita.horarios_disponibles!.filter((h) => h.dia === dia)
              if (bloques.length === 0) return null
              return (
                <div key={dia} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px' }}>
                  <span style={{ color: '#6B5C90', minWidth: '80px', textTransform: 'capitalize', fontWeight: 600 }}>{dia}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {bloques.map((b, i) => (
                      <span key={i} style={{ background: '#F5F0FF', color: '#2D1464', borderRadius: '9999px', padding: '2px 10px', fontSize: '13px' }}>
                        {b.inicio} – {b.fin}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {compita.youtube_url && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontWeight: 700, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: '10px' }}>Video de presentación</p>
          <iframe
            src={(() => {
              const u = compita.youtube_url
              try {
                const parsed = new URL(u)
                const v = parsed.searchParams.get('v')
                if (v) return `https://www.youtube.com/embed/${v}`
                const parts = parsed.pathname.split('/').filter(Boolean)
                const id = parts[parts.length - 1]
                return `https://www.youtube.com/embed/${id}`
              } catch { return u }
            })()}
            style={{ width: '100%', height: '200px', borderRadius: '12px', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      <ResenasCompita compitaId={compita.id} />
    </>
  )
}
