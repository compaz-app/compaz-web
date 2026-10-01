'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'
import type { Visita, Compita, Usuario, Mensaje } from '@/types'
import LogoutButton from '@/components/ui/LogoutButton'

type VisitaConRelaciones = Visita & { compita: Compita; usuario: Usuario }
type UsuarioConCompita = Usuario & { compita: { nombre: string; zona: string; verificado: boolean } | null }

interface Props {
  visitasActivas: VisitaConRelaciones[]
  usuarios: UsuarioConCompita[]
  compitas: Compita[]
  visitasPasadas: Visita[]
}

type Tab = 'visitas' | 'clientes' | 'compitas' | 'desactivadas' | 'historial' | 'cliente' | 'accesos'

export default function AdminDashboard({ visitasActivas: inicial, usuarios, compitas: todasCompitas, visitasPasadas }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = (searchParams.get('tab') as Tab) ?? 'visitas'
  const [tab, setTabState] = useState<Tab>(tabParam)

  function setTab(t: Tab) {
    setTabState(t)
    router.replace(`/admin?tab=${t}`, { scroll: false })
  }

  useEffect(() => {
    history.scrollRestoration = 'auto'
  }, [])
  const [visitasActivas, setVisitasActivas] = useState(inicial)
  const [visitaSeleccionada, setVisitaSeleccionada] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Record<string, Mensaje[]>>({})
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [generandoInvite, setGenerandoInvite] = useState(false)
  const [compitas, setCompitas] = useState(todasCompitas)
  const [busqueda, setBusqueda] = useState('')
  const [clientePreviewId, setClientePreviewId] = useState<string | null>(null)

  const compitasActivas = compitas.filter((c) => c.estado === 'activo')
  const compitasInactivas = compitas.filter((c) => c.estado === 'inactivo')

  function filtrar(lista: Compita[]) {
    const q = busqueda.toLowerCase().trim()
    if (!q) return lista
    return lista.filter((c) =>
      c.nombre.toLowerCase().includes(q) ||
      (c.codigo?.toLowerCase().includes(q) ?? false) ||
      c.zona.toLowerCase().includes(q)
    )
  }

  async function toggleEstado(compitaId: string, estadoActual: string) {
    const nuevoEstado = estadoActual === 'activo' ? 'inactivo' : 'activo'
    const res = await fetch('/api/admin/toggle-estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compita_id: compitaId, estado: nuevoEstado }),
    })
    if (res.ok) {
      setCompitas((prev) => prev.map((c) => c.id === compitaId ? { ...c, estado: nuevoEstado as 'activo' | 'inactivo' } : c))
    }
  }

  // Suscripción Realtime a visitas (nuevas, actualizadas)
  useEffect(() => {
    const supabase = createBrowserSupabase()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
    })
    const canal = supabase
      .channel('admin-visitas-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitas' }, async () => {
        const { data } = await supabase
          .from('visitas')
          .select('*, compita:compitas(*), usuario:usuarios(*)')
          .eq('estado', 'en_curso')
          .order('inicio', { ascending: false })
        if (data) setVisitasActivas(data as VisitaConRelaciones[])
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  // Suscripción Realtime a mensajes — sin filtro, filtramos en cliente
  useEffect(() => {
    const supabase = createBrowserSupabase()
    const canal = supabase
      .channel('admin-mensajes-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
        const m = payload.new as Mensaje
        setMensajes((prev) => ({
          ...prev,
          [m.visit_id]: [...(prev[m.visit_id] ?? []), m],
        }))
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  // Cargar mensajes de visita seleccionada
  useEffect(() => {
    if (!visitaSeleccionada || mensajes[visitaSeleccionada]) return
    const supabase = createBrowserSupabase()
    supabase
      .from('mensajes')
      .select('*')
      .eq('visit_id', visitaSeleccionada)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMensajes((prev) => ({ ...prev, [visitaSeleccionada]: (data ?? []) as Mensaje[] }))
      })
  }, [visitaSeleccionada, mensajes])

  async function asignarCompita(usuarioId: string, compitaId: string) {
    const res = await fetch('/api/admin/asignar-compita', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId, compita_id: compitaId }),
    })
    if (res.ok) window.location.reload()
  }

  async function generarInvite() {
    setGenerandoInvite(true)
    setInviteUrl(null)
    try {
      const res = await fetch('/api/admin/generar-invite', { method: 'POST' })
      const d = await res.json()
      if (d.url) setInviteUrl(d.url)
      else alert(d.error ?? 'Error generando invite')
    } finally {
      setGenerandoInvite(false)
    }
  }

  async function toggleVerificado(compitaId: string, actual: boolean) {
    const res = await fetch('/api/admin/toggle-verificado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compita_id: compitaId, verificado: !actual }),
    })
    if (res.ok) {
      setCompitas((prev) => prev.map((c) => c.id === compitaId ? { ...c, verificado: !actual } : c))
    }
  }

  const tabStyle = (t: Tab) => ({
    padding: '10px 20px',
    border: 'none',
    borderBottom: tab === t ? '3px solid #FF6B2B' : '3px solid transparent',
    background: 'none',
    color: tab === t ? '#FF6B2B' : '#6B5C90',
    fontFamily: 'Bricolage Grotesque, sans-serif',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', fontFamily: 'Inter, sans-serif' }}>
      <nav style={{ background: '#1A0A3C', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px' }}>
          Compaz Admin
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '4px 12px', fontSize: '13px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {visitasActivas.length} en curso
          </span>
          <LogoutButton />
        </div>
      </nav>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '2px solid #E8E0D4', display: 'flex', padding: '0 24px' }}>
        <button style={tabStyle('visitas')} onClick={() => setTab('visitas')}>Visitas activas</button>
        <button style={tabStyle('clientes')} onClick={() => setTab('clientes')}>Clientes ({usuarios.length})</button>
        <button style={tabStyle('compitas')} onClick={() => setTab('compitas')}>Compitas ({compitasActivas.length})</button>
        <button style={tabStyle('desactivadas')} onClick={() => setTab('desactivadas')}>Desactivadas ({compitasInactivas.length})</button>
        <button style={tabStyle('historial')} onClick={() => setTab('historial')}>Historial</button>
        <button style={tabStyle('accesos')} onClick={() => setTab('accesos')}>Accesos rápidos</button>
        {clientePreviewId && (
          <button style={{ ...tabStyle('cliente'), borderBottom: tab === 'cliente' ? '3px solid #22c55e' : '3px solid transparent', color: tab === 'cliente' ? '#16a34a' : '#6B5C90' }} onClick={() => setTab('cliente')}>
            👁 Ver cliente
          </button>
        )}
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Visitas activas ─────────────────────────────────────────────── */}
        {tab === 'visitas' && (
          <div>
            {visitasActivas.length === 0 ? (
              <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
                <p style={{ color: '#6B5C90' }}>No hay visitas activas en este momento.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: visitaSeleccionada ? '1fr 1fr' : '1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {visitasActivas.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => setVisitaSeleccionada(v.id === visitaSeleccionada ? null : v.id)}
                      style={{
                        background: 'white',
                        border: `2px solid ${v.id === visitaSeleccionada ? '#FF6B2B' : '#E8E0D4'}`,
                        borderRadius: '16px',
                        padding: '20px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                        <strong style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                          {v.compita.nombre}
                        </strong>
                        <span style={{ color: '#6B5C90', fontSize: '14px' }}>con {v.usuario.nombre}</span>
                      </div>
                      <div style={{ color: '#6B5C90', fontSize: '13px' }}>
                        Iniciada: {v.inicio ? new Date(v.inicio).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                      {(v as VisitaConRelaciones & { room_url?: string | null }).room_url && (
                        <div style={{ marginTop: '8px' }}>
                          <a
                            href={(v as VisitaConRelaciones & { room_url?: string | null }).room_url ?? ''}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ background: '#2D1464', color: 'white', borderRadius: '9999px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', textDecoration: 'none', display: 'inline-block' }}
                          >
                            📹 Unirse a la llamada
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {visitaSeleccionada && (
                  <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', height: '400px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '2px solid #E8E0D4' }}>
                      <strong style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif' }}>Chat en vivo (solo lectura)</strong>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(mensajes[visitaSeleccionada] ?? []).map((m) => (
                        <div key={m.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '11px', color: '#6B5C90', whiteSpace: 'nowrap', marginTop: '2px' }}>
                            {new Date(m.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span style={{ fontSize: '12px', color: '#FF6B2B', fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                            {m.origen}
                          </span>
                          {m.tipo === 'foto'
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={m.contenido ?? ''} alt="foto" style={{ maxWidth: '120px', borderRadius: '8px' }} />
                            : <span style={{ color: '#1A0A3C', fontSize: '14px' }}>{m.contenido}</span>
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Clientes ─────────────────────────────────────────────────────── */}
        {tab === 'clientes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <InvitarCliente />
            {usuarios.map((u) => (
              <div key={u.id} style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>{u.nombre}</div>
                  <div style={{ color: '#6B5C90', fontSize: '13px' }}>{u.email} · {u.zona ?? 'Sin zona'} · {u.plan ?? 'Sin plan'}</div>
                  <div style={{ color: '#4A3B6B', fontSize: '13px', marginTop: '4px' }}>
                    Compita: {u.compita ? `${u.compita.nombre} (${u.compita.zona})` : <em>Sin asignar</em>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <a
                    href={`/dashboard?preview=${u.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ background: 'white', color: '#16a34a', border: '2px solid #22c55e', borderRadius: '9999px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-block' }}
                  >
                    👁 Ver como cliente
                  </a>
                  <select
                    defaultValue={u.compita_id ?? ''}
                    onChange={(e) => asignarCompita(u.id, e.target.value)}
                    style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '8px 12px', fontFamily: 'Inter, sans-serif', color: '#1A0A3C', background: 'white', cursor: 'pointer' }}
                  >
                    <option value="">Sin Compita</option>
                    {compitas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre} — {c.zona}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Compitas activas ──────────────────────────────────────────────── */}
        {(tab === 'compitas' || tab === 'desactivadas') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Barra de herramientas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {tab === 'compitas' && (
                <button
                  onClick={generarInvite}
                  disabled={generandoInvite}
                  style={{ background: '#2D1464', color: 'white', border: 'none', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: generandoInvite ? 'not-allowed' : 'pointer', opacity: generandoInvite ? 0.6 : 1, whiteSpace: 'nowrap' }}
                >
                  {generandoInvite ? 'Generando…' : '+ Invitar Compita'}
                </button>
              )}
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, código o zona…"
                style={{ flex: 1, minWidth: '200px', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '9px 14px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', background: 'white', outline: 'none' }}
              />
            </div>

            {/* Instrucciones colapsables */}
            {tab === 'compitas' && <InstruccionesInvite />}

            {/* Link de invite */}
            {inviteUrl && tab === 'compitas' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '2px solid #E8E0D4', borderRadius: '12px', padding: '8px 14px' }}>
                <span style={{ fontSize: '13px', color: '#4A3B6B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{inviteUrl}</span>
                <button onClick={() => { navigator.clipboard.writeText(inviteUrl); alert('Link copiado') }} style={{ background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                  Copiar
                </button>
              </div>
            )}

            {/* Lista */}
            {filtrar(tab === 'compitas' ? compitasActivas : compitasInactivas).map((c) => (
              <div key={c.id} style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>{c.nombre}</span>
                    {c.codigo && <span style={{ fontSize: '11px', background: '#F5F0E8', color: '#4A3B6B', borderRadius: '6px', padding: '2px 8px', fontFamily: 'monospace' }}>{c.codigo}</span>}
                  </div>
                  <div style={{ color: '#6B5C90', fontSize: '13px', marginTop: '2px' }}>
                    {c.zona} · {c.visitas_realizadas} visitas · Chat ID: {c.telegram_chat_id ?? 'sin registrar'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => toggleVerificado(c.id, c.verificado)}
                    style={{ background: c.verificado ? '#2D1464' : 'white', color: c.verificado ? 'white' : '#2D1464', border: '2px solid #2D1464', borderRadius: '9999px', padding: '8px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                  >
                    {c.verificado ? '✓ Verificada' : 'Verificar'}
                  </button>
                  <button
                    onClick={() => toggleEstado(c.id, c.estado)}
                    style={{ background: 'white', color: c.estado === 'activo' ? '#dc2626' : '#22c55e', border: `2px solid ${c.estado === 'activo' ? '#dc2626' : '#22c55e'}`, borderRadius: '9999px', padding: '8px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                  >
                    {c.estado === 'activo' ? 'Desactivar' : 'Reactivar'}
                  </button>
                </div>
              </div>
            ))}

            {filtrar(tab === 'compitas' ? compitasActivas : compitasInactivas).length === 0 && (
              <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '40px', textAlign: 'center' }}>
                <p style={{ color: '#6B5C90' }}>{busqueda ? 'No hay resultados para esa búsqueda.' : tab === 'desactivadas' ? 'No hay Compitas desactivadas.' : 'No hay Compitas activas.'}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Accesos rápidos ───────────────────────────────────────────────── */}
        {tab === 'accesos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            <Section title="Flujos del cliente">
              <AccessLink href="/compitas" label="Marketplace de Compitas" desc="Lo que ve el cliente al buscar una Compita" />
              {usuarios.map((u) => (
                <AccessLink
                  key={u.id}
                  href={`/dashboard?preview=${u.id}`}
                  label={`Dashboard de ${u.nombre}`}
                  desc={u.email + (u.compita ? ` · Compita: ${u.compita.nombre}` : ' · Sin Compita')}
                  external
                />
              ))}
            </Section>

            <Section title="Flujos del Compita">
              <AccessLink href="/onboarding?preview=1" label="Formulario de registro" desc="El formulario que llena una Compita al inscribirse" external />
              <AccessLink href="https://t.me/CompazVisitasBot" label="Bot de Telegram" desc="@CompazVisitasBot — lo que ve la Compita al vincularse" external />
            </Section>

            <Section title="Páginas públicas">
              <AccessLink href="/" label="Landing page" desc="micompaz.com — página principal" external />
              <AccessLink href="/login" label="Login de clientes" desc="Página de inicio de sesión" external />
            </Section>

          </div>
        )}

        {/* ── Preview cliente ───────────────────────────────────────────────── */}
        {tab === 'cliente' && clientePreviewId && (
          <ClientePreview usuarioId={clientePreviewId} />
        )}

        {/* ── Historial ─────────────────────────────────────────────────────── */}
        {tab === 'historial' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(visitasPasadas as (Visita & { compita: { nombre: string }; usuario: { nombre: string; email: string } })[]).map((v) => {
              const duracion = v.inicio && v.fin
                ? `${Math.round((new Date(v.fin).getTime() - new Date(v.inicio).getTime()) / 60000)} min`
                : '—'
              return (
                <div key={v.id} style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '12px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>{v.compita?.nombre}</span>
                    <span style={{ color: '#6B5C90', fontSize: '13px' }}> con {v.usuario?.nombre}</span>
                  </div>
                  <div style={{ color: '#6B5C90', fontSize: '13px' }}>
                    {v.fin ? new Date(v.fin).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} · {duracion}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

type ClientePreviewData = {
  usuario: { nombre: string; email: string; plan: string | null; compita: { nombre: string; zona: string; verificado: boolean; foto_url: string | null } | null }
  visitaActiva: { id: string; inicio: string | null; compita: { nombre: string } } | null
  mensajes: { id: string; created_at: string; origen: string; tipo: string; contenido: string | null }[]
  visitasPasadas: { id: string; created_at: string; fin: string | null; inicio: string | null; compita: { nombre: string } }[]
}

function ClientePreview({ usuarioId }: { usuarioId: string }) {
  const [data, setData] = useState<ClientePreviewData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setCargando(true)
    fetch(`/api/admin/cliente-preview?usuario_id=${usuarioId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setCargando(false) })
      .catch(() => { setError('Error al cargar'); setCargando(false) })
  }, [usuarioId])

  if (cargando) return <div style={{ padding: '40px', textAlign: 'center', color: '#6B5C90' }}>Cargando vista del cliente…</div>
  if (error || !data?.usuario) return <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>{error || 'No se encontró el cliente'}</div>

  const { usuario, visitaActiva, mensajes, visitasPasadas } = data
  const compita = usuario.compita
  const totalVisitas = visitasPasadas.length + (visitaActiva ? 1 : 0)

  return (
    <div>
      <div style={{ background: '#F0FDF4', border: '2px solid #22c55e', borderRadius: '12px', padding: '10px 16px', marginBottom: '20px', fontSize: '13px', color: '#15803d', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
        Vista de cliente — {usuario.nombre} &lt;{usuario.email}&gt;
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Compita asignada */}
        {compita ? (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
            {compita.foto_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={compita.foto_url} alt={compita.nombre} style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h2 style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px', margin: 0 }}>{compita.nombre}</h2>
                {compita.verificado && (
                  <span style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '9999px', padding: '2px 10px', fontSize: '12px', color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>
                    <span style={{ color: '#FF6B2B' }}>✓</span> Verificada
                  </span>
                )}
              </div>
              <p style={{ color: '#6B5C90', fontSize: '14px', margin: '0 0 4px' }}>{compita.zona}</p>
              <p style={{ color: '#4A3B6B', fontSize: '14px', margin: 0 }}>
                Tu familiar ha recibido <strong>{totalVisitas}</strong> {totalVisitas === 1 ? 'visita' : 'visitas'} con Compaz
              </p>
            </div>
            {usuario.plan && (
              <div style={{ background: '#F5F0E8', borderRadius: '12px', padding: '10px 16px', textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: '11px', color: '#6B5C90', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Plan</div>
                <div style={{ color: '#2D1464', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>{usuario.plan}</div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: 'white', border: '2px solid #FF6B2B', borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '18px', color: '#1A0A3C', margin: '0 0 6px' }}>¿Aún no tienes Compita?</h3>
              <p style={{ color: '#6B5C90', fontSize: '14px', margin: 0 }}>Explora los perfiles disponibles y elige la que mejor se adapte a tu familiar.</p>
            </div>
          </div>
        )}

        {/* Chat de visita activa */}
        {visitaActiva ? (
          <div style={{ background: 'white', border: '2px solid #22c55e', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '2px solid #E8E0D4', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
              <strong style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif' }}>Visita en curso con {visitaActiva.compita.nombre}</strong>
              {visitaActiva.inicio && (
                <span style={{ color: '#6B5C90', fontSize: '13px' }}>desde {new Date(visitaActiva.inicio).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
            <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mensajes.length === 0 ? (
                <p style={{ color: '#6B5C90', fontSize: '14px', textAlign: 'center', margin: '20px 0' }}>Sin mensajes aún en esta visita.</p>
              ) : mensajes.map((m) => (
                <div key={m.id} style={{ display: 'flex', flexDirection: m.origen === 'compita' ? 'row' : 'row-reverse', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ background: m.origen === 'compita' ? '#F5F0E8' : '#2D1464', color: m.origen === 'compita' ? '#1A0A3C' : 'white', borderRadius: m.origen === 'compita' ? '4px 16px 16px 16px' : '16px 4px 16px 16px', padding: '10px 14px', maxWidth: '70%', fontSize: '14px' }}>
                    {m.tipo === 'foto'
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.contenido ?? ''} alt="foto" style={{ maxWidth: '200px', borderRadius: '8px', display: 'block' }} />
                      : m.contenido}
                  </div>
                  <span style={{ fontSize: '11px', color: '#A09AB8', whiteSpace: 'nowrap' }}>
                    {new Date(m.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '40px', textAlign: 'center' }}>
            <p style={{ color: '#6B5C90', fontSize: '16px' }}>No hay visita activa en este momento.</p>
            <p style={{ color: '#4A3B6B', fontSize: '14px', marginTop: '8px' }}>
              Cuando {compita?.nombre ?? 'la Compita'} inicie una visita, aparecerá aquí en tiempo real.
            </p>
          </div>
        )}

        {/* Historial */}
        {visitasPasadas.length > 0 && (
          <div>
            <h3 style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, marginBottom: '12px' }}>Visitas anteriores</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {visitasPasadas.map((v) => {
                const fecha = new Date(v.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
                const duracion = v.inicio && v.fin
                  ? `${Math.round((new Date(v.fin).getTime() - new Date(v.inicio).getTime()) / 60000)} min`
                  : '—'
                return (
                  <div key={v.id} style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '12px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#4A3B6B', fontSize: '15px' }}>{fecha}</span>
                    <span style={{ color: '#6B5C90', fontSize: '14px' }}>{duracion}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', marginBottom: '12px' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
    </div>
  )
}

function AccessLink({ href, label, desc, external }: { href: string; label: string; desc: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', gap: '12px' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#FF6B2B')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E8E0D4')}
    >
      <div>
        <div style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '15px' }}>{label}</div>
        <div style={{ color: '#6B5C90', fontSize: '13px', marginTop: '2px' }}>{desc}</div>
      </div>
      <span style={{ color: '#FF6B2B', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap', fontSize: '14px' }}>
        {external ? '↗' : '→'}
      </span>
    </a>
  )
}

function InvitarCliente() {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  async function invitar() {
    if (!nombre.trim() || !email.trim()) return
    setEstado('enviando')
    const res = await fetch('/api/admin/invitar-cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), email: email.trim() }),
    })
    if (res.ok) {
      setEstado('ok')
      setNombre('')
      setEmail('')
      setTimeout(() => { setEstado('idle'); setAbierto(false) }, 2000)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Error al invitar')
      setEstado('error')
    }
  }

  return (
    <div>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{ background: '#2D1464', color: 'white', border: 'none', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
      >
        + Invitar Cliente
      </button>
      {abierto && (
        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '20px', marginTop: '12px', display: 'flex', flexDirection: 'column' as const, gap: '12px', maxWidth: '480px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#4A3B6B' }}>El cliente recibirá un email con un link para entrar directo — sin contraseña.</p>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre completo"
            style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '9px 12px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', outline: 'none' }}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '9px 12px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', outline: 'none' }}
          />
          {estado === 'error' && <p style={{ margin: 0, color: '#C62828', fontSize: '13px' }}>{error}</p>}
          <button
            onClick={invitar}
            disabled={estado === 'enviando' || !nombre || !email}
            style={{ background: estado === 'ok' ? '#22c55e' : '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '10px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', opacity: (!nombre || !email) ? 0.5 : 1 }}
          >
            {estado === 'enviando' ? 'Enviando…' : estado === 'ok' ? '✓ Invitación enviada' : 'Enviar invitación'}
          </button>
        </div>
      )}
    </div>
  )
}

function InstruccionesInvite() {
  const [abierto, setAbierto] = useState(true)
  const pasos = [
    'Genera el link → mándalo por WhatsApp',
    'Ella llena su perfil',
    <>Abre <strong>@CompazVisitasBot</strong> → <code style={{ background: '#1A0A3C', color: 'white', borderRadius: '3px', padding: '1px 4px', fontSize: '11px' }}>/start</code> → escribe su nombre</>,
    <>Recibes aviso → dale <strong>Verificar</strong> aquí</>,
  ]
  return (
    <div style={{ fontSize: '12px', color: '#6B5C90' }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{ background: 'none', border: 'none', color: '#8B7AB0', fontSize: '12px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'Inter, sans-serif' }}
      >
        {abierto ? '▾' : '▸'} ¿Cómo funciona?
      </button>
      {abierto && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 0', marginTop: '8px', color: '#4A3B6B' }}>
          {pasos.map((paso, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ background: '#EDE9F6', color: '#5A3FB5', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span>{paso}</span>
              {i < pasos.length - 1 && <span style={{ color: '#C4B5E0', margin: '0 8px' }}>→</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
