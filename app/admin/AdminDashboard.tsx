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

type Tab = 'visitas' | 'clientes' | 'compitas' | 'desactivadas' | 'historial' | 'cliente' | 'accesos' | 'perfil'

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
  const [filtroDesactivadas, setFiltroDesactivadas] = useState<'todas' | 'inactivo' | 'bloqueado'>('todas')
  const [clientePreviewId, setClientePreviewId] = useState<string | null>(null)
  const [compitaPerfilId, setCompitaPerfilId] = useState<string | null>(null)

  const compitasPendientes = compitas.filter((c) => c.estado === 'activo' && !c.verificado)
  const compitasEnMapa = compitas.filter((c) => c.estado === 'activo' && c.verificado && !!c.telegram_chat_id)
  const compitasSinTelegram = compitas.filter((c) => c.estado === 'activo' && c.verificado && !c.telegram_chat_id)
  const compitasVerificadas = compitas.filter((c) => c.estado === 'activo' && c.verificado)
  const compitasInactivas = compitas.filter((c) => c.estado === 'inactivo')
  const compitasBloqueadas = compitas.filter((c) => c.estado === 'bloqueado')

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
      if (d.data?.url) setInviteUrl(d.data.url)
      else alert(d.error ?? 'Error generando invite')
    } finally {
      setGenerandoInvite(false)
    }
  }

  async function toggleBloqueado(compitaId: string, bloqueado: boolean) {
    const res = await fetch('/api/admin/bloquear-compita', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compita_id: compitaId, bloquear: !bloqueado }),
    })
    const d = await res.json()
    if (res.ok && d.ok) {
      setCompitas((prev) => prev.map((c) =>
        c.id === compitaId ? { ...c, estado: bloqueado ? 'inactivo' : 'bloqueado' as const, verificado: false } : c
      ))
    } else {
      alert(d.error ?? `Error al ${bloqueado ? 'desbloquear' : 'bloquear'}: status ${res.status}`)
    }
  }

  const [usuariosState, setUsuariosState] = useState(usuarios)

  async function eliminarCliente(usuarioId: string) {
    const res = await fetch('/api/admin/eliminar-cliente', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId }),
    })
    if (res.ok) {
      setUsuariosState((prev) => prev.filter((u) => u.id !== usuarioId))
    }
  }

  async function eliminarCompita(compitaId: string) {
    const res = await fetch('/api/admin/eliminar-compita', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compita_id: compitaId }),
    })
    if (res.ok) {
      setCompitas((prev) => prev.filter((c) => c.id !== compitaId))
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
        <button style={tabStyle('compitas')} onClick={() => setTab('compitas')}>
          Compitas {compitasPendientes.length > 0 && <span style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '11px', fontWeight: 800, marginLeft: '4px' }}>{compitasPendientes.length}</span>}
        </button>
        <button style={tabStyle('desactivadas')} onClick={() => setTab('desactivadas')}>
          Desactivadas ({compitasInactivas.length + compitasBloqueadas.length})
          {compitasBloqueadas.length > 0 && <span style={{ background: '#dc2626', color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '11px', fontWeight: 800, marginLeft: '4px' }}>{compitasBloqueadas.length}</span>}
        </button>
        <button style={tabStyle('historial')} onClick={() => setTab('historial')}>Historial</button>
        <button style={tabStyle('accesos')} onClick={() => setTab('accesos')}>Accesos rápidos</button>
        {clientePreviewId && (
          <button style={{ ...tabStyle('cliente'), borderBottom: tab === 'cliente' ? '3px solid #22c55e' : '3px solid transparent', color: tab === 'cliente' ? '#16a34a' : '#6B5C90' }} onClick={() => setTab('cliente')}>
            👁 Ver cliente
          </button>
        )}
        {compitaPerfilId && (
          <button style={{ ...tabStyle('perfil'), borderBottom: tab === 'perfil' ? '3px solid #8B5CF6' : '3px solid transparent', color: tab === 'perfil' ? '#7C3AED' : '#6B5C90' }} onClick={() => setTab('perfil')}>
            ✏️ Perfil compita
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
          <ClientesTab
            usuarios={usuariosState}
            compitas={compitas}
            onAsignar={asignarCompita}
            onEliminar={eliminarCliente}
          />
        )}

        {/* ── Compitas activas ──────────────────────────────────────────────── */}
        {(tab === 'compitas' || tab === 'desactivadas') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Barra de herramientas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {tab === 'compitas' && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={generarInvite}
                    disabled={generandoInvite}
                    style={{ background: '#2D1464', color: 'white', border: 'none', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: generandoInvite ? 'not-allowed' : 'pointer', opacity: generandoInvite ? 0.6 : 1, whiteSpace: 'nowrap' }}
                  >
                    {generandoInvite ? 'Generando…' : '+ Invitar Compita'}
                  </button>
                  <RegistrarCompitaDirecto onRegistrada={(c) => setCompitas((prev) => [c, ...prev])} />
                </div>
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

            {/* Lista compitas activas */}
            {tab === 'compitas' && (() => {
              const pendientes = filtrar(compitasPendientes)
              const enMapa = filtrar(compitasEnMapa)
              const sinTelegram = filtrar(compitasSinTelegram)
              const totalActivas = enMapa.length + sinTelegram.length + pendientes.length
              return (
                <>
                  {/* Sección pendientes — siempre visible */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ background: pendientes.length > 0 ? '#FFF3E8' : '#F5F0E8', border: `2px solid ${pendientes.length > 0 ? '#FF6B2B' : '#D4C9E8'}`, color: pendientes.length > 0 ? '#C84B0E' : '#9B8AB8', borderRadius: '9999px', padding: '3px 12px', fontSize: '12px', fontWeight: 800, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                        ⏳ Pendientes — {pendientes.length}
                      </span>
                      <span style={{ fontSize: '12px', color: '#9B8AB8' }}>No aparecen en el mapa ni en la lista de clientes</span>
                    </div>
                    {pendientes.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {pendientes.map((c) => (
                          <CompitaCard key={c.id} c={c} onToggleVerificado={toggleVerificado} onToggleEstado={toggleEstado} onVerPerfil={(id) => { setCompitaPerfilId(id); setTab('perfil') }} onToggleBloqueado={toggleBloqueado} onEliminar={eliminarCompita} />
                        ))}
                      </div>
                    ) : (
                      <div style={{ border: '2px dashed #E8E0D4', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                        <p style={{ color: '#9B8AB8', fontSize: '13px', margin: 0 }}>Ningún compita pendiente de verificación</p>
                      </div>
                    )}
                  </div>

                  {/* Sección sin Telegram — siempre visible */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ background: sinTelegram.length > 0 ? '#FFFBEB' : '#F5F0E8', border: `2px solid ${sinTelegram.length > 0 ? '#f59e0b' : '#D4C9E8'}`, color: sinTelegram.length > 0 ? '#B45309' : '#9B8AB8', borderRadius: '9999px', padding: '3px 12px', fontSize: '12px', fontWeight: 800, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                        ⚠️ Verificadas — {sinTelegram.length}
                      </span>
                      <span style={{ fontSize: '12px', color: '#9B8AB8' }}>Verificadas pero aún no visibles para los clientes</span>
                    </div>
                    {sinTelegram.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {sinTelegram.map((c) => (
                          <CompitaCard key={c.id} c={c} onToggleVerificado={toggleVerificado} onToggleEstado={toggleEstado} onVerPerfil={(id) => { setCompitaPerfilId(id); setTab('perfil') }} onToggleBloqueado={toggleBloqueado} onEliminar={eliminarCompita} />
                        ))}
                      </div>
                    ) : (
                      <div style={{ border: '2px dashed #E8E0D4', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                        <p style={{ color: '#9B8AB8', fontSize: '13px', margin: 0 }}>Todos los verificados tienen Telegram activo</p>
                      </div>
                    )}
                  </div>

                  {/* Sección en el mapa — siempre visible */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ background: enMapa.length > 0 ? '#F0FDF4' : '#F5F0E8', border: `2px solid ${enMapa.length > 0 ? '#22c55e' : '#D4C9E8'}`, color: enMapa.length > 0 ? '#15803d' : '#9B8AB8', borderRadius: '9999px', padding: '3px 12px', fontSize: '12px', fontWeight: 800, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                        ✓ En el mapa — {enMapa.length}
                      </span>
                      <span style={{ fontSize: '12px', color: '#9B8AB8' }}>Visibles para los clientes</span>
                    </div>
                    {enMapa.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {enMapa.map((c) => (
                          <CompitaCard key={c.id} c={c} onToggleVerificado={toggleVerificado} onToggleEstado={toggleEstado} onVerPerfil={(id) => { setCompitaPerfilId(id); setTab('perfil') }} onToggleBloqueado={toggleBloqueado} onEliminar={eliminarCompita} />
                        ))}
                      </div>
                    ) : (
                      <div style={{ border: '2px dashed #E8E0D4', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                        <p style={{ color: '#9B8AB8', fontSize: '13px', margin: 0 }}>Ningún compita visible en el mapa aún</p>
                      </div>
                    )}
                  </div>

                  {totalActivas === 0 && !busqueda && null}
                </>
              )
            })()}

            {/* Lista desactivadas */}
            {tab === 'desactivadas' && (() => {
              const pool = filtroDesactivadas === 'bloqueado' ? compitasBloqueadas
                : filtroDesactivadas === 'inactivo' ? compitasInactivas
                : [...compitasBloqueadas, ...compitasInactivas]
              const lista = filtrar(pool)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Barra de búsqueda + filtro */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre, código o zona…"
                      style={{ flex: 1, minWidth: '200px', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '9px 14px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', background: 'white', outline: 'none' }}
                    />
                    {(['todas', 'inactivo', 'bloqueado'] as const).map((f) => (
                      <button key={f} onClick={() => setFiltroDesactivadas(f)}
                        style={{ background: filtroDesactivadas === f ? (f === 'bloqueado' ? '#B91C1C' : '#2D1464') : 'white', color: filtroDesactivadas === f ? 'white' : '#4A3B6B', border: `2px solid ${filtroDesactivadas === f ? (f === 'bloqueado' ? '#B91C1C' : '#2D1464') : 'rgba(45,20,100,0.2)'}`, borderRadius: '9999px', padding: '8px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {f === 'todas' ? `Todas (${compitasInactivas.length + compitasBloqueadas.length})` : f === 'bloqueado' ? `🚫 Bloqueadas (${compitasBloqueadas.length})` : `Desactivadas (${compitasInactivas.length})`}
                      </button>
                    ))}
                  </div>
                  {lista.length === 0
                    ? <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '40px', textAlign: 'center' }}><p style={{ color: '#6B5C90' }}>No hay resultados.</p></div>
                    : lista.map((c) => <CompitaCard key={c.id} c={c} onToggleVerificado={toggleVerificado} onToggleEstado={toggleEstado} onVerPerfil={(id) => { setCompitaPerfilId(id); setTab('perfil') }} onToggleBloqueado={toggleBloqueado} onEliminar={eliminarCompita} />)
                  }
                </div>
              )
            })()}
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
              <AccessLink href="https://t.me/CompazVisitasBot" label="Bot de Telegram" desc="@CompazVisitasBot — lo que ve el compita al vincularse" external />
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

        {/* ── Perfil compita (edición admin) ────────────────────────────────── */}
        {tab === 'perfil' && compitaPerfilId && (
          <CompitaPerfilAdmin
            compita={compitas.find((c) => c.id === compitaPerfilId)!}
            onGuardado={(actualizada) => {
              setCompitas((prev) => prev.map((c) => c.id === actualizada.id ? actualizada : c))
            }}
          />
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

function ClientesTab({ usuarios, compitas, onAsignar, onEliminar }: {
  usuarios: UsuarioConCompita[]
  compitas: Compita[]
  onAsignar: (usuarioId: string, compitaId: string) => void
  onEliminar: (usuarioId: string) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'bloqueados'>('todos')

  const activos = usuarios.filter((u) => u.plan !== 'bloqueado')
  const bloqueados = usuarios.filter((u) => u.plan === 'bloqueado')

  const base = filtro === 'bloqueados' ? bloqueados : filtro === 'activos' ? activos : usuarios
  const lista = busqueda.trim()
    ? base.filter((u) =>
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email.toLowerCase().includes(busqueda.toLowerCase()) ||
        (u.zona ?? '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : base

  const btnFiltro = (f: typeof filtro, label: string, count: number) => (
    <button
      onClick={() => setFiltro(f)}
      style={{ background: filtro === f ? '#2D1464' : 'white', color: filtro === f ? 'white' : '#4A3B6B', border: '2px solid', borderColor: filtro === f ? '#2D1464' : '#D1C8E0', borderRadius: '9999px', padding: '7px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      {label} ({count})
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <InvitarCliente />

      {/* Barra de búsqueda + filtros */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9B8AB8', fontSize: '16px', pointerEvents: 'none' }}>🔍</span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, correo o zona…"
            style={{ width: '100%', boxSizing: 'border-box', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '9px 14px 9px 36px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', background: 'white', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {btnFiltro('todos', 'Todos', usuarios.length)}
          {btnFiltro('activos', 'Activos', activos.length)}
          {btnFiltro('bloqueados', '🚫 Bloqueados', bloqueados.length)}
        </div>
      </div>

      {lista.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9B8AB8', padding: '32px', fontFamily: 'Inter, sans-serif' }}>
          {busqueda ? 'Sin resultados para esa búsqueda.' : 'Ningún cliente en esta categoría.'}
        </div>
      ) : (
        lista.map((u) => (
          <ClienteCard key={u.id} u={u} compitas={compitas} onAsignar={onAsignar} onEliminar={onEliminar} />
        ))
      )}
    </div>
  )
}

function ClienteCard({ u, compitas, onAsignar, onEliminar }: {
  u: UsuarioConCompita
  compitas: Compita[]
  onAsignar: (usuarioId: string, compitaId: string) => void
  onEliminar: (usuarioId: string) => void
}) {
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [bloqueado, setBloqueado] = useState((u as unknown as { plan: string | null }).plan === 'bloqueado')

  async function toggleBloqueado() {
    const res = await fetch('/api/admin/bloquear-cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: u.id, bloquear: !bloqueado }),
    })
    if (res.ok) setBloqueado((b) => !b)
  }

  const borderColor = bloqueado ? '#dc2626' : '#E8E0D4'

  return (
    <div style={{ background: 'white', border: `2px solid ${borderColor}`, borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>{u.nombre}</span>
          {bloqueado && <span style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: '9999px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>🚫 Bloqueado</span>}
        </div>
        <div style={{ color: '#6B5C90', fontSize: '13px' }}>{u.email} · {u.zona ?? 'Sin zona'} · {u.plan ?? 'Sin plan'}</div>
        <div style={{ color: '#4A3B6B', fontSize: '13px', marginTop: '4px' }}>
          Compita: {u.compita ? `${u.compita.nombre} (${u.compita.zona})` : <em>Sin asignar</em>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <a href={`/dashboard?preview=${u.id}`} target="_blank" rel="noreferrer"
          style={{ background: 'white', color: '#16a34a', border: '2px solid #22c55e', borderRadius: '9999px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          👁 Ver
        </a>
        <select defaultValue={u.compita_id ?? ''} onChange={(e) => onAsignar(u.id, e.target.value)}
          style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '8px 12px', fontFamily: 'Inter, sans-serif', color: '#1A0A3C', background: 'white', cursor: 'pointer' }}>
          <option value="">Sin Compita</option>
          {compitas.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.zona}</option>)}
        </select>
        <button onClick={toggleBloqueado}
          style={{ background: bloqueado ? '#16a34a' : '#FEF3C7', color: bloqueado ? 'white' : '#92400E', border: `2px solid ${bloqueado ? '#22c55e' : '#FCD34D'}`, borderRadius: '9999px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {bloqueado ? '✓ Desbloquear' : '🚫 Bloquear'}
        </button>
        {confirmEliminar ? (
          <>
            <button onClick={() => onEliminar(u.id)} style={{ background: '#B91C1C', color: 'white', border: 'none', borderRadius: '9999px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Sí, eliminar</button>
            <button onClick={() => setConfirmEliminar(false)} style={{ background: 'white', color: '#6B5C90', border: '2px solid #D1C8E0', borderRadius: '9999px', padding: '8px 12px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
          </>
        ) : (
          <button onClick={() => setConfirmEliminar(true)} style={{ background: 'white', color: '#B91C1C', border: '2px solid #FCA5A5', borderRadius: '9999px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            🗑 Eliminar
          </button>
        )}
      </div>
    </div>
  )
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
              <p style={{ color: '#6B5C90', fontSize: '14px', margin: 0 }}>Explora los perfiles disponibles y elige el que mejor se adapte a tu familiar.</p>
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
              Cuando {compita?.nombre ?? 'el compita'} inicie una visita, aparecerá aquí en tiempo real.
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

function CompitaCard({ c, onToggleVerificado, onToggleEstado, onVerPerfil, onToggleBloqueado, onEliminar }: {
  c: Compita
  onToggleVerificado: (id: string, actual: boolean) => void
  onToggleEstado: (id: string, estado: string) => void
  onVerPerfil: (id: string) => void
  onToggleBloqueado: (id: string, bloqueado: boolean) => void
  onEliminar: (id: string) => void
}) {
  const [confirmEliminar, setConfirmEliminar] = useState(false)

  const isPendiente = c.estado === 'activo' && !c.verificado
  const isVerificada = c.estado === 'activo' && c.verificado && !!c.telegram_chat_id
  const isVerificadaSinTelegram = c.estado === 'activo' && c.verificado && !c.telegram_chat_id
  const isDesactivada = c.estado === 'inactivo'
  const isBloqueada = c.estado === 'bloqueado'

  const isVerificadaAny = isVerificada || isVerificadaSinTelegram
  const borderColor = isBloqueada ? '#dc2626' : isPendiente ? '#FF6B2B' : isVerificadaAny ? '#22c55e' : '#E8E0D4'
  const badgeBg = isBloqueada ? '#FEF2F2' : isPendiente ? '#FFF3E8' : isVerificadaAny ? '#F0FDF4' : '#F5F0E8'
  const badgeColor = isBloqueada ? '#B91C1C' : isPendiente ? '#C84B0E' : isVerificadaAny ? '#15803d' : '#6B5C90'
  const badgeText = isBloqueada ? '🚫 Bloqueada' : isPendiente ? '⏳ Pendiente' : (isVerificada || isVerificadaSinTelegram) ? '✓ Verificada' : '✗ Desactivada'

  const cardBg = isBloqueada ? '#FEF2F2' : 'white'

  return (
    <div style={{ background: cardBg, border: `2px solid ${borderColor}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span style={{ color: isBloqueada ? '#B91C1C' : '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>{c.nombre}</span>
          {c.codigo && <span style={{ fontSize: '11px', background: '#F5F0E8', color: '#4A3B6B', borderRadius: '6px', padding: '2px 8px', fontFamily: 'monospace' }}>{c.codigo}</span>}
          <span style={{ fontSize: '11px', background: badgeBg, color: badgeColor, borderRadius: '9999px', padding: '2px 10px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap' }}>{badgeText}</span>
        </div>
        <div style={{ color: '#6B5C90', fontSize: '13px', marginBottom: '6px' }}>
          {c.zona} · {c.visitas_realizadas} visitas
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '12px', fontWeight: 700, borderRadius: '9999px', padding: '2px 10px',
            background: c.telegram_chat_id ? '#DCFCE7' : '#FEF3C7',
            color: c.telegram_chat_id ? '#15803d' : '#92400E',
            border: `1px solid ${c.telegram_chat_id ? '#86EFAC' : '#FCD34D'}`,
          }}>
            {c.telegram_chat_id ? '✓ Telegram activo' : '✗ Telegram no vinculado'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
        <button
          onClick={() => onVerPerfil(c.id)}
          style={{ background: 'white', color: '#7C3AED', border: '2px solid #8B5CF6', borderRadius: '9999px', padding: '8px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          ✏️ Ver perfil
        </button>
        {!isBloqueada && !isDesactivada && (
          <button
            onClick={() => onToggleVerificado(c.id, c.verificado)}
            style={{ background: (isVerificada || isVerificadaSinTelegram) ? '#F0FDF4' : '#2D1464', color: (isVerificada || isVerificadaSinTelegram) ? '#15803d' : 'white', border: `2px solid ${(isVerificada || isVerificadaSinTelegram) ? '#22c55e' : '#2D1464'}`, borderRadius: '9999px', padding: '8px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {isVerificada || isVerificadaSinTelegram ? '✓ Verificada — Quitar' : '✓ Verificar'}
          </button>
        )}
        {!isBloqueada && (
          <button
            onClick={() => onToggleEstado(c.id, c.estado)}
            style={{ background: 'white', color: isDesactivada ? '#22c55e' : '#6B5C90', border: `2px solid ${isDesactivada ? '#22c55e' : '#D1C8E0'}`, borderRadius: '9999px', padding: '8px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {isDesactivada ? 'Reactivar' : 'Desactivar'}
          </button>
        )}
        <button
          onClick={() => onToggleBloqueado(c.id, isBloqueada)}
          style={{ background: isBloqueada ? '#FEF2F2' : 'white', color: isBloqueada ? '#15803d' : '#B91C1C', border: `2px solid ${isBloqueada ? '#22c55e' : '#FCA5A5'}`, borderRadius: '9999px', padding: '8px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {isBloqueada ? 'Desbloquear' : '🚫 Bloquear'}
        </button>
        {confirmEliminar ? (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#B91C1C', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap' }}>¿Confirmar?</span>
            <button onClick={() => onEliminar(c.id)} style={{ background: '#B91C1C', color: 'white', border: 'none', borderRadius: '9999px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Sí, eliminar</button>
            <button onClick={() => setConfirmEliminar(false)} style={{ background: 'white', color: '#6B5C90', border: '2px solid #D1C8E0', borderRadius: '9999px', padding: '8px 12px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmEliminar(true)}
            style={{ background: 'white', color: '#6B5C90', border: '2px solid #E8E0D4', borderRadius: '9999px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            🗑 Eliminar
          </button>
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

function CompitaPerfilAdmin({ compita, onGuardado }: { compita: Compita; onGuardado: (c: Compita) => void }) {
  const [nombre, setNombre] = useState(compita.nombre)
  const [zona, setZona] = useState(compita.zona)
  const [descripcion, setDescripcion] = useState(compita.descripcion ?? '')
  const [fotoUrl, setFotoUrl] = useState(compita.foto_url ?? '')
  const [youtubeUrl, setYoutubeUrl] = useState(compita.youtube_url ?? '')
  const [servicioInput, setServicioInput] = useState('')
  const [servicios, setServicios] = useState<string[]>(compita.servicios ?? [])
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  function agregarServicio() {
    const s = servicioInput.trim()
    if (!s || servicios.includes(s)) return
    setServicios((prev) => [...prev, s])
    setServicioInput('')
  }

  function quitarServicio(s: string) {
    setServicios((prev) => prev.filter((x) => x !== s))
  }

  async function guardar() {
    setGuardando(true)
    setMensaje(null)
    const res = await fetch('/api/admin/compita', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: compita.id, nombre, zona, descripcion: descripcion || null, foto_url: fotoUrl || null, youtube_url: youtubeUrl || null, servicios }),
    })
    const d = await res.json()
    if (res.ok && d.ok) {
      onGuardado(d.data)
      setMensaje({ tipo: 'ok', texto: 'Cambios guardados' })
    } else {
      setMensaje({ tipo: 'error', texto: d.error ?? 'Error al guardar' })
    }
    setGuardando(false)
  }

  const input = (label: string, value: string, onChange: (v: string) => void, opts?: { placeholder?: string; multiline?: boolean }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A3B6B', fontFamily: 'Bricolage Grotesque, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {opts?.multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={opts?.placeholder}
          rows={4}
          style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', background: 'white', outline: 'none', resize: 'vertical' }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={opts?.placeholder}
          style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', background: 'white', outline: 'none' }}
        />
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Cabecera */}
      <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {compita.foto_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={compita.foto_url} alt={compita.nombre} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        )}
        <div>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px', color: '#1A0A3C' }}>{compita.nombre}</div>
          <div style={{ fontSize: '13px', color: '#6B5C90', marginTop: '2px' }}>
            {compita.zona} · {compita.visitas_realizadas} visitas · {compita.codigo ? <span style={{ fontFamily: 'monospace', background: '#F5F0E8', padding: '1px 6px', borderRadius: '4px' }}>{compita.codigo}</span> : 'sin código'}
          </div>
          <div style={{ fontSize: '13px', color: '#6B5C90', marginTop: '2px' }}>
            Telegram: {compita.telegram_chat_id ?? <em>sin registrar</em>}
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {input('Nombre', nombre, setNombre)}
        {input('Zona de cobertura', zona, setZona, { placeholder: 'Ej: Caracas – Chacao' })}
        {input('Descripción', descripcion, setDescripcion, { multiline: true, placeholder: 'Presentación breve del compita…' })}
        {input('URL de foto', fotoUrl, setFotoUrl, { placeholder: 'https://…' })}
        {input('URL de YouTube', youtubeUrl, setYoutubeUrl, { placeholder: 'https://youtube.com/…' })}

        {/* Servicios */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#4A3B6B', fontFamily: 'Bricolage Grotesque, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Servicios</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={servicioInput}
              onChange={(e) => setServicioInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarServicio())}
              placeholder="Acompañamiento, Cocina, Enfermería…"
              style={{ flex: 1, border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', background: 'white', outline: 'none' }}
            />
            <button onClick={agregarServicio} style={{ background: '#2D1464', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>+ Agregar</button>
          </div>
          {servicios.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {servicios.map((s) => (
                <span key={s} style={{ background: '#EDE9F6', color: '#5A3FB5', borderRadius: '9999px', padding: '4px 12px', fontSize: '13px', fontWeight: 600, fontFamily: 'Bricolage Grotesque, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {s}
                  <button onClick={() => quitarServicio(s)} style={{ background: 'none', border: 'none', color: '#7C3AED', cursor: 'pointer', padding: 0, fontSize: '14px', lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Botón guardar + mensaje */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={guardar}
            disabled={guardando}
            style={{ background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '12px 28px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '15px', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.6 : 1 }}
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {mensaje && (
            <span style={{ fontSize: '14px', fontWeight: 700, color: mensaje.tipo === 'ok' ? '#15803d' : '#dc2626', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
              {mensaje.tipo === 'ok' ? '✓ ' : '✗ '}{mensaje.texto}
            </span>
          )}
        </div>
      </div>

      {/* Horarios (solo lectura, para no sobrecomplicar) */}
      {compita.horarios_disponibles && compita.horarios_disponibles.length > 0 && (
        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px' }}>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '12px', color: '#2D1464', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Horarios de disponibilidad (los pone el compita en su perfil)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {compita.horarios_disponibles.map((h, i) => (
              <div key={i} style={{ fontSize: '14px', color: '#4A3B6B' }}>
                <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{h.dia}</span>: {h.inicio} – {h.fin}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const SERVICIOS_OPCIONES = ['Acompañamiento', 'Cocina', 'Enfermería básica', 'Aseo del hogar', 'Movilidad', 'Medicamentos', 'Estimulación cognitiva', 'Compañía nocturna']

function RegistrarCompitaDirecto({ onRegistrada }: { onRegistrada: (c: Compita) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [zona, setZona] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [servicios, setServicios] = useState<string[]>([])
  const [fotoUrl, setFotoUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  function toggleServicio(s: string) {
    setServicios((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  async function registrar() {
    setEstado('enviando')
    setError('')
    const res = await fetch('/api/admin/registrar-compita', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, zona, descripcion, servicios, foto_url: fotoUrl || null, youtube_url: youtubeUrl || null }),
    })
    const d = await res.json()
    if (res.ok && d.ok) {
      onRegistrada(d.data)
      setEstado('ok')
      setTimeout(() => { setEstado('idle'); setAbierto(false); setNombre(''); setZona(''); setDescripcion(''); setServicios([]); setFotoUrl(''); setYoutubeUrl('') }, 2000)
    } else {
      setError(d.error ?? 'Error al registrar')
      setEstado('error')
    }
  }

  const inp = (v: string, onChange: (s: string) => void, placeholder: string, multiline?: boolean) =>
    multiline ? (
      <textarea value={v} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '9px 12px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', background: 'white', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box' as const }} />
    ) : (
      <input value={v} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '9px 12px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', background: 'white', outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
    )

  return (
    <div>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{ background: 'white', color: '#2D1464', border: '2px solid #2D1464', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        + Registrar directamente
      </button>
      {abierto && (
        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', marginTop: '12px', display: 'flex', flexDirection: 'column' as const, gap: '14px', maxWidth: '560px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#4A3B6B' }}>El perfil queda como <strong>inactivo, sin verificar</strong>. Luego lo verificás desde esta misma pantalla.</p>
          {inp(nombre, setNombre, 'Nombre completo')}
          {inp(zona, setZona, 'Zona de cobertura — Ej: Caracas, Chacao')}
          {inp(descripcion, setDescripcion, 'Descripción breve…', true)}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#4A3B6B', fontFamily: 'Bricolage Grotesque, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Servicios</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SERVICIOS_OPCIONES.map((s) => (
                <button key={s} type="button" onClick={() => toggleServicio(s)}
                  style={{ background: servicios.includes(s) ? '#2D1464' : 'white', color: servicios.includes(s) ? 'white' : '#4A3B6B', border: '2px solid ' + (servicios.includes(s) ? '#2D1464' : 'rgba(45,20,100,0.25)'), borderRadius: '9999px', padding: '5px 12px', fontSize: '13px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600, cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {inp(fotoUrl, setFotoUrl, 'URL de foto (opcional)')}
          {inp(youtubeUrl, setYoutubeUrl, 'URL de YouTube (opcional)')}
          {estado === 'error' && <p style={{ margin: 0, color: '#B91C1C', fontSize: '13px', fontWeight: 600 }}>⚠️ {error}</p>}
          <button
            onClick={registrar}
            disabled={estado === 'enviando' || !nombre || !zona || !descripcion || servicios.length === 0}
            style={{ background: estado === 'ok' ? '#22c55e' : '#FF6B2B', color: 'white', border: 'none', borderRadius: '9999px', padding: '11px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', opacity: (!nombre || !zona || !descripcion || servicios.length === 0) ? 0.5 : 1 }}
          >
            {estado === 'enviando' ? 'Registrando…' : estado === 'ok' ? '✓ Compita registrada' : 'Registrar Compita'}
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
