'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Compita } from '@/types'
import LogoutButton from '@/components/ui/LogoutButton'
import MapaCoberturaWrapper from '@/components/ui/MapaCoberturaWrapper'
import { ZONAS_MUNICIPIOS as ZONAS } from '@/lib/venezuela'

interface Props {
  compitas: Compita[]
  usuarioNombre: string
  usuarioEmail: string
  backHref?: string
  backLabel?: string
}

import type { Solicitud } from '@/types'
import PerfilPublicoCompita from '@/components/ui/PerfilPublicoCompita'
import IconoPersona from '@/components/ui/IconoPersona'
import FotoRedonda from '@/components/ui/FotoRedonda'

export default function CompitasMarketplace({ compitas, usuarioNombre, usuarioEmail, backHref = '/dashboard', backLabel = '← Mi portal' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [estado, setEstadoState] = useState(searchParams.get('estado') ?? '')
  const [municipio, setMunicipioState] = useState(searchParams.get('municipio') ?? '')
  const [mapaAbierto, setMapaAbierto] = useState(searchParams.get('mapa') === '1')
  const [seleccionada, setSeleccionada] = useState<Compita | null>(null)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [agendando, setAgendando] = useState(false)
  const [errorAgendar, setErrorAgendar] = useState('')
  const [compitaAsignadaId, setCompitaAsignadaId] = useState<string | null>(null)
  const [compitasConHistorial, setCompitasConHistorial] = useState<string[]>([])
  const resultadosRef = useRef<HTMLDivElement>(null)

  async function agendarOtraVisita() {
    if (agendando) return
    setAgendando(true)
    setErrorAgendar('')
    try {
      const res = await fetch('/api/visita/nueva', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        router.push('/dashboard')
      } else {
        setErrorAgendar(data.error ?? 'No se pudo agendar. Intenta desde tu portal.')
        setAgendando(false)
      }
    } catch {
      setErrorAgendar('Error de conexión. Intenta de nuevo.')
      setAgendando(false)
    }
  }

  useEffect(() => {
    fetch('/api/usuario/yo')
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.compita_id) setCompitaAsignadaId(d.data.compita_id)
        if (Array.isArray(d.data?.compitas_con_historial)) setCompitasConHistorial(d.data.compitas_con_historial)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/mis-solicitudes')
      .then((r) => r.json())
      .then((d) => {
        if (d.solicitudes) {
          setSolicitudes(d.solicitudes)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => { history.scrollRestoration = 'auto' }, [])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSeleccionada(null)
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  // Abrir modal directamente si viene ?compita=<id> en la URL (ej: link desde email de rechazo)
  useEffect(() => {
    const id = searchParams.get('compita')
    if (!id) return
    const encontrada = compitas.find((c) => c.id === id)
    if (encontrada) setSeleccionada(encontrada)
  }, [compitas, searchParams])

  // Auto-scroll a resultados cuando se selecciona un municipio
  useEffect(() => {
    if (!municipio) return
    const el = resultadosRef.current
    if (!el) return
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, [municipio])

  function setEstado(v: string) {
    setEstadoState(v)
    const p = new URLSearchParams(searchParams.toString())
    p.set('estado', v)
    p.delete('municipio')
    router.replace(`/compitas?${p.toString()}`, { scroll: false })
  }

  function setMunicipio(v: string) {
    setMunicipioState(v)
    const p = new URLSearchParams(searchParams.toString())
    p.set('municipio', v)
    router.replace(`/compitas?${p.toString()}`, { scroll: false })
  }

  function toggleMapa() {
    const nuevo = !mapaAbierto
    setMapaAbierto(nuevo)
    const p = new URLSearchParams(searchParams.toString())
    if (nuevo) p.set('mapa', '1')
    else p.delete('mapa')
    router.replace(`/compitas?${p.toString()}`, { scroll: false })
  }

  function setZona(nuevoEstado: string, nuevoMunicipio: string) {
    setEstadoState(nuevoEstado)
    setMunicipioState(nuevoMunicipio)
    const p = new URLSearchParams(searchParams.toString())
    p.set('estado', nuevoEstado)
    if (nuevoMunicipio) p.set('municipio', nuevoMunicipio)
    else p.delete('municipio')
    router.replace(`/compitas?${p.toString()}`, { scroll: false })
  }

  const zonaFiltro = estado && municipio ? `${estado} — ${municipio}` : ''

  const lista = zonaFiltro
    ? compitas.filter((c) => c.zona?.includes(zonaFiltro))
    : compitas

  const solicitudesPendientes = solicitudes.filter((s) => s.estado === 'pendiente')
  const solicitudesAceptadas = solicitudes.filter((s) => s.estado === 'aceptada')
  const solicitudesActivas = [...solicitudesPendientes, ...solicitudesAceptadas]
  const idsYaSolicitados = new Set(solicitudesActivas.map((s) => s.compita_id))
  const MAX_SOLICITUDES = 3

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', fontFamily: 'Inter, sans-serif' }}>
      <nav style={{ background: '#2D1464', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px' }}>Compaz</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href={backHref} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', textDecoration: 'none' }}>{backLabel}</a>
          <LogoutButton />
        </div>
      </nav>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '28px', color: '#1A0A3C', marginBottom: '8px' }}>
          Encuentra tu Compita
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ background: '#F0FDF4', border: '1.5px solid #22c55e', color: '#15803d', borderRadius: '9999px', padding: '3px 12px', fontSize: '13px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            ✓ {compitas.length} {compitas.length === 1 ? 'Compita disponible' : 'Compitas disponibles'}
          </span>
        </div>

        {/* Aviso de entrevistas confirmadas — arriba del mapa */}
        {solicitudesAceptadas.length > 0 && (
          <div style={{ background: '#FF6B2B', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '17px', marginBottom: '4px' }}>
                {solicitudesAceptadas.length === 1
                  ? `¡${solicitudesAceptadas[0].compita_nombre} confirmó tu entrevista!`
                  : `¡Tienes ${solicitudesAceptadas.length} entrevistas confirmadas!`}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>
                Entra a tu portal para ver el horario y el enlace de la llamada.
              </div>
            </div>
            <a
              href={backHref}
              style={{ background: 'white', color: '#FF6B2B', borderRadius: '9999px', padding: '12px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Ver en mi portal →
            </a>
          </div>
        )}

        {/* Selector de zona */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
          <select value={estado} onChange={(e) => { setEstado(e.target.value); setMunicipioState('') }} style={{ ...s.selectCompact, flex: 1, minWidth: '140px' }}>
            <option value="">Estado…</option>
            {Object.keys(ZONAS).sort().map((est) => (
              <option key={est} value={est}>{est}</option>
            ))}
          </select>
          <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} disabled={!estado} style={{ ...s.selectCompact, flex: 1, minWidth: '140px', opacity: estado ? 1 : 0.4 }}>
            <option value="">Municipio…</option>
            {(ZONAS[estado] ?? []).sort().map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {(estado || municipio) && (
            <button
              onClick={() => setZona('', '')}
              style={{ background: 'none', border: '1.5px solid #D4C9E8', borderRadius: '9999px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: '#6B5C90', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Limpiar ×
            </button>
          )}
        </div>

        {/* Mapa plegable */}
        <button
          onClick={toggleMapa}
          style={{ background: mapaAbierto ? '#EDE8FF' : 'white', border: `2px solid ${mapaAbierto ? '#7C3AED' : '#D4C9E8'}`, borderRadius: '9999px', padding: '10px 18px', cursor: 'pointer', color: mapaAbierto ? '#2D1464' : '#4A3B6B', fontSize: '14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {mapaAbierto ? 'Ocultar mapa' : 'Buscar en el mapa'}
          <span style={{ fontSize: '11px', marginLeft: '2px' }}>{mapaAbierto ? '▲' : '▼'}</span>
        </button>
        {mapaAbierto && (
          <MapaCoberturaWrapper
            hideToggle
            selectedEstado={estado}
            selectedMunicipio={municipio}
            onEstadoSelect={(est) => setZona(est, '')}
            onMunicipioSelect={(est, mun) => setZona(est, mun)}
          />
        )}
        <div style={{ height: '12px' }} />

        {/* Banner de solicitudes pendientes */}
        {(() => {
          const usados = solicitudesPendientes.length
          const lleno = usados >= MAX_SOLICITUDES
          if (usados === 0) return null
          return (
            <div style={{ background: '#F5F0FF', border: '2px solid #D4C0FF', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px' }}>
              {/* Título + contador */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', color: '#1A0A3C' }}>
                  Solicitudes enviadas
                </span>
                <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', color: lleno ? '#C84B0E' : '#6B5C90' }}>
                  {usados} de {MAX_SOLICITUDES}
                </span>
              </div>
              {/* Barra */}
              <div style={{ height: '6px', borderRadius: '9999px', background: 'rgba(45,20,100,0.1)', overflow: 'hidden', marginBottom: '14px' }}>
                <div style={{ height: '100%', width: `${(usados / MAX_SOLICITUDES) * 100}%`, borderRadius: '9999px', background: lleno ? '#FF6B2B' : '#7C3AED', transition: 'width 0.4s ease' }} />
              </div>
              {/* Lista de pendientes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {solicitudesPendientes.map((s) => (
                  <div key={s.id} style={{ background: 'white', borderRadius: '12px', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', border: '1.5px solid #E8E0D4' }}>
                    {s.compita_foto
                      ? <FotoRedonda src={s.compita_foto} alt={s.compita_nombre ?? ''} size={32} />
                      : <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F0EBF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}><IconoPersona /></div>
                    }
                    <span style={{ flex: 1, color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.compita_nombre}</span>
                    <span style={{ color: '#9B8AB8', fontSize: '12px', flexShrink: 0 }}>Esperando respuesta</span>
                  </div>
                ))}
              </div>
              {lleno && (
                <p style={{ color: '#C84B0E', fontSize: '13px', fontWeight: 600, marginTop: '12px', marginBottom: 0 }}>
                  Límite alcanzado — cuando una compita responda podrás enviar otra.
                </p>
              )}
            </div>
          )
        })()}

        {/* Resultados */}
        <div ref={resultadosRef} />
        {!zonaFiltro && !estado && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#6B5C90' }}>
            Elige el estado donde vive tu familiar para ver los compitas disponibles.
          </div>
        )}
        {estado && !municipio && (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6B5C90' }}>
            Ahora selecciona un municipio de {estado} para ver los compitas disponibles.
          </div>
        )}

        {zonaFiltro && lista.length === 0 && (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#6B5C90', fontSize: '16px' }}>No hay compitas disponibles en {zonaFiltro} por ahora.</p>
            <p style={{ color: '#4A3B6B', fontSize: '14px', marginTop: '8px' }}>Pronto habrá más Compitas en esta zona.</p>
            <a
              href={`mailto:hola@micompaz.com?subject=Quiero%20una%20Compita%20en%20${encodeURIComponent(zonaFiltro)}&body=Hola%2C%20me%20interesa%20una%20Compita%20en%20${encodeURIComponent(zonaFiltro)}%20para%20acompañar%20a%20mi%20familiar.%20Quiero%20que%20me%20avisen%20cuando%20haya%20disponibilidad.`}
              style={{ display: 'inline-block', marginTop: '16px', background: '#2D1464', color: 'white', borderRadius: '9999px', padding: '12px 24px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none' }}
            >
              Escríbenos a hola@micompaz.com
            </a>
          </div>
        )}

        {/* Lista compacta — excluye las ya solicitadas (aparecen en el banner) */}
        {(() => {
          const disponibles = lista.filter((c) => !idsYaSolicitados.has(c.id))
          if (zonaFiltro && disponibles.length === 0 && lista.length > 0) {
            return (
              <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
                <p style={{ color: '#6B5C90', fontSize: '15px', marginBottom: '6px' }}>Ya enviaste solicitudes a todas las compitas de {zonaFiltro}.</p>
                <p style={{ color: '#9B8AB8', fontSize: '13px' }}>Espera su respuesta o busca en otra zona.</p>
              </div>
            )
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {disponibles.map((compita) => (
                <div
                  key={compita.id}
                  onClick={() => setSeleccionada(compita)}
                  style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '14px', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'border-color 0.12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#FF6B2B')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E8E0D4')}
                >
                  {/* Avatar */}
                  {compita.foto_url
                    ? <FotoRedonda src={compita.foto_url} alt={compita.nombre} size={52} />
                    : <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F0EBF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}><IconoPersona /></div>
                  }
                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                      <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '15px', color: '#1A0A3C' }}>{compita.nombre}</span>
                      {compita.verificado && <span style={{ ...s.badge, fontSize: '10px', padding: '1px 7px' }}>✓ Verificada</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#9B8AB8', fontSize: '12px' }}>{compita.zona?.split(',')[0]?.split('—')[1]?.trim() ?? compita.zona}</span>
                      {compita.visitas_realizadas > 0 && <span style={{ color: '#9B8AB8', fontSize: '12px' }}>· {compita.visitas_realizadas} visitas</span>}
                      {compita.rating_promedio != null && compita.total_ratings > 0 && (
                        <span style={{ color: '#F59E0B', fontSize: '12px', fontWeight: 700 }}>★ {compita.rating_promedio.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                  {/* CTA */}
                  <span style={{ color: '#FF6B2B', fontSize: '18px', fontWeight: 700, flexShrink: 0 }}>›</span>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Modal de perfil */}
      {seleccionada && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,60,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 2000 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setSeleccionada(null) } }}
        >
          <div style={{ background: '#FDFAF6', borderRadius: '24px', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => { setSeleccionada(null) }} style={{ position: 'absolute', top: '16px', right: '16px', background: 'white', border: '2px solid #E8E0D4', borderRadius: '9999px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', zIndex: 10 }}>×</button>

            <div style={{ padding: '28px' }}>
              <PerfilPublicoCompita compita={seleccionada} />

              {(seleccionada.id === compitaAsignadaId || compitasConHistorial.includes(seleccionada.id)) ? (
                /* Cliente que ya tiene esta compita asignada — ir directo al agendamiento */
                <div>
                  <p style={{ color: '#6B5C90', fontSize: '14px', marginBottom: '12px', lineHeight: 1.5 }}>
                    Ya trabajas con {seleccionada.nombre}. Abre el chat en tu portal y coordinen la fecha de la próxima visita juntos.
                  </p>
                  {errorAgendar && <p style={{ color: '#E05520', fontSize: '13px', marginBottom: '8px' }}>{errorAgendar}</p>}
                  <button
                    onClick={agendarOtraVisita}
                    disabled={agendando}
                    style={{ width: '100%', background: agendando ? '#D4C9E8' : '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', cursor: agendando ? 'not-allowed' : 'pointer' }}
                  >
                    {agendando ? 'Agendando…' : `Agendar otra visita con ${seleccionada.nombre}`}
                  </button>
                </div>
              ) : idsYaSolicitados.has(seleccionada.id) ? (
                <div style={{ background: '#FFF3E8', border: '2px solid #FF6B2B', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <p style={{ color: '#C84B0E', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', margin: '0 0 6px' }}>Solicitud enviada</p>
                  <p style={{ color: '#6B5C90', fontSize: '13px', margin: 0 }}>Ya solicitaste conocer a {seleccionada.nombre}. Te avisaremos cuando confirme un horario.</p>
                </div>
              ) : solicitudesActivas.length >= MAX_SOLICITUDES ? (
                <div style={{ background: '#F5F0E8', border: '2px solid #D4C9E8', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <p style={{ color: '#4A3B6B', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', margin: '0 0 6px' }}>Límite de solicitudes alcanzado</p>
                  <p style={{ color: '#6B5C90', fontSize: '13px', margin: 0 }}>Ya tienes {MAX_SOLICITUDES} solicitudes pendientes.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <a
                    href={`/solicitar?compita=${seleccionada.id}&modo=entrevista`}
                    style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', textDecoration: 'none', background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', cursor: 'pointer' }}
                  >
                    Solicitar entrevista
                  </a>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <a href={`/solicitar?compita=${seleccionada.id}&modo=directa`} style={{ flex: '1 1 160px', textAlign: 'center', boxSizing: 'border-box', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #2D1464', borderRadius: '9999px', color: '#2D1464', fontWeight: 700, fontSize: '14px', textDecoration: 'none', padding: '0 14px' }}>Contratarlo directo</a>
                    <a href={`/solicitar?compita=${seleccionada.id}&modo=mandado`} style={{ flex: '1 1 160px', textAlign: 'center', boxSizing: 'border-box', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #2D1464', borderRadius: '9999px', color: '#2D1464', fontWeight: 700, fontSize: '14px', textDecoration: 'none', padding: '0 14px' }}>Pedir un mandado</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  label: { display: 'block', fontWeight: 600, fontSize: '13px', color: '#1A0A3C', marginBottom: '6px' } as React.CSSProperties,
  select: { width: '100%', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', boxSizing: 'border-box' as const },
  selectCompact: { border: '1.5px solid #D4C9E8', borderRadius: '9999px', padding: '7px 14px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', cursor: 'pointer' } as React.CSSProperties,
  badge: { background: 'white', border: '2px solid #E8E0D4', borderRadius: '9999px', padding: '2px 8px', fontSize: '11px', color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: '3px' },
  chip: { background: '#F5F0E8', color: '#4A3B6B', borderRadius: '9999px', padding: '4px 10px', fontSize: '12px', fontFamily: 'Bricolage Grotesque, sans-serif' } as React.CSSProperties,
}
