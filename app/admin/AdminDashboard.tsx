'use client'

import { fotoSrc } from '@/lib/fotos'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'
import type { Visita, Compita, Usuario, Mensaje } from '@/types'
import type { SolicitudAdmin } from './page'
import LogoutButton from '@/components/ui/LogoutButton'
import RegistrarPago from '@/components/admin/RegistrarPago'

type VisitaConRelaciones = Visita & { compita: Compita; usuario: Usuario }
type UsuarioConCompita = Usuario & { compita: { nombre: string; zona: string; verificado: boolean } | null }

interface Props {
  visitasActivas: VisitaConRelaciones[]
  visitasPreVisita: VisitaConRelaciones[]
  usuarios: UsuarioConCompita[]
  compitas: Compita[]
  visitasPasadas: Visita[]
  todasSolicitudes: SolicitudAdmin[]
  visitasMes: number
  defaultTab: string
  clientesInactivos?: string[]
}

type Tab = 'visitas' | 'clientes' | 'compitas' | 'desactivadas' | 'historial' | 'solicitudes' | 'cliente' | 'accesos' | 'perfil' | 'atencion' | 'resenas'

type Resena = {
  id: string
  visita_id: string
  compita_id: string
  texto: string
  estrellas: number
  publicada: boolean
  created_at: string
  compita: { nombre: string } | null
  cliente: { nombre: string; email: string } | null
}

type AdminFlag = {
  id: string
  entidad_tipo: 'visita' | 'compita' | 'cliente'
  entidad_id: string
  entidad_nombre: string
  nota: string
  reportado_por: string
  resuelto: boolean
  created_at: string
}

type FlagModal = {
  entidad_tipo: 'visita' | 'compita' | 'cliente'
  entidad_id: string
  entidad_nombre: string
} | null

