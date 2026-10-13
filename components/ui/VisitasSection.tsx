'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'

type VisitaResumen = {
  id: string
  estado: string
  fecha_programada: string | null
  hora_inicio_programada: string | null
  hora_fin_programada: string | null
  inicio: string | null
  fin: string | null
  room_url: string | null
  created_at: string
  compita: { id: string; nombre: string; foto_url: string | null; zona: string } | null
}

type Grupos = {
  en_curso: VisitaResumen[]
  agendadas: VisitaResumen[]
  cerradas: VisitaResumen[]
}

type Tab = 'agendadas' | 'en_curso' | 'cerradas'

interface Props {
  usuarioId: string
  inicial: Grupos
}

export default function VisitasSection({ usuarioId, inicial }: Props) {
  const [grupos, setGrupos] = useState<Grupos>(inicial)
  const [tab, setTab] = useState<Tab>(() => {
    if (inicial.en_curso.length > 0) return 'en_curso'
    if (inicial.agendadas.length > 0) return 'agendadas'
    return 'cerradas'
  })
  const [actualizando, setActualizando] = useState(false)

  const cargar = useCallback(async () => {
    setActualizando(true)
    try {
      const res = await fetch('/api/visitas', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setGrupos(json.data as Grupos)
    } catch { /* silencioso */ } finally {
      setActualizando(false)
    }
  }, [])

  // Realtime Supabase — refresca cuando cambia cualquier visita del usuario
  useEffect(() => {
    const supabase = createBrowserSupabase()
    const canal = supabase
      .channel(`visitas-section-${usuarioId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitas', filter: `usuario_id=eq.${usuarioId}` }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [usuarioId, cargar])

  // Polling de respaldo cada 15 s (cubre cuando realtime no está activado)
  useEffect(() => {
    const t = setInterval(cargar, 15_000)
    return () => clearInterval(t)
  }, [cargar])

  const total = grupos.en_curso.length + grupos.agendadas.length + grupos.cerradas.length
  if (total === 0 && grupos.cerradas.length === 0) return null

  const tabs: { id: Tab; label: string; count: number; color: string }[] = [
    { id: 'en_curso',  label: 'En curso',  count: grupos.en_curso.length,  color: '#22c55e' },
    { id: 'agendadas', label: 'Agendadas', count: grupos.agendadas.length, color: '#7C4DFF' },
    { id: 'cerradas',  label: 'Cerradas',  count: grupos.cerradas.length,  color: '#9B8AB8' },
  ]

  const lista = grupos[tab]

  return (
    <section style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
          Visitas
        </h2>
        {actualizando && <span style={{ fontSize: '11px', color: '#9B8AB8' }}>↻ actualizando…</span>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? '#2D1464' : 'white',
              color: tab === t.id ? 'white' : '#4A3B6B',
              border: `2px solid ${tab === t.id ? '#2D1464' : '#E8E0D4'}`,
              borderRadius: '9999px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'Bricolage Grotesque, sans-serif',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{
                background: tab === t.id ? 'rgba(255,255,255,0.25)' : t.color,
                color: tab === t.id ? 'white' : 'white',
                borderRadius: '9999px',
                padding: '1px 7px',
                fontSize: '11px',
                fontWeight: 800,
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '32px 24px', textAlign: 'center', color: '#9B8AB8', fontSize: '14px' }}>
          {tab === 'en_curso'  && '🕐 No hay visitas en curso ahora mismo.'}
          {tab === 'agendadas' && '📅 No hay visitas agendadas.'}
          {tab === 'cerradas'  && '✅ Todavía no hay visitas cerradas.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {lista.map(v => <VisitaCard key={v.id} visita={v} tab={tab} />)}
        </div>
      )}
    </section>
  )
}

function VisitaCard({ visita, tab }: { visita: VisitaResumen; tab: Tab }) {
  const nombre = visita.compita?.nombre ?? 'Compita'

  const fechaLabel = (() => {
    if (visita.fecha_programada) {
      const f = new Date(visita.fecha_programada + 'T12:00:00').toLocaleDateString('es-VE', {
        weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Caracas',
      })
      const horario = visita.hora_inicio_programada && visita.hora_fin_programada
        ? `${visita.hora_inicio_programada} – ${visita.hora_fin_programada}`
        : null
      return horario ? `${f} · ${horario}` : f
    }
    if (visita.inicio) {
      return new Date(visita.inicio).toLocaleDateString('es-VE', {
        weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Caracas',
      })
    }
    return 'Coordinando fecha'
  })()

  const badge = tab === 'en_curso'
    ? { label: '🟢 En curso', bg: '#F0FDF4', color: '#15803d', border: '#22c55e' }
    : tab === 'agendadas' && visita.estado === 'programada'
    ? { label: '📅 Programada', bg: '#F5F0FF', color: '#2D1464', border: '#7C4DFF' }
    : tab === 'agendadas'
    ? { label: '💬 Coordinando', bg: '#F0FDF4', color: '#15803d', border: '#86EFAC' }
    : { label: '✅ Terminada', bg: '#F5F5F5', color: '#6B5C90', border: '#E8E0D4' }

  return (
    <div style={{ background: 'white', border: `2px solid ${badge.border}`, borderRadius: '16px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      {visita.compita?.foto_url
        ? <img src={visita.compita.foto_url} alt={nombre} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        : <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#2D1464', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '18px' }}>{nombre.charAt(0)}</span>
          </div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', color: '#1A0A3C' }}>{nombre}</span>
          <span style={{ background: badge.bg, color: badge.color, border: `1.5px solid ${badge.border}`, borderRadius: '9999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {badge.label}
          </span>
        </div>
        <p style={{ color: '#6B5C90', fontSize: '13px', margin: 0, textTransform: 'capitalize' }}>{fechaLabel}</p>
      </div>
      {tab === 'en_curso' && (
        <a href="#visita-en-curso" style={{ background: '#22c55e', color: 'white', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Ver visita ↓
        </a>
      )}
    </div>
  )
}