export default function AdminDashboard({ visitasActivas: inicial, visitasPreVisita: inicialPreVisita, usuarios, compitas: todasCompitas, visitasPasadas, todasSolicitudes, visitasMes, defaultTab, clientesInactivos }: Props) {
  const router = useRouter()
  const [tab, setTabState] = useState<Tab>((defaultTab as Tab) ?? 'visitas')

  function setTab(t: Tab) {
    setTabState(t)
    router.replace(`/admin?tab=${t}`, { scroll: false })
  }

  useEffect(() => { history.scrollRestoration = 'auto' }, [])
  const [visitasActivas, setVisitasActivas] = useState(inicial)
  const [visitasPreVisita, setVisitasPreVisita] = useState(inicialPreVisita)
  const [visitaSeleccionada, setVisitaSeleccionada] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Record<string, Mensaje[]>>({})
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [generandoInvite, setGenerandoInvite] = useState(false)
  const [compitas, setCompitas] = useState(todasCompitas)
  const [seleccionadosCompitas, setSeleccionadosCompitas] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [filtroDesactivadas, setFiltroDesactivadas] = useState<'todas' | 'inactivo' | 'bloqueado'>('todas')
  const [clientePreviewId, setClientePreviewId] = useState<string | null>(null)
  const [compitaPerfilId, setCompitaPerfilId] = useState<string | null>(null)
  const [flags, setFlags] = useState<AdminFlag[]>([])
  const [flagModal, setFlagModal] = useState<FlagModal>(null)
  const [flagNota, setFlagNota] = useState('')
  const [flagReportadoPor, setFlagReportadoPor] = useState('')
  const [flagGuardando, setFlagGuardando] = useState(false)
  const [emergencias, setEmergencias] = useState<AdminFlag[]>([])
  const [emergenciaAcknowledged, setEmergenciaAcknowledged] = useState<Set<string>>(new Set())
  const [resenas, setResenas] = useState<Resena[]>([])
  const [resenasCargadas, setResenasCargadas] = useState(false)

  useEffect(() => {
    fetch('/api/admin/flags')
      .then((r) => r.json())
      .then((d) => {
        if (!Array.isArray(d.data)) return
        setFlags(d.data)
        // Emergencias no resueltas al cargar
        const emgs = (d.data as AdminFlag[]).filter((f) => f.entidad_nombre?.startsWith('🚨') && !f.resuelto)
        if (emgs.length) setEmergencias(emgs)
      })
  }, [])

  // Realtime: nuevos flags de emergencia
  useEffect(() => {
    const supabase = createBrowserSupabase()
    let canal: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
      canal = supabase
        .channel('admin-flags-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_flags' }, (payload) => {
          const flag = payload.new as AdminFlag
          if (flag.entidad_nombre?.startsWith('🚨') && !flag.resuelto) {
            setEmergencias((prev) => [...prev, flag])
          }
          setFlags((prev) => [flag, ...prev])
        })
        .subscribe()
    })
    return () => { if (canal) supabase.removeChannel(canal) }
  }, [])

  const [flagError, setFlagError] = useState('')

  async function crearFlag() {
    if (!flagModal || !flagNota.trim() || !flagReportadoPor.trim()) return
    setFlagGuardando(true)
    setFlagError('')
    try {
      const res = await fetch('/api/admin/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...flagModal, nota: flagNota, reportado_por: flagReportadoPor }),
      })
      const d = await res.json()
      if (res.ok) {
        setFlags((prev) => [d.data, ...prev])
        setFlagModal(null)
        setFlagNota('')
        setFlagReportadoPor('')
        setFlagError('')
      } else {
        setFlagError(d.error ?? 'Error al guardar. Intenta de nuevo.')
      }
    } catch {
      setFlagError('Error de red. Intenta de nuevo.')
    } finally {
      setFlagGuardando(false)
    }
  }

  async function resolverFlag(flagId: string) {
    if (!confirm('¿Marcar este flag como resuelto?')) return
    const res = await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag_id: flagId }),
    })
    if (res.ok) setFlags((prev) => prev.filter((f) => f.id !== flagId))
  }

  const flagsAbiertos = flags.filter((f) => !f.resuelto)

  const llamadasEnCurso = todasSolicitudes.filter((s) => {
    if (s.estado !== 'aceptada' || !s.slot_confirmado) return false
    const inicio = new Date(s.slot_confirmado).getTime()
    const ahora = Date.now()
    return ahora >= inicio && ahora <= inicio + 23 * 60 * 1000
  })

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
    if (!confirm(`¿${nuevoEstado === 'activo' ? 'Reactivar' : 'Desactivar'} esta compita?`)) return
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
        const { data: activas } = await supabase
          .from('visitas')
          .select('*, compita:compitas(id, nombre, zona, foto_url, estado, verificado), usuario:usuarios(*)')
          .eq('estado', 'en_curso')
          .order('inicio', { ascending: false })
        if (activas) setVisitasActivas(activas as VisitaConRelaciones[])

        const { data: previas } = await supabase
          .from('visitas')
          .select('*, compita:compitas(id, nombre, zona, foto_url, estado, verificado), usuario:usuarios(*)')
          .eq('estado', 'pre_visita')
          .order('created_at', { ascending: false })
        if (previas) setVisitasPreVisita(previas as VisitaConRelaciones[])

        // Refresca los datos del servidor (visitasPasadas, contadores) sin perder el scroll
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  // Suscripción Realtime a mensajes — auth ANTES de suscribir para respetar RLS de admin
  useEffect(() => {
    const supabase = createBrowserSupabase()
    let canal: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
      canal = supabase
        .channel('admin-mensajes-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
          const m = payload.new as Mensaje
          setMensajes((prev) => ({
            ...prev,
            [m.visit_id]: [...(prev[m.visit_id] ?? []), m],
          }))
        })
        .subscribe()
    })

    return () => { if (canal) supabase.removeChannel(canal) }
  }, [])

  // Cargar mensajes de visita seleccionada
  // Auto-refresh cada 2 min para mantener la vista actualizada
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 120_000)
    return () => clearInterval(t)
  }, [router])

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
    if (!confirm(`¿${bloqueado ? 'Desbloquear' : 'Bloquear'} esta compita?`)) return
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

  async function eliminarClientesEnLote(ids: string[]): Promise<number> {
    let eliminados = 0
    await Promise.all(ids.map(async (id) => {
      const res = await fetch('/api/admin/eliminar-cliente', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: id }),
      })
      if (res.ok) eliminados++
    }))
    setUsuariosState((prev) => prev.filter((u) => !ids.includes(u.id)))
    return eliminados
  }

  async function eliminarCompita(compitaId: string, force: boolean): Promise<{ ok: true } | { ok: false; visitas?: number; error?: string }> {
    const res = await fetch('/api/admin/eliminar-compita', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compita_id: compitaId, force }),
    })
    if (res.ok) {
      setCompitas((prev) => prev.filter((c) => c.id !== compitaId))
      return { ok: true }
    }
    try {
      const data = await res.json()
      if (res.status === 409 && data.visitas != null) return { ok: false, visitas: data.visitas }
      return { ok: false, error: data.error ?? 'Error desconocido' }

    } catch {
      return { ok: false, error: `Error ${res.status}` }
    }
  }

  async function eliminarCompitasEnLote(ids: string[]): Promise<number> {
    let eliminados = 0
    await Promise.all(ids.map(async (id) => {
      const res = await fetch('/api/admin/eliminar-compita', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compita_id: id, force: true }),
      })
      if (res.ok) eliminados++
    }))
    setCompitas((prev) => prev.filter((c) => !ids.includes(c.id)))
    return eliminados
  }

  function toggleUnoCompita(id: string) {
    setSeleccionadosCompitas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodosCompitas(lista: { id: string }[]) {
    const todos = lista.every((c) => seleccionadosCompitas.has(c.id))
    setSeleccionadosCompitas(todos ? new Set() : new Set(lista.map((c) => c.id)))
  }

  async function toggleVerificado(compitaId: string, actual: boolean) {
    if (!confirm(`¿${actual ? 'Quitar la verificación de' : 'Verificar'} esta compita?`)) return
    const res = await fetch('/api/admin/toggle-verificado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compita_id: compitaId, verificado: !actual }),
    })
    if (res.ok) {
      // El servidor también ajusta el estado: verificar activa a la compita; quitar la verificación la desactiva
      setCompitas((prev) => prev.map((c) => c.id === compitaId ? { ...c, verificado: !actual, estado: !actual ? 'activo' : 'inactivo' } : c))
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

  const emergenciasVisibles = emergencias.filter((e) => !emergenciaAcknowledged.has(e.id))

  async function resolverEmergencia(id: string) {
    setEmergenciaAcknowledged((prev) => new Set([...prev, id]))
    await fetch(`/api/admin/flags/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resuelto: true }) }).catch(() => {})
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', fontFamily: 'Inter, sans-serif' }}>

      {/* Alarma de emergencia */}
      {emergenciasVisibles.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(180, 0, 0, 0.96)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
          animation: 'pulsoRojo 1s ease-in-out infinite',
        }}>
          <style>{`
            @keyframes pulsoRojo {
              0%, 100% { background: rgba(180,0,0,0.96); }
              50% { background: rgba(220,0,0,0.99); }
            }
          `}</style>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🚨</div>
          <h1 style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: 'clamp(28px, 6vw, 48px)', textAlign: 'center', marginBottom: '12px' }}>
            EMERGENCIA
          </h1>
          {emergenciasVisibles.map((e) => (
            <div key={e.id} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '16px 24px', marginBottom: '12px', maxWidth: '600px', width: '100%', textAlign: 'center' }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: '18px', marginBottom: '6px' }}>{e.entidad_nombre}</p>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px' }}>{e.nota}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginTop: '4px' }}>{new Date(e.created_at).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          ))}
          <button
            onClick={() => emergenciasVisibles.forEach((e) => resolverEmergencia(e.id))}
            style={{
              marginTop: '24px', background: 'white', color: '#B40000', border: 'none',
              borderRadius: '9999px', padding: '16px 40px', fontSize: '18px',
              fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, cursor: 'pointer',
            }}
          >
            Atendido — cerrar alarma
          </button>
        </div>
      )}

      {/* Llamadas de entrevista en curso */}
      {llamadasEnCurso.length > 0 && (
        <div style={{ background: '#EFF6FF', borderBottom: '2px solid #93C5FD', padding: '10px 24px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', color: '#1d4ed8', whiteSpace: 'nowrap' }}>
            📞 {llamadasEnCurso.length === 1 ? 'Llamada en curso' : `${llamadasEnCurso.length} llamadas en curso`}
          </span>
          {llamadasEnCurso.map((s) => {
            const cliente = (s as unknown as { usuarios?: { nombre: string } }).usuarios
            const compita = (s as unknown as { compitas?: { nombre: string } }).compitas
            return (
              <span key={s.id} style={{ background: 'white', border: '1.5px solid #93C5FD', borderRadius: '9999px', padding: '3px 12px', fontSize: '12px', color: '#1e40af', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {compita?.nombre ?? '—'} ↔ {cliente?.nombre ?? '—'}
                {s.room_url && (
                  <a href={s.room_url} target="_blank" rel="noreferrer" style={{ color: '#FF6B2B', fontWeight: 700, textDecoration: 'none', fontSize: '11px' }}>Unirse →</a>
                )}
                <button
                  onClick={async () => {
                    if (!confirm('¿Marcar esta llamada como completada y cerrar el banner?')) return
                    await fetch('/api/admin/completar-solicitud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id }) })
                    window.location.reload()
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
                  title="Cerrar — la llamada ya terminó"
                >✕</button>
              </span>
            )
          })}
        </div>
      )}

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

      {/* Métricas */}
      <div style={{ background: '#2D1464', padding: '12px 24px', display: 'flex', gap: '0', overflowX: 'auto' }}>
        {[
          { label: 'Clientes', valor: usuarios.filter((u) => u.activado && u.plan !== 'bloqueado').length },
          { label: 'Compitas activos', valor: compitasVerificadas.length },
          { label: 'Visitas este mes', valor: visitasMes },
          { label: 'Sol. pendientes', valor: todasSolicitudes.filter((s) => s.estado === 'pendiente').length },
          { label: 'Entrevistas conf.', valor: todasSolicitudes.filter((s) => s.estado === 'aceptada' && s.slot_confirmado).length },
        ].map((kpi, i, arr) => (
          <div key={kpi.label} style={{ flex: '1 0 auto', minWidth: '100px', textAlign: 'center', padding: '4px 16px', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
            <div style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px' }}>{kpi.valor}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '2px solid #E8E0D4', display: 'flex', padding: '0 24px', overflowX: 'auto' }}>
        <button style={tabStyle('visitas')} onClick={() => setTab('visitas')}>Visitas activas</button>
        <button style={tabStyle('clientes')} onClick={() => setTab('clientes')}>Clientes ({usuarios.length})</button>
        <button style={tabStyle('compitas')} onClick={() => setTab('compitas')}>
          Compitas ({compitasVerificadas.length}) {compitasPendientes.length > 0 && <span style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '11px', fontWeight: 800, marginLeft: '4px' }}>{compitasPendientes.length}</span>}
        </button>
        <button style={tabStyle('desactivadas')} onClick={() => setTab('desactivadas')}>
          Desactivados ({compitasInactivas.length + compitasBloqueadas.length})
          {compitasBloqueadas.length > 0 && <span style={{ background: '#dc2626', color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '11px', fontWeight: 800, marginLeft: '4px' }}>{compitasBloqueadas.length}</span>}
        </button>
        <button style={tabStyle('historial')} onClick={() => setTab('historial')}>Historial</button>
        <button style={tabStyle('solicitudes')} onClick={() => setTab('solicitudes')}>
          Solicitudes {todasSolicitudes.filter((s) => s.estado === 'pendiente').length > 0 && (
            <span style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '11px', fontWeight: 800, marginLeft: '4px' }}>
              {todasSolicitudes.filter((s) => s.estado === 'pendiente').length}
            </span>
          )}
        </button>
        <button style={tabStyle('accesos')} onClick={() => setTab('accesos')}>Accesos rápidos</button>
        <button style={tabStyle('resenas')} onClick={() => { setTab('resenas'); if (!resenasCargadas) { fetch('/api/admin/resenas').then(r => r.json()).then(d => { if (Array.isArray(d.data)) { setResenas(d.data); setResenasCargadas(true) } }) } }}>
          Reseñas {resenas.filter(r => !r.publicada).length > 0 && <span style={{ background: '#7C4DFF', color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '11px', fontWeight: 800, marginLeft: '4px' }}>{resenas.filter(r => !r.publicada).length}</span>}
        </button>
        <button style={tabStyle('atencion')} onClick={() => setTab('atencion')}>
          ⚑ Atención {flagsAbiertos.length > 0 && <span style={{ background: '#dc2626', color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '11px', fontWeight: 800, marginLeft: '4px' }}>{flagsAbiertos.length}</span>}
        </button>
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
          <VisitasAdminTab
            visitasActivas={visitasActivas}
            visitasPreVisita={visitasPreVisita}
            visitasPasadas={visitasPasadas as (Visita & { compita: { nombre: string }; usuario: { nombre: string; email: string } })[]}
            visitaSeleccionada={visitaSeleccionada}
            setVisitaSeleccionada={setVisitaSeleccionada}
            mensajes={mensajes}
            fotoSrc={fotoSrc}
            setFlagModal={setFlagModal}
          />
        )}

        {/* ── Clientes ─────────────────────────────────────────────────────── */}
        {tab === 'clientes' && (
          <ClientesTab
            usuarios={usuariosState}
            compitas={compitas}
            onAsignar={asignarCompita}
            onEliminar={eliminarCliente}
            onEliminarLote={eliminarClientesEnLote}
            onMarcar={(id, nombre) => setFlagModal({ entidad_tipo: 'cliente', entidad_id: id, entidad_nombre: nombre })}
            clientesInactivos={clientesInactivos}
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
                style={{ flex: 1, minWidth: '200px', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '9px 14px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', outline: 'none' }}
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
              const todasEnVista = [...pendientes, ...sinTelegram, ...enMapa]
              const todosSeleccionados = todasEnVista.length > 0 && todasEnVista.every((c) => seleccionadosCompitas.has(c.id))
              return (
                <>
                  {/* Barra de selección masiva */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: seleccionadosCompitas.size > 0 ? '#FEF2F2' : '#F5F0FF', border: `2px solid ${seleccionadosCompitas.size > 0 ? '#fca5a5' : '#D4C9E8'}`, borderRadius: '12px', flexWrap: 'wrap' }}>
                    <input type="checkbox" checked={todosSeleccionados} onChange={() => toggleTodosCompitas(todasEnVista)} style={{ width: '18px', height: '18px', accentColor: '#7C4DFF', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', color: '#4A3B6B', flex: 1 }}>
                      {todosSeleccionados ? 'Todos seleccionados' : 'Seleccionar todos'}
                    </span>
                    {seleccionadosCompitas.size > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#6B5C90' }}>
                          {seleccionadosCompitas.size} seleccionado{seleccionadosCompitas.size !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={async () => {
                            if (!confirm(`¿Eliminar ${seleccionadosCompitas.size} compita${seleccionadosCompitas.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return
                            const ids = [...seleccionadosCompitas]
                            const n = await eliminarCompitasEnLote(ids)
                            setSeleccionadosCompitas(new Set())
                            alert(`${n} compita${n !== 1 ? 's' : ''} eliminado${n !== 1 ? 's' : ''}.`)
                          }}
                          style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '9999px', padding: '6px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          🗑 Eliminar seleccionados
                        </button>
                      </div>
                    )}
                  </div>

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
                          <CompitaCard key={c.id} c={c} onToggleVerificado={toggleVerificado} onToggleEstado={toggleEstado} onVerPerfil={(id) => { setCompitaPerfilId(id); setTab('perfil') }} onToggleBloqueado={toggleBloqueado} onEliminar={eliminarCompita} onMarcar={(id, nombre) => setFlagModal({ entidad_tipo: 'compita', entidad_id: id, entidad_nombre: nombre })} seleccionado={seleccionadosCompitas.has(c.id)} onToggleSeleccion={toggleUnoCompita} />
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
                        ⚠️ Verificados — {sinTelegram.length}
                      </span>
                      <span style={{ fontSize: '12px', color: '#9B8AB8' }}>Verificados pero aún no visibles para los clientes</span>
                    </div>
                    {sinTelegram.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {sinTelegram.map((c) => (
                          <CompitaCard key={c.id} c={c} onToggleVerificado={toggleVerificado} onToggleEstado={toggleEstado} onVerPerfil={(id) => { setCompitaPerfilId(id); setTab('perfil') }} onToggleBloqueado={toggleBloqueado} onEliminar={eliminarCompita} onMarcar={(id, nombre) => setFlagModal({ entidad_tipo: 'compita', entidad_id: id, entidad_nombre: nombre })} seleccionado={seleccionadosCompitas.has(c.id)} onToggleSeleccion={toggleUnoCompita} />
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
                          <CompitaCard key={c.id} c={c} onToggleVerificado={toggleVerificado} onToggleEstado={toggleEstado} onVerPerfil={(id) => { setCompitaPerfilId(id); setTab('perfil') }} onToggleBloqueado={toggleBloqueado} onEliminar={eliminarCompita} onMarcar={(id, nombre) => setFlagModal({ entidad_tipo: 'compita', entidad_id: id, entidad_nombre: nombre })} seleccionado={seleccionadosCompitas.has(c.id)} onToggleSeleccion={toggleUnoCompita} />
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
              const todosSeleccionados = lista.length > 0 && lista.every((c) => seleccionadosCompitas.has(c.id))
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Barra de búsqueda + filtro */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre, código o zona…"
                      style={{ flex: 1, minWidth: '200px', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '9px 14px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', outline: 'none' }}
                    />
                    {(['todas', 'inactivo', 'bloqueado'] as const).map((f) => (
                      <button key={f} onClick={() => setFiltroDesactivadas(f)}
                        style={{ background: filtroDesactivadas === f ? (f === 'bloqueado' ? '#B91C1C' : '#2D1464') : 'white', color: filtroDesactivadas === f ? 'white' : '#4A3B6B', border: `2px solid ${filtroDesactivadas === f ? (f === 'bloqueado' ? '#B91C1C' : '#2D1464') : 'rgba(45,20,100,0.2)'}`, borderRadius: '9999px', padding: '8px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {f === 'todas' ? `Todos (${compitasInactivas.length + compitasBloqueadas.length})` : f === 'bloqueado' ? `🚫 Bloqueados (${compitasBloqueadas.length})` : `Desactivados (${compitasInactivas.length})`}
                      </button>
                    ))}
                  </div>
                  {/* Barra de selección masiva */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: seleccionadosCompitas.size > 0 ? '#FEF2F2' : '#F5F0FF', border: `2px solid ${seleccionadosCompitas.size > 0 ? '#fca5a5' : '#D4C9E8'}`, borderRadius: '12px', flexWrap: 'wrap' }}>
                    <input type="checkbox" checked={todosSeleccionados} onChange={() => toggleTodosCompitas(lista)} style={{ width: '18px', height: '18px', accentColor: '#7C4DFF', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', color: '#4A3B6B', flex: 1 }}>
                      {todosSeleccionados ? 'Todos seleccionados' : 'Seleccionar todos'}
                    </span>
                    {seleccionadosCompitas.size > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#6B5C90' }}>
                          {seleccionadosCompitas.size} seleccionado{seleccionadosCompitas.size !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={async () => {
                            if (!confirm(`¿Eliminar ${seleccionadosCompitas.size} compita${seleccionadosCompitas.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return
                            const ids = [...seleccionadosCompitas]
                            const n = await eliminarCompitasEnLote(ids)
                            setSeleccionadosCompitas(new Set())
                            alert(`${n} compita${n !== 1 ? 's' : ''} eliminado${n !== 1 ? 's' : ''}.`)
                          }}
                          style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '9999px', padding: '6px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          🗑 Eliminar seleccionados
                        </button>
                      </div>
                    )}
                  </div>
                  {lista.length === 0
                    ? <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '40px', textAlign: 'center' }}><p style={{ color: '#6B5C90' }}>No hay resultados.</p></div>
                    : lista.map((c) => <CompitaCard key={c.id} c={c} onToggleVerificado={toggleVerificado} onToggleEstado={toggleEstado} onVerPerfil={(id) => { setCompitaPerfilId(id); setTab('perfil') }} onToggleBloqueado={toggleBloqueado} onEliminar={eliminarCompita} onMarcar={(id, nombre) => setFlagModal({ entidad_tipo: 'compita', entidad_id: id, entidad_nombre: nombre })} seleccionado={seleccionadosCompitas.has(c.id)} onToggleSeleccion={toggleUnoCompita} />)
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

        {/* ── Solicitudes ───────────────────────────────────────────────────── */}
        {tab === 'solicitudes' && (
          <SolicitudesTab solicitudes={todasSolicitudes} />
        )}

        {/* ── Reseñas ───────────────────────────────────────────────────────── */}
        {tab === 'resenas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!resenasCargadas ? (
              <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
                <p style={{ color: '#6B5C90' }}>Cargando reseñas…</p>
              </div>
            ) : resenas.length === 0 ? (
              <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
                <p style={{ color: '#6B5C90', fontSize: '15px' }}>Aún no hay reseñas de clientes.</p>
              </div>
            ) : resenas.map((r) => (
              <div key={r.id} style={{ background: 'white', border: `2px solid ${r.publicada ? '#86efac' : '#E8E0D4'}`, borderRadius: '16px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#1A0A3C', fontSize: '15px' }}>{r.compita?.nombre ?? '—'}</span>
                    <span style={{ color: '#9B8AB8', fontSize: '13px', marginLeft: '8px' }}>por {r.cliente?.nombre ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>{'⭐'.repeat(r.estrellas)}</span>
                    <span style={{ background: r.publicada ? '#dcfce7' : '#F5F0FF', color: r.publicada ? '#16a34a' : '#7C4DFF', borderRadius: '9999px', padding: '2px 10px', fontSize: '12px', fontWeight: 700 }}>
                      {r.publicada ? 'Publicada' : 'Pendiente'}
                    </span>
                  </div>
                </div>
                <p style={{ color: '#4A3B6B', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{r.texto}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {!r.publicada ? (
                    <button
                      onClick={async () => {
                        if (!confirm('¿Publicar esta reseña?')) return
                        const res = await fetch('/api/admin/resenas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, publicada: true }) })
                        if (res.ok) setResenas(prev => prev.map(x => x.id === r.id ? { ...x, publicada: true } : x))
                      }}
                      style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '9999px', padding: '6px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✓ Publicar
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        if (!confirm('¿Ocultar esta reseña?')) return
                        const res = await fetch('/api/admin/resenas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, publicada: false }) })
                        if (res.ok) setResenas(prev => prev.map(x => x.id === r.id ? { ...x, publicada: false } : x))
                      }}
                      style={{ background: 'none', color: '#6B5C90', border: '2px solid #D4C9E8', borderRadius: '9999px', padding: '6px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Ocultar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Atención ──────────────────────────────────────────────────────── */}
        {tab === 'atencion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {flagsAbiertos.length === 0 ? (
              <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
                <p style={{ color: '#6B5C90', fontSize: '15px' }}>No hay marcas pendientes. Todo en orden.</p>
              </div>
            ) : (
              <>
                {(['visita', 'compita', 'cliente'] as const).map((tipo) => {
                  const grupo = flagsAbiertos.filter((f) => f.entidad_tipo === tipo)
                  if (grupo.length === 0) return null
                  const label = tipo === 'visita' ? 'Visitas' : tipo === 'compita' ? 'Compitas' : 'Clientes'
                  return (
                    <div key={tipo}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{label}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {grupo.map((f) => (
                          <div key={f.id} style={{ background: 'white', border: '2px solid #fca5a5', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '180px' }}>
                              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#1A0A3C', fontSize: '14px', marginBottom: '4px' }}>{f.entidad_nombre}</div>
                              <div style={{ fontSize: '14px', color: '#4A3B6B' }}>{f.nota}</div>
                              <div style={{ fontSize: '12px', color: '#9B8AB8', marginTop: '6px' }}>
                                {f.reportado_por} · {new Date(f.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' })}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => {
                                  if (f.entidad_tipo === 'compita') {
                                    setCompitaPerfilId(f.entidad_id)
                                    setTab('perfil')
                                  } else if (f.entidad_tipo === 'cliente') {
                                    setTab('clientes')
                                  } else {
                                    setVisitaSeleccionada(f.entidad_id)
                                    setTab('visitas')
                                  }
                                }}
                                style={{ background: '#F5F0FF', border: '1.5px solid #D4C9E8', color: '#4A3B6B', borderRadius: '9999px', padding: '5px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap' }}
                              >
                                Ver →
                              </button>
                              <button
                                onClick={() => resolverFlag(f.id)}
                                style={{ background: '#F0FDF4', border: '1.5px solid #22c55e', color: '#15803d', borderRadius: '9999px', padding: '5px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap' }}
                              >
                                ✓ Resolver
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
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
                    {v.fin ? new Date(v.fin).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Caracas' }) : '—'} · {duracion}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal: crear flag ──────────────────────────────────────────────── */}
      {flagModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '18px', color: '#1A0A3C', margin: '0 0 4px' }}>⚑ Marcar para atención</h3>
            <p style={{ color: '#6B5C90', fontSize: '13px', margin: '0 0 20px' }}>{flagModal.entidad_nombre}</p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#4A3B6B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>¿Quién reporta?</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['Juan', 'Lucho'].map((nombre) => (
                  <button
                    key={nombre}
                    onClick={() => setFlagReportadoPor(nombre)}
                    style={{ flex: 1, padding: '8px', border: `2px solid ${flagReportadoPor === nombre ? '#2D1464' : '#D4C9E8'}`, borderRadius: '10px', background: flagReportadoPor === nombre ? '#2D1464' : 'white', color: flagReportadoPor === nombre ? 'white' : '#4A3B6B', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                  >
                    {nombre}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#4A3B6B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nota</label>
              <textarea
                value={flagNota}
                onChange={(e) => setFlagNota(e.target.value)}
                placeholder="Describe qué hay que revisar…"
                rows={4}
                style={{ width: '100%', border: '2px solid #D4C9E8', borderRadius: '12px', padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1A0A3C', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {flagError && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 10px', textAlign: 'right' }}>{flagError}</p>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setFlagModal(null); setFlagNota(''); setFlagReportadoPor(''); setFlagError('') }}
                style={{ background: 'white', border: '2px solid #D4C9E8', color: '#6B5C90', borderRadius: '9999px', padding: '8px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={crearFlag}
                disabled={flagGuardando || !flagNota.trim() || !flagReportadoPor.trim()}
                style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '9999px', padding: '8px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', cursor: flagGuardando || !flagNota.trim() || !flagReportadoPor.trim() ? 'not-allowed' : 'pointer', opacity: flagGuardando || !flagNota.trim() || !flagReportadoPor.trim() ? 0.5 : 1 }}
              >
                {flagGuardando ? 'Guardando…' : 'Guardar marca'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type ClientePreviewData = {
  usuario: { nombre: string; email: string; plan: string | null; compita: { nombre: string; zona: string; verificado: boolean; foto_url: string | null } | null }
  visitaActiva: { id: string; inicio: string | null; compita: { nombre: string } } | null
  mensajes: { id: string; created_at: string; origen: string; tipo: string; contenido: string | null }[]
  visitasPasadas: { id: string; created_at: string; fin: string | null; inicio: string | null; compita: { nombre: string } }[]
}

function ClientesTab({ usuarios, compitas, onAsignar, onEliminar, onEliminarLote, onMarcar, clientesInactivos }: {
  usuarios: UsuarioConCompita[]
  compitas: Compita[]
  onAsignar: (usuarioId: string, compitaId: string) => void
  onEliminar: (usuarioId: string) => void
  onEliminarLote: (ids: string[]) => Promise<number>
  onMarcar: (id: string, nombre: string) => void
  clientesInactivos?: string[]
}) {
  const clientesInactivosSet = new Set(clientesInactivos ?? [])
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'invitados' | 'bloqueados'>('todos')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [confirmarLote, setConfirmarLote] = useState(false)
  const [eliminandoLote, setEliminandoLote] = useState(false)

  const activos = usuarios.filter((u) => u.activado && u.plan !== 'bloqueado')
  const invitados = usuarios.filter((u) => !u.activado && u.plan !== 'bloqueado')
  const bloqueados = usuarios.filter((u) => u.plan === 'bloqueado')

  const base = filtro === 'bloqueados' ? bloqueados : filtro === 'activos' ? activos : filtro === 'invitados' ? invitados : usuarios
  const lista = busqueda.trim()
    ? base.filter((u) =>
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email.toLowerCase().includes(busqueda.toLowerCase()) ||
        (u.zona ?? '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : base

  const todosSeleccionados = lista.length > 0 && lista.every((u) => seleccionados.has(u.id))

  function toggleTodos() {
    if (todosSeleccionados) {
      setSeleccionados((prev) => { const next = new Set(prev); lista.forEach((u) => next.delete(u.id)); return next })
    } else {
      setSeleccionados((prev) => { const next = new Set(prev); lista.forEach((u) => next.add(u.id)); return next })
    }
  }

  function toggleUno(id: string) {
    setSeleccionados((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  async function ejecutarEliminarLote() {
    const ids = [...seleccionados]
    setEliminandoLote(true)
    try {
      await onEliminarLote(ids)
      setSeleccionados(new Set())
      setConfirmarLote(false)
    } finally {
      setEliminandoLote(false)
    }
  }

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
            style={{ width: '100%', boxSizing: 'border-box', border: '2px solid rgba(45,20,100,0.2)', borderRadius: '12px', padding: '9px 14px 9px 36px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {btnFiltro('todos', 'Todos', usuarios.length)}
          {btnFiltro('activos', 'Activos', activos.length)}
          {btnFiltro('invitados', '⏳ Invitados', invitados.length)}
          {btnFiltro('bloqueados', '🚫 Bloqueados', bloqueados.length)}
        </div>
      </div>

      {/* Barra de selección masiva */}
      {lista.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: seleccionados.size > 0 ? '#FEF2F2' : '#F5F0FF', border: `2px solid ${seleccionados.size > 0 ? '#fca5a5' : '#D4C9E8'}`, borderRadius: '12px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={todosSeleccionados}
              onChange={toggleTodos}
              style={{ width: '16px', height: '16px', accentColor: '#2D1464', cursor: 'pointer' }}
            />
            <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', color: '#2D1464' }}>
              {todosSeleccionados ? 'Deseleccionar todos' : `Seleccionar todos (${lista.length})`}
            </span>
          </label>
          {seleccionados.size > 0 && (
            <>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#991b1b' }}>
                {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
              </span>
              {!confirmarLote ? (
                <button
                  onClick={() => setConfirmarLote(true)}
                  style={{ background: '#B91C1C', color: 'white', border: 'none', borderRadius: '9999px', padding: '6px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  🗑 Eliminar seleccionados
                </button>
              ) : (
                <>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#991b1b', fontWeight: 700 }}>
                    ¿Eliminar {seleccionados.size} cliente{seleccionados.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.
                  </span>
                  <button
                    onClick={ejecutarEliminarLote}
                    disabled={eliminandoLote}
                    style={{ background: '#B91C1C', color: 'white', border: 'none', borderRadius: '9999px', padding: '6px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: eliminandoLote ? 'not-allowed' : 'pointer', opacity: eliminandoLote ? 0.6 : 1, whiteSpace: 'nowrap' }}
                  >
                    {eliminandoLote ? 'Eliminando…' : 'Sí, eliminar'}
                  </button>
                  <button
                    onClick={() => setConfirmarLote(false)}
                    style={{ background: 'white', color: '#6B5C90', border: '2px solid #D1C8E0', borderRadius: '9999px', padding: '6px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </>
              )}
              <button
                onClick={() => { setSeleccionados(new Set()); setConfirmarLote(false) }}
                style={{ background: 'none', color: '#9B8AB8', border: 'none', fontSize: '13px', cursor: 'pointer', padding: '0', fontFamily: 'Inter, sans-serif' }}
              >
                ✕ Limpiar selección
              </button>
            </>
          )}
        </div>
      )}

      {lista.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9B8AB8', padding: '32px', fontFamily: 'Inter, sans-serif' }}>
          {busqueda ? 'Sin resultados para esa búsqueda.' : 'Ningún cliente en esta categoría.'}
        </div>
      ) : (
        lista.map((u) => (
          <ClienteCard
            key={u.id}
            u={u}
            compitas={compitas}
            onAsignar={onAsignar}
            onEliminar={onEliminar}
            onMarcar={onMarcar}
            inactivo={clientesInactivosSet.has(u.id)}
            seleccionado={seleccionados.has(u.id)}
            onToggleSeleccion={toggleUno}
          />
        ))
      )}
    </div>
  )
}

function ClienteCard({ u, compitas, onAsignar, onEliminar, onMarcar, inactivo = false, seleccionado = false, onToggleSeleccion }: {
  u: UsuarioConCompita
  compitas: Compita[]
  inactivo?: boolean
  seleccionado?: boolean
  onToggleSeleccion?: (id: string) => void
  onAsignar: (usuarioId: string, compitaId: string) => void
  onEliminar: (usuarioId: string) => void
  onMarcar: (id: string, nombre: string) => void
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

  const borderColor = seleccionado ? '#7C4DFF' : bloqueado ? '#dc2626' : '#E8E0D4'

  return (
    <div style={{ background: seleccionado ? '#F5F0FF' : 'white', border: `2px solid ${borderColor}`, borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
      {onToggleSeleccion && (
        <input
          type="checkbox"
          checked={seleccionado}
          onChange={() => onToggleSeleccion(u.id)}
          style={{ width: '18px', height: '18px', accentColor: '#7C4DFF', cursor: 'pointer', flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>{u.nombre}</span>
          {bloqueado && <span style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: '9999px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>🚫 Bloqueado</span>}
          {inactivo && <span style={{ background: '#FFF7ED', color: '#C2410C', border: '1.5px solid #FED7AA', borderRadius: '9999px', padding: '2px 9px', fontSize: '11px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap' }}>⚠️ Sin visita +30 días</span>}
        </div>
        <div style={{ color: '#4A3B6B', fontSize: '13px', marginTop: '3px' }}>✉️ {u.email}</div>
        <div style={{ color: '#6B5C90', fontSize: '13px', marginTop: '2px' }}>{u.zona ?? 'Sin zona'} · {u.plan ?? 'Sin plan'}</div>
        <div style={{ color: '#4A3B6B', fontSize: '13px', marginTop: '2px' }}>
          Compita: {u.compita ? `${u.compita.nombre} (${u.compita.zona})` : <em>Sin asignar</em>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => onMarcar(u.id, u.nombre)}
          style={{ background: 'none', border: '1.5px solid #dc2626', color: '#dc2626', borderRadius: '9999px', padding: '6px 12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap' }}
        >
          ⚑ Marcar
        </button>
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
      <RegistrarPago usuarioId={u.id} nombre={u.nombre} />
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
                    <span style={{ color: '#FF6B2B' }}>✓</span> Verificado
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
                <span style={{ color: '#6B5C90', fontSize: '13px' }}>desde {new Date(visitaActiva.inicio).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' })}</span>
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
                      ? <img src={fotoSrc(m)} alt="foto" style={{ maxWidth: '200px', borderRadius: '8px', display: 'block' }} />
                      : m.contenido}
                  </div>
                  <span style={{ fontSize: '11px', color: '#A09AB8', whiteSpace: 'nowrap' }}>
                    {new Date(m.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' })}
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
                const fecha = new Date(v.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Caracas' })
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

type DeletePhase = 'idle' | 'confirm' | 'warn' | 'loading' | 'error'

function CompitaCard({ c, onToggleVerificado, onToggleEstado, onVerPerfil, onToggleBloqueado, onEliminar, onMarcar, seleccionado = false, onToggleSeleccion }: {
  c: Compita
  onToggleVerificado: (id: string, actual: boolean) => void
  onToggleEstado: (id: string, estado: string) => void
  onVerPerfil: (id: string) => void
  onToggleBloqueado: (id: string, bloqueado: boolean) => void
  onEliminar: (id: string, force: boolean) => Promise<{ ok: true } | { ok: false; visitas?: number; error?: string }>
  onMarcar: (id: string, nombre: string) => void
  seleccionado?: boolean
  onToggleSeleccion?: (id: string) => void
}) {
  const [deletePhase, setDeletePhase] = useState<DeletePhase>('idle')
  const [warnVisitas, setWarnVisitas] = useState(0)
  const [deleteError, setDeleteError] = useState('')

  const isPendiente = c.estado === 'activo' && !c.verificado
  const isVerificada = c.estado === 'activo' && c.verificado && !!c.telegram_chat_id
  const isVerificadaSinTelegram = c.estado === 'activo' && c.verificado && !c.telegram_chat_id
  const isDesactivada = c.estado === 'inactivo'
  const isBloqueada = c.estado === 'bloqueado'

  const isVerificadaAny = isVerificada || isVerificadaSinTelegram
  const borderColor = seleccionado ? '#7C4DFF' : isBloqueada ? '#dc2626' : isPendiente ? '#FF6B2B' : isVerificadaAny ? '#22c55e' : '#E8E0D4'
  const badgeBg = isBloqueada ? '#FEF2F2' : isPendiente ? '#FFF3E8' : isVerificadaAny ? '#F0FDF4' : '#F5F0E8'
  const badgeColor = isBloqueada ? '#B91C1C' : isPendiente ? '#C84B0E' : isVerificadaAny ? '#15803d' : '#6B5C90'
  const badgeText = isBloqueada ? '🚫 Bloqueado' : isPendiente ? '⏳ Pendiente' : (isVerificada || isVerificadaSinTelegram) ? '✓ Verificado' : '✗ Desactivado'

  const cardBg = seleccionado ? '#F5F0FF' : isBloqueada ? '#FEF2F2' : 'white'

  return (
    <div style={{ background: cardBg, border: `2px solid ${borderColor}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
      {onToggleSeleccion && (
        <input
          type="checkbox"
          checked={seleccionado}
          onChange={() => onToggleSeleccion(c.id)}
          style={{ width: '18px', height: '18px', accentColor: '#7C4DFF', cursor: 'pointer', flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span style={{ color: isBloqueada ? '#B91C1C' : '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>{c.nombre}</span>
          {c.codigo && <span style={{ fontSize: '11px', background: '#F5F0E8', color: '#4A3B6B', borderRadius: '6px', padding: '2px 8px', fontFamily: 'monospace' }}>{c.codigo}</span>}
          <span style={{ fontSize: '11px', background: badgeBg, color: badgeColor, borderRadius: '9999px', padding: '2px 10px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap' }}>{badgeText}</span>
        </div>
        <div style={{ color: '#6B5C90', fontSize: '13px', marginBottom: '4px' }}>
          {c.zona} · {c.visitas_realizadas} visitas
          {c.rating_promedio != null && c.total_ratings > 0 ? (
            <span style={{ marginLeft: '8px', color: '#F59E0B', fontWeight: 700 }}>
              ★ {Number(c.rating_promedio).toFixed(1)}{' '}
              <span style={{ color: '#9B8AB8', fontWeight: 400 }}>({c.total_ratings})</span>
            </span>
          ) : (
            <span style={{ marginLeft: '8px', color: '#9B8AB8' }}>☆ Sin calificaciones</span>
          )}
        </div>
        {c.email && (
          <div style={{ color: '#4A3B6B', fontSize: '13px', marginBottom: '4px' }}>✉️ {c.email}</div>
        )}
        {c.telegram_chat_id && (
          <div style={{ color: '#4A3B6B', fontSize: '13px', fontFamily: 'monospace', marginBottom: '4px' }}>
            💬 {c.telegram_chat_id}
          </div>
        )}
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
          onClick={() => onMarcar(c.id, c.nombre)}
          style={{ background: 'none', border: '1.5px solid #dc2626', color: '#dc2626', borderRadius: '9999px', padding: '6px 12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap' }}
        >
          ⚑ Marcar
        </button>
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
            {isVerificada || isVerificadaSinTelegram ? '✓ Verificado — Quitar' : '✓ Verificar'}
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
        {deletePhase === 'idle' && (
          <button
            onClick={() => setDeletePhase('confirm')}
            style={{ background: 'white', color: '#6B5C90', border: '2px solid #E8E0D4', borderRadius: '9999px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            🗑 Eliminar
          </button>
        )}
        {deletePhase === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#FEF2F2', border: '2px solid #FCA5A5', borderRadius: '12px', padding: '12px 16px', maxWidth: '320px' }}>
            <span style={{ fontSize: '13px', color: '#B91C1C', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>¿Eliminar a {c.nombre}?</span>
            <span style={{ fontSize: '12px', color: '#7F1D1D', lineHeight: '1.5' }}>Se borrarán su perfil, sus solicitudes pendientes y su registro de Telegram en el sistema. Esta acción no se puede deshacer.</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={async () => {
                  setDeletePhase('loading')
                  const result = await onEliminar(c.id, false)
                  if (result.ok) return
                  if (result.visitas != null) { setWarnVisitas(result.visitas); setDeletePhase('warn') }
                  else { setDeleteError(result.error ?? 'Error desconocido'); setDeletePhase('error') }
                }}
                style={{ background: '#B91C1C', color: 'white', border: 'none', borderRadius: '9999px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >Sí, eliminar</button>
              <button onClick={() => setDeletePhase('idle')} style={{ background: 'white', color: '#6B5C90', border: '2px solid #D1C8E0', borderRadius: '9999px', padding: '8px 12px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}
        {deletePhase === 'warn' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#FFFBEB', border: '2px solid #FCD34D', borderRadius: '12px', padding: '12px 16px', maxWidth: '340px' }}>
            <span style={{ fontSize: '13px', color: '#92400E', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>No se puede eliminar a {c.nombre}</span>
            <span style={{ fontSize: '12px', color: '#78350F', lineHeight: '1.5' }}>
              Este compita tiene {warnVisitas} {warnVisitas === 1 ? 'visita registrada' : 'visitas registradas'} con clientes. Las visitas son el historial de trabajo y están vinculadas a los clientes que atendió.
            </span>
            <span style={{ fontSize: '12px', color: '#78350F', lineHeight: '1.5' }}>
              Si igual quieres eliminarlo, se borrarán permanentemente {warnVisitas === 1 ? 'esa visita y todos sus mensajes' : `esas ${warnVisitas} visitas y todos sus mensajes`}, sus solicitudes pendientes y su acceso al sistema por Telegram.
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  setDeletePhase('loading')
                  const result = await onEliminar(c.id, true)
                  if (result.ok) return
                  setDeleteError(result.error ?? 'Error desconocido')
                  setDeletePhase('error')
                }}
                style={{ background: '#B91C1C', color: 'white', border: 'none', borderRadius: '9999px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >Eliminar de todas formas</button>
              <button onClick={() => setDeletePhase('idle')} style={{ background: 'white', color: '#6B5C90', border: '2px solid #D1C8E0', borderRadius: '9999px', padding: '8px 12px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}
        {deletePhase === 'loading' && (
          <span style={{ fontSize: '13px', color: '#6B5C90', fontFamily: 'Bricolage Grotesque, sans-serif' }}>Eliminando...</span>
        )}
        {deletePhase === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#FEF2F2', border: '2px solid #FCA5A5', borderRadius: '12px', padding: '10px 14px', maxWidth: '300px' }}>
            <span style={{ fontSize: '12px', color: '#B91C1C', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Error al eliminar</span>
            <span style={{ fontSize: '11px', color: '#7F1D1D', fontFamily: 'monospace' }}>{deleteError}</span>
            <button onClick={() => setDeletePhase('idle')} style={{ background: 'white', color: '#6B5C90', border: '2px solid #D1C8E0', borderRadius: '9999px', padding: '6px 12px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '12px', cursor: 'pointer', alignSelf: 'flex-start' }}>Cerrar</button>
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
            style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '9px 12px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', outline: 'none' }}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '9px 12px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', outline: 'none' }}
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
          style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', outline: 'none', resize: 'vertical' }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={opts?.placeholder}
          style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', outline: 'none' }}
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
              style={{ flex: 1, border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', outline: 'none' }}
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
  const [emailCompita, setEmailCompita] = useState('')
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
      body: JSON.stringify({ nombre, zona, descripcion, servicios, foto_url: fotoUrl || null, youtube_url: youtubeUrl || null, email: emailCompita || null }),
    })
    const d = await res.json()
    if (res.ok && d.ok) {
      onRegistrada(d.data)
      setEstado('ok')
      setTimeout(() => { setEstado('idle'); setAbierto(false); setNombre(''); setZona(''); setDescripcion(''); setServicios([]); setFotoUrl(''); setYoutubeUrl(''); setEmailCompita('') }, 2000)
    } else {
      setError(d.error ?? 'Error al registrar')
      setEstado('error')
    }
  }

  const inp = (v: string, onChange: (s: string) => void, placeholder: string, multiline?: boolean) =>
    multiline ? (
      <textarea value={v} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '9px 12px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box' as const }} />
    ) : (
      <input value={v} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ border: '2px solid rgba(45,20,100,0.2)', borderRadius: '10px', padding: '9px 12px', fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#1A0A3C', background: 'white', outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
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
          {inp(emailCompita, setEmailCompita, 'Email del compita (opcional — recibe bienvenida)')}
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

function SolicitudesTab({ solicitudes }: { solicitudes: SolicitudAdmin[] }) {
  const [filtro, setFiltro] = useState<'todas' | 'pendiente' | 'aceptada' | 'rechazada'>('todas')
  const [enviandoLink, setEnviandoLink] = useState<string | null>(null)
  const [linkEnviado, setLinkEnviado] = useState<string | null>(null)

  async function enviarLink(solicitudId: string) {
    if (!confirm('¿Enviar el link de llamada al cliente?')) return
    setEnviandoLink(solicitudId)
    try {
      const res = await fetch('/api/admin/enviar-link-llamada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitud_id: solicitudId }),
      })
      const d = await res.json()
      if (res.ok) {
        setLinkEnviado(solicitudId)
        setTimeout(() => setLinkEnviado(null), 4000)
      } else {
        alert(d.error ?? 'Error enviando el link')
      }
    } catch {
      alert('Error de red')
    } finally {
      setEnviandoLink(null)
    }
  }

  const lista = filtro === 'todas' ? solicitudes : solicitudes.filter((s) => s.estado === filtro)

  const FILTROS = [
    { key: 'todas', label: 'Todas' },
    { key: 'pendiente', label: '⏳ Pendientes' },
    { key: 'aceptada', label: '✅ Aceptadas' },
    { key: 'rechazada', label: '❌ Rechazadas' },
  ] as const

  function formatSlot(iso: string) {
    return new Date(iso).toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {FILTROS.map(({ key, label }) => (
          <button key={key} onClick={() => setFiltro(key)}
            style={{ background: filtro === key ? '#2D1464' : 'white', color: filtro === key ? 'white' : '#4A3B6B', border: `2px solid ${filtro === key ? '#2D1464' : '#D1C8E0'}`, borderRadius: '9999px', padding: '7px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            {label} ({key === 'todas' ? solicitudes.length : solicitudes.filter((s) => s.estado === key).length})
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
          <p style={{ color: '#6B5C90' }}>No hay solicitudes en esta categoría.</p>
        </div>
      ) : lista.map((s) => {
        const isPendiente = s.estado === 'pendiente'
        const isAceptada = s.estado === 'aceptada'
        const borderColor = isPendiente ? '#FF6B2B' : isAceptada ? '#22c55e' : '#E8E0D4'
        return (
          <div key={s.id} style={{ background: 'white', border: `2px solid ${borderColor}`, borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Cabecera */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#1A0A3C', fontSize: '15px' }}>
                    {s.usuarios?.nombre ?? '—'}
                  </span>
                  <span style={{ color: '#9B8AB8', fontSize: '13px' }}>→</span>
                  <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#2D1464', fontSize: '15px' }}>
                    {s.compitas?.nombre ?? '—'}
                  </span>
                  <span style={{
                    borderRadius: '9999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700,
                    fontFamily: 'Bricolage Grotesque, sans-serif',
                    background: isPendiente ? '#FFF3E8' : isAceptada ? '#F0FDF4' : '#F1F0F5',
                    color: isPendiente ? '#C84B0E' : isAceptada ? '#15803d' : '#6B5C90',
                    border: `1.5px solid ${isPendiente ? '#FF6B2B' : isAceptada ? '#22c55e' : '#D4CAE8'}`,
                  }}>
                    {isPendiente ? '⏳ Pendiente' : isAceptada ? '✅ Aceptada' : '❌ Rechazada'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#9B8AB8' }}>
                  {s.usuarios?.email} · {s.compitas?.zona ?? ''} · {new Date(s.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Caracas' })}
                </div>
              </div>
              {isAceptada && s.slot_confirmado && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
                  {s.room_url && (
                    <a href={s.room_url} target="_blank" rel="noreferrer"
                      style={{ background: '#22c55e', color: 'white', borderRadius: '9999px', padding: '8px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      📹 Sala de llamada
                    </a>
                  )}
                  <button
                    onClick={() => enviarLink(s.id)}
                    disabled={enviandoLink === s.id}
                    style={{ background: linkEnviado === s.id ? '#15803d' : '#2D1464', color: 'white', border: 'none', borderRadius: '9999px', padding: '8px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: enviandoLink === s.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: enviandoLink === s.id ? 0.7 : 1 }}
                  >
                    {linkEnviado === s.id ? '✅ Enviado' : enviandoLink === s.id ? 'Enviando…' : '📨 Enviar link'}
                  </button>
                </div>
              )}
            </div>

            {/* Mensaje del cliente */}
            {s.mensaje && (
              <div style={{ background: '#FDFAF6', border: '1.5px solid #E8E0D4', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Mensaje</div>
                <p style={{ margin: 0, fontSize: '14px', color: '#4A3B6B' }}>{s.mensaje}</p>
              </div>
            )}

            {/* Horarios propuestos */}
            {s.slots_propuestos?.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Horarios propuestos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {s.slots_propuestos.map((slot, i) => {
                    const esConfirmado = s.slot_confirmado === slot
                    return (
                      <div key={i} style={{
                        fontSize: '13px', padding: '6px 12px', borderRadius: '8px',
                        background: esConfirmado ? '#F0FDF4' : '#F5F0E8',
                        color: esConfirmado ? '#15803d' : '#4A3B6B',
                        border: esConfirmado ? '1.5px solid #22c55e' : '1.5px solid transparent',
                        fontWeight: esConfirmado ? 700 : 400,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        {esConfirmado && <span>✅</span>}
                        {['1️⃣', '2️⃣', '3️⃣'][i]} {formatSlot(slot)}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

type SubtabVisitas = 'en_curso' | 'agendadas' | 'cerradas'

function VisitasAdminTab({
  visitasActivas, visitasPreVisita, visitasPasadas,
  visitaSeleccionada, setVisitaSeleccionada,
  mensajes, fotoSrc: fotoSrcFn, setFlagModal,
}: {
  visitasActivas: VisitaConRelaciones[]
  visitasPreVisita: VisitaConRelaciones[]
  visitasPasadas: (Visita & { compita: { nombre: string }; usuario: { nombre: string; email: string } })[]
  visitaSeleccionada: string | null
  setVisitaSeleccionada: (id: string | null) => void
  mensajes: Record<string, Mensaje[]>
  fotoSrc: (m: Mensaje) => string
  setFlagModal: (v: { entidad_tipo: 'cliente' | 'visita' | 'compita'; entidad_id: string; entidad_nombre: string } | null) => void
}) {
  const defaultTab: SubtabVisitas = visitasActivas.length > 0 ? 'en_curso' : visitasPreVisita.length > 0 ? 'agendadas' : 'cerradas'
  const [subtab, setSubtab] = useState<SubtabVisitas>(defaultTab)
  const [cerrando, setCerrando] = useState<string | null>(null)

  async function forzarCierre(visitaId: string, compitaNombre: string, usuarioNombre: string) {
    if (!confirm(`¿Cerrar la visita de ${compitaNombre} con ${usuarioNombre}? Se notificará al compita por Telegram.`)) return
    setCerrando(visitaId)
    try {
      const res = await fetch('/api/admin/forzar-cierre-visita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visita_id: visitaId }),
      })
      if (!res.ok) alert('Error al cerrar la visita. Inténtalo de nuevo.')
    } finally {
      setCerrando(null)
    }
  }

  const subtabs: { id: SubtabVisitas; label: string; count: number; color: string }[] = [
    { id: 'en_curso',  label: 'En curso',  count: visitasActivas.length,   color: '#22c55e' },
    { id: 'agendadas', label: 'Agendadas', count: visitasPreVisita.length,  color: '#7C4DFF' },
    { id: 'cerradas',  label: 'Cerradas',  count: visitasPasadas.length,    color: '#9B8AB8' },
  ]

  return (
    <div>
      {/* Subtabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {subtabs.map(t => (
          <button key={t.id} onClick={() => setSubtab(t.id)} style={{
            background: subtab === t.id ? '#2D1464' : 'white',
            color: subtab === t.id ? 'white' : '#4A3B6B',
            border: `2px solid ${subtab === t.id ? '#2D1464' : '#E8E0D4'}`,
            borderRadius: '9999px', padding: '6px 16px', fontSize: '13px', fontWeight: 700,
            fontFamily: 'Bricolage Grotesque, sans-serif', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ background: subtab === t.id ? 'rgba(255,255,255,0.25)' : t.color, color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '11px', fontWeight: 800 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── En curso ── */}
      {subtab === 'en_curso' && (
        visitasActivas.length === 0 ? (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#6B5C90' }}>No hay visitas en curso ahora mismo.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: visitaSeleccionada ? '1fr 1fr' : '1fr', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visitasActivas.map((v) => (
                <div key={v.id} onClick={() => setVisitaSeleccionada(v.id === visitaSeleccionada ? null : v.id)}
                  style={{ background: 'white', border: `2px solid ${v.id === visitaSeleccionada ? '#FF6B2B' : '#22c55e'}`, borderRadius: '16px', padding: '20px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                    <strong style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{v.compita?.nombre}</strong>
                    <span style={{ color: '#6B5C90', fontSize: '14px' }}>con {v.usuario?.nombre}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ color: '#6B5C90', fontSize: '13px' }}>
                      Iniciada: {v.inicio ? new Date(v.inicio).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' }) : '—'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={(e) => { e.stopPropagation(); setFlagModal({ entidad_tipo: 'visita', entidad_id: v.id, entidad_nombre: `${v.compita?.nombre} con ${v.usuario?.nombre}` }) }}
                        style={{ background: 'none', border: '1.5px solid #dc2626', color: '#dc2626', borderRadius: '9999px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                        ⚑ Marcar
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); forzarCierre(v.id, v.compita?.nombre ?? '—', v.usuario?.nombre ?? '—') }}
                        disabled={cerrando === v.id}
                        style={{ background: cerrando === v.id ? '#9B8AB8' : '#dc2626', color: 'white', border: 'none', borderRadius: '9999px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, cursor: cerrando === v.id ? 'not-allowed' : 'pointer', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                        {cerrando === v.id ? 'Cerrando…' : '🔴 Forzar cierre'}
                      </button>
                    </div>
                  </div>
                  {(v as VisitaConRelaciones & { room_url?: string | null }).room_url && (
                    <div style={{ marginTop: '8px' }}>
                      <a href={(v as VisitaConRelaciones & { room_url?: string | null }).room_url ?? ''} target="_blank" rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: '#2D1464', color: 'white', borderRadius: '9999px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', textDecoration: 'none', display: 'inline-block' }}>
                        📹 Unirse a la llamada
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {visitaSeleccionada && visitasActivas.find(v => v.id === visitaSeleccionada) && (
              <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', height: '400px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 20px', borderBottom: '2px solid #E8E0D4' }}>
                  <strong style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif' }}>Chat en vivo (solo lectura)</strong>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(mensajes[visitaSeleccionada] ?? []).filter((m) => m.origen !== 'admin').map((m) => (
                    <div key={m.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '11px', color: '#6B5C90', whiteSpace: 'nowrap', marginTop: '2px' }}>{new Date(m.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' })}</span>
                      <span style={{ fontSize: '12px', color: '#FF6B2B', fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{m.origen}</span>
                      {m.tipo === 'foto'
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={fotoSrcFn(m)} alt="foto" style={{ maxWidth: '120px', borderRadius: '8px' }} />
                        : <span style={{ color: '#1A0A3C', fontSize: '14px' }}>{m.contenido}</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Agendadas ── */}
      {subtab === 'agendadas' && (
        visitasPreVisita.length === 0 ? (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#6B5C90' }}>No hay visitas agendadas ni en coordinación.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: visitaSeleccionada ? '1fr 1fr' : '1fr', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visitasPreVisita.map((v) => (
                <div key={v.id} onClick={() => setVisitaSeleccionada(v.id === visitaSeleccionada ? null : v.id)}
                  style={{ background: 'white', border: `2px solid ${v.id === visitaSeleccionada ? '#7C4DFF' : '#D4C9E8'}`, borderRadius: '16px', padding: '20px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7C4DFF' }} />
                    <strong style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{v.compita?.nombre}</strong>
                    <span style={{ color: '#6B5C90', fontSize: '14px' }}>con {v.usuario?.nombre}</span>
                    <span style={{ background: '#F5F0FF', color: '#7C4DFF', border: '1.5px solid #D4C9E8', borderRadius: '9999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                      {v.estado === 'programada' ? 'Programada' : 'Coordinando'}
                    </span>
                    {v.fecha_programada && (
                      <span style={{ color: '#6B5C90', fontSize: '13px' }}>
                        {new Date(v.fecha_programada + 'T12:00:00').toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Caracas' })}
                        {v.hora_inicio_programada ? ` · ${v.hora_inicio_programada}` : ''}
                      </span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setFlagModal({ entidad_tipo: 'visita', entidad_id: v.id, entidad_nombre: `${v.compita?.nombre} con ${v.usuario?.nombre}` }) }}
                      style={{ background: 'none', border: '1.5px solid #dc2626', color: '#dc2626', borderRadius: '9999px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Bricolage Grotesque, sans-serif', marginLeft: 'auto' }}>
                      ⚑ Marcar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {visitaSeleccionada && visitasPreVisita.find(v => v.id === visitaSeleccionada) && (
              <div style={{ background: 'white', border: '2px solid #D4C9E8', borderRadius: '16px', height: '400px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 20px', borderBottom: '2px solid #E8E0D4' }}>
                  <strong style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif' }}>Chat de coordinación (solo lectura)</strong>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(mensajes[visitaSeleccionada] ?? []).filter((m) => m.origen !== 'admin').map((m) => (
                    <div key={m.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '11px', color: '#6B5C90', whiteSpace: 'nowrap', marginTop: '2px' }}>{new Date(m.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' })}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: m.origen === 'cliente' ? '#FF6B2B' : '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap' }}>{m.origen.toUpperCase()}</span>
                      <span style={{ fontSize: '14px', color: '#1A0A3C' }}>{m.contenido}</span>
                    </div>
                  ))}
                  {(mensajes[visitaSeleccionada] ?? []).filter((m) => m.origen !== 'admin').length === 0 && (
                    <p style={{ color: '#9B8AB8', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>Sin mensajes aún.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Cerradas ── */}
      {subtab === 'cerradas' && (
        visitasPasadas.length === 0 ? (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#6B5C90' }}>Todavía no hay visitas cerradas.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {visitasPasadas.map((v) => (
              <div key={v.id} style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <strong style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{v.compita?.nombre}</strong>
                    <span style={{ color: '#6B5C90', fontSize: '14px' }}>con {v.usuario?.nombre}</span>
                    <span style={{ background: '#F5F5F5', color: '#6B5C90', border: '1.5px solid #E8E0D4', borderRadius: '9999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>✅ Terminada</span>
                  </div>
                  <p style={{ color: '#9B8AB8', fontSize: '13px', margin: 0 }}>
                    {v.fin ? new Date(v.fin).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Caracas' }) : v.inicio ? new Date(v.inicio).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Caracas' }) : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
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
