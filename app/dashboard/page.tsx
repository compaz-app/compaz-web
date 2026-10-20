import { redirect } from 'next/navigation'
import { getClienteActivo, requireAuth, getUsuario, isAdminEmail } from '@/lib/auth'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import Chat from '@/components/ui/Chat'
import VideoCall from '@/components/ui/VideoCall'
import VisitaWatcher from '@/components/ui/VisitaWatcher'
import LogoutButton from '@/components/ui/LogoutButton'
import SeguimientoBienestar from '@/components/ui/SeguimientoBienestar'
import PerfilFamiliar from '@/components/ui/PerfilFamiliar'
import HistorialVisitas from '@/components/ui/HistorialVisitas'
import FechaProgramada from '@/components/ui/FechaProgramada'
import PreVisitaActions from '@/components/ui/PreVisitaActions'
import ChatColapsable from '@/components/ui/ChatColapsable'
import ReagendarButton from '@/components/ui/ReagendarButton'
import AgendarOtraVisita from '@/components/ui/AgendarOtraVisita'
import { cupoDelPlan } from '@/lib/visitas'
import PlanesPago from '@/components/ui/PlanesPago'
import { solicitudPendiente, instruccionesPago, referenciaDe, type MetodoDirecto } from '@/lib/solicitudes-pago'
import { qRol, firmaRol } from '@/lib/links'
import LimpiarParamContratado from '@/components/ui/LimpiarParamContratado'
import AutoRefresh from '@/components/ui/AutoRefresh'
import ConfirmarInicioVisita from '@/components/ui/ConfirmarInicioVisita'
import PrimerAccesoModal from '@/components/ui/PrimerAccesoModal'
import type { Visita, Compita, Mensaje, Usuario, ReporteVisita } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ preview?: string; contratado?: string }> }) {
  const session = await requireAuth()
  const params = await searchParams
  const previewUid = params.preview ?? null
  const recienContratado = params.contratado === '1'

  const isAdmin = isAdminEmail(session.user.email ?? '')
  // Cliente bloqueado o eliminado: fuera, aunque su sesión siga vigente
  if (!isAdmin && !(await getClienteActivo())) redirect('/login?error=bloqueado')

  // Admin sin preview → redirigir al panel
  if (isAdmin && !previewUid) redirect('/admin')

  // Modo preview: solo admins pueden ver el dashboard de otro usuario
  const targetUid = (previewUid && isAdmin) ? previewUid : session.user.id

  const db = previewUid && isAdmin ? createAdminSupabase() : await createServerSupabase()

  const { data: usuario } = await db
    .from('usuarios')
    .select('*, compita:compitas(id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, created_at), familiar_nombre, familiar_edad, familiar_condicion, familiar_notas, telefono')
    .eq('id', targetUid)
    .single() as { data: Usuario | null }

  if (!usuario && !previewUid) redirect('/login')

  // Visita activa (en curso) o esperando confirmación del cliente
  const { data: visitaActiva } = await db
    .from('visitas')
    .select('*, compita:compitas(id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, created_at)')
    .eq('usuario_id', targetUid)
    .in('estado', ['en_curso', 'confirmando_inicio'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: (Visita & { compita: Compita }) | null }

  // Visita en coordinación pre-visita (chat para agendar fecha)
  const { data: visitaPreVisita } = await db
    .from('visitas')
    .select('*, compita:compitas(id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, created_at)')
    .eq('usuario_id', targetUid)
    .eq('estado', 'pre_visita')
    .maybeSingle() as { data: (Visita & { compita: Compita }) | null }

  // Visita programada (fecha acordada, esperando el día)
  const { data: visitaProgramada } = await db
    .from('visitas')
    .select('*, compita:compitas(id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, created_at)')
    .eq('usuario_id', targetUid)
    .eq('estado', 'programada')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: (Visita & { compita: Compita }) | null }

  // Mensajes de la visita activa, pre_visita o programada
  let mensajes: Mensaje[] = []
  const visitaConChat = visitaActiva ?? visitaPreVisita ?? visitaProgramada
  if (visitaConChat) {
    const { data } = await db
      .from('mensajes')
      .select('*')
      .eq('visit_id', visitaConChat.id)
      .order('created_at', { ascending: true })
    mensajes = (data ?? []) as Mensaje[]
  }

  // Solicitudes del cliente (nuevo sistema)
  const adminDb = createAdminSupabase()
  const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: solicitudesRaw } = await adminDb
    .from('solicitudes')
    .select('id, compita_id, estado, slot_confirmado, room_url, created_at, slots_propuestos, token_respuesta, seguimiento_enviado, compitas(nombre, foto_url, zona)')
    .eq('cliente_id', targetUid)
    .gte('created_at', hace30dias)
    .order('created_at', { ascending: false })

  type SolicitudRow = {
    id: string
    compita_id: string
    estado: string
    slot_confirmado: string | null
    room_url: string | null
    created_at: string
    slots_propuestos: string[]
    token_respuesta: string | null
    seguimiento_enviado: boolean
    compitas: { nombre: string; foto_url: string | null; zona: string } | null
  }
  const solicitudes = ((solicitudesRaw ?? []) as unknown[]).map((r) => r as SolicitudRow)
  const solicitudesPendientes = solicitudes.filter((s) => s.estado === 'pendiente')
  // Entrevistas confirmadas: solo las que el slot NO ha llegado todavía
  const ahoraDash = Date.now()
  const entrevistasConfirmadas = solicitudes.filter((s) =>
    s.estado === 'aceptada' && s.slot_confirmado
    && ahoraDash < new Date(s.slot_confirmado).getTime() + 5 * 60_000
  )
  // Llamada ocurrió: el slot pasó hace más de 5 min, o el webhook/cron ya marcó el seguimiento.
  // Excluir si el compita ya está asignado al cliente (ya contrató).
  const compitaAsignadoId = usuario?.compita_id ?? null
  const pendientesDecision = solicitudes.filter((s) => {
    if (s.compita_id === compitaAsignadoId) return false
    if (!s.token_respuesta) return false
    if (s.estado === 'completada') return true
    if (s.estado === 'aceptada' && s.seguimiento_enviado) return true
    // Slot ya pasó hace más de 5 min aunque el webhook/cron no hayan disparado aún
    if (s.estado === 'aceptada' && s.slot_confirmado) {
      return ahoraDash >= new Date(s.slot_confirmado).getTime() + 5 * 60_000
    }
    return false
  })
  const solicitudesHistorial = solicitudes.filter((s) => s.estado === 'rechazada' || s.estado === 'completada')
  const todasRechazadas = solicitudes.length > 0
    && solicitudesPendientes.length === 0
    && entrevistasConfirmadas.length === 0
    && solicitudes.every((s) => s.estado === 'rechazada')

  // Reportes de bienestar de visitas pasadas de este cliente
  const { data: reportesBienestar } = await adminDb
    .from('visitas')
    .select('reportes_visita(id, visita_id, animo, fisico, participacion, entorno, novedad, resumen_ia, created_at)')
    .eq('usuario_id', targetUid)
    .eq('estado', 'terminada')
    .order('created_at', { ascending: true })

  type ReporteRow = { id: string; visita_id: string; animo: number | null; fisico: number | null; participacion: number | null; entorno: number | null; novedad: string | null; resumen_ia: string | null; created_at: string }
  const reportes: ReporteVisita[] = (reportesBienestar ?? [])
    .flatMap((v) => {
      const r = v as unknown as { reportes_visita: ReporteRow[] | ReporteRow | null }
      if (!r.reportes_visita) return []
      const arr = Array.isArray(r.reportes_visita) ? r.reportes_visita : [r.reportes_visita]
      return arr as ReporteVisita[]
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Reseñas pendientes de aprobación del cliente
  const { data: resenasPendientes } = await adminDb
    .from('resenas')
    .select('id, compita_id, publicada, compitas(nombre)')
    .eq('cliente_id', targetUid)
    .eq('publicada', false)

  const resenasPendientesCount = resenasPendientes?.length ?? 0

  // Visitas pasadas con fotos y reportes
  const { data: visitasPasadas } = await adminDb
    .from('visitas')
    .select('*, compita:compitas(nombre), mensajes(*), reportes_visita(*)')
    .eq('usuario_id', targetUid)
    .eq('estado', 'terminada')
    .order('created_at', { ascending: false })
    .limit(10)

  const totalVisitas = (visitasPasadas?.length ?? 0) + (visitaActiva ? 1 : 0)
  const compita = usuario?.compita ?? null

  const ultimaVisitaPasada = visitasPasadas?.[0]
  const visitaTerminoHoy = !visitaActiva && ultimaVisitaPasada
    ? new Date(ultimaVisitaPasada.fin ?? ultimaVisitaPasada.created_at).toDateString() === new Date().toDateString()
    : false
  const hayVisitaActivaOCercana = !!(visitaActiva || visitaPreVisita || visitaProgramada)
  const esPrimeraVisita = (visitasPasadas?.length ?? 0) === 0
  const cupo = await cupoDelPlan(targetUid)

  // Mensajes no leídos (proxy: mensajes de compita/admin después del último mensaje del cliente)
  const ultimoMsgCliente = [...mensajes].reverse().find(m => m.origen === 'cliente')
  const unreadCount = mensajes.filter(m =>
    m.origen !== 'cliente' &&
    (!ultimoMsgCliente || m.created_at > ultimoMsgCliente.created_at)
  ).length
  const sp = previewUid ? null : await solicitudPendiente(targetUid)
  const pendientePago = sp ? { id: sp.id, tipo: sp.tipo, plan: sp.plan, horas: sp.horas, monto_usd: sp.monto_usd, metodo: sp.metodo, referencia: referenciaDe(sp.id), ...(() => { const i = instruccionesPago(sp.metodo as MetodoDirecto); return { lineas: i.lineas, configurado: i.configurado } })() } : null
  // Visitas 2, 3, 4...: con compita activa y verificada, sin otra visita en curso, y cuenta no bloqueada
  const puedeAgendarOtra = !previewUid && !!compita && compita.estado === 'activo' && compita.verificado
    && !hayVisitaActivaOCercana && !esPrimeraVisita && usuario?.plan !== 'bloqueado'

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', fontFamily: 'Inter, sans-serif' }}>

      {/* Modal de primer acceso — se muestra hasta que el cliente llene sus datos */}
      {!previewUid && !usuario?.familiar_nombre && <PrimerAccesoModal />}

      {/* Banner admin preview */}
      {previewUid && isAdmin && (
        <div style={{ background: '#1A0A3C', color: 'white', padding: '8px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Vista admin — {usuario?.nombre ?? previewUid} &lt;{usuario?.email}&gt;</span>
          <a href="/admin?tab=clientes" style={{ color: '#FF6B2B', fontWeight: 700, textDecoration: 'none', fontFamily: 'Bricolage Grotesque, sans-serif' }}>← Volver al panel</a>
        </div>
      )}

      {/* Nav */}
      <nav style={{ background: '#2D1464', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px' }}>Compaz</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>{usuario?.nombre}</span>
          {!previewUid && <LogoutButton />}
        </div>
      </nav>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 20px' }}>

        {/* ─────────────────────────────────────────────
            HERO: tarjeta de estado principal
            Una sola tarjeta que siempre dice exactamente
            dónde está el cliente y qué debe hacer ahora.
        ───────────────────────────────────────────── */}
        {usuario && (() => {
          const inicial = usuario.nombre?.charAt(0).toUpperCase() ?? '?'
          const esNuevo = !compita && !hayVisitaActivaOCercana && pendientesDecision.length === 0 && entrevistasConfirmadas.length === 0

          // Pasos del onboarding (solo relevantes cuando esNuevo)
          const paso1Hecho = solicitudes.length > 0
          const paso2Hecho = entrevistasConfirmadas.length > 0 || pendientesDecision.length > 0 || solicitudesHistorial.some(s => s.estado === 'completada')
          const paso3Hecho = !!compita

          // Estado con badge + descripción
          const estado = visitaActiva?.estado === 'en_curso'
            ? { badge: '🟢 Visita en curso', desc: `${visitaActiva.compita.nombre} está con tu familiar`, badgeBg: '#DCFCE7', badgeColor: '#15803d' }
            : visitaActiva?.estado === 'confirmando_inicio'
            ? { badge: '🔔 Tu compita llegó', desc: 'Confirma su llegada para iniciar la visita', badgeBg: '#DBEAFE', badgeColor: '#1d4ed8' }
            : visitaPreVisita
            ? { badge: unreadCount > 0 ? `💬 ${unreadCount} mensaje${unreadCount > 1 ? 's' : ''} nuevo${unreadCount > 1 ? 's' : ''}` : '📋 Coordinando visita', desc: `Coordina la fecha con ${visitaPreVisita.compita.nombre}`, badgeBg: unreadCount > 0 ? '#FEE2E2' : '#DCFCE7', badgeColor: unreadCount > 0 ? '#DC2626' : '#15803d' }
            : visitaProgramada
            ? { badge: '🗓️ Visita programada', desc: `${visitaProgramada.compita.nombre} · ${visitaProgramada.fecha_programada ? new Date(visitaProgramada.fecha_programada + 'T00:00:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' }) : 'fecha por confirmar'}`, badgeBg: '#EDE9FE', badgeColor: '#2D1464' }
            : pendientesDecision.length > 0
            ? { badge: '📞 Llamada completada', desc: 'Decide si quieres contratar', badgeBg: '#FEF3C7', badgeColor: '#92400E' }
            : entrevistasConfirmadas.length > 0
            ? { badge: '📅 Entrevista confirmada', desc: `Con ${entrevistasConfirmadas[0].compitas?.nombre ?? 'tu compita'}`, badgeBg: '#DBEAFE', badgeColor: '#1d4ed8' }
            : solicitudesPendientes.length > 0
            ? { badge: '⏳ Esperando respuesta', desc: `${solicitudesPendientes.length} compita${solicitudesPendientes.length > 1 ? 's' : ''} recibió tu solicitud`, badgeBg: '#FEF3C7', badgeColor: '#92400E' }
            : compita
            ? { badge: '✅ Con compita', desc: compita.nombre, badgeBg: '#DCFCE7', badgeColor: '#15803d' }
            : { badge: '👋 Bienvenido', desc: 'Encuentra a tu compita', badgeBg: '#F5F0FF', badgeColor: '#6B5C90' }

          return (
            <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '20px', padding: '24px', marginBottom: '28px' }}>
              {/* Fila superior: avatar + nombre + badges */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#2D1464', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px' }}>{inicial}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '18px', color: '#1A0A3C', marginBottom: '6px' }}>
                    {usuario.nombre}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    <span style={{ background: estado.badgeBg, color: estado.badgeColor, borderRadius: '9999px', padding: '4px 12px', fontSize: '13px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap' }}>
                      {estado.badge}
                    </span>
                    {/* Cupo del plan */}
                    {cupo && cupo.restantes > 0 && (
                      <span style={{ background: '#F5F0FF', color: '#2D1464', borderRadius: '9999px', padding: '4px 12px', fontSize: '13px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        🎫 {cupo.restantes} visita{cupo.restantes !== 1 ? 's' : ''} disponible{cupo.restantes !== 1 ? 's' : ''}
                      </span>
                    )}
                    {cupo && cupo.restantes === 0 && (
                      <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: '9999px', padding: '4px 12px', fontSize: '13px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        ⚠️ Sin visitas disponibles
                      </span>
                    )}
                  </div>
                  {estado.desc && (
                    <div style={{ color: '#6B5C90', fontSize: '13px', marginTop: '6px', lineHeight: 1.4 }}>{estado.desc}</div>
                  )}
                </div>
              </div>

              {/* Barra de progreso — solo para clientes nuevos buscando compita */}
              {esNuevo && (
                <div style={{ borderTop: '1.5px solid #F0EBF8', marginTop: '20px', paddingTop: '20px' }}>
                  <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '12px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
                    Cómo funciona
                  </p>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    {([
                      { label: 'Pide una entrevista', sub: 'Elige un compita y propón horarios', done: paso1Hecho },
                      { label: 'Conócelo en llamada', sub: '20 minutos para saber si encajan', done: paso2Hecho },
                      { label: 'Contrata y comienza', sub: 'Coordina la primera visita', done: paso3Hecho },
                    ] as const).map((paso, i, arr) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: paso.done ? '#15803d' : (i === arr.findIndex(p => !p.done) ? '#FF6B2B' : '#E8E0D4'), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: '13px', flexShrink: 0, marginBottom: '8px' }}>
                            {paso.done ? '✓' : i + 1}
                          </div>
                          <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '12px', color: paso.done ? '#15803d' : (i === arr.findIndex(p => !p.done) ? '#C84B0E' : '#9B8AB8'), textAlign: 'center', lineHeight: 1.3, marginBottom: '2px' }}>{paso.label}</span>
                          <span style={{ fontSize: '11px', color: '#9B8AB8', textAlign: 'center', lineHeight: 1.3 }}>{paso.sub}</span>
                        </div>
                        {i < arr.length - 1 && (
                          <div style={{ height: '2px', flex: 0.4, background: paso.done ? '#22c55e' : '#E8E0D4', marginTop: '15px', flexShrink: 0 }} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <a href="/compitas" style={{ display: 'inline-block', background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '13px 32px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: '16px', textDecoration: 'none', boxShadow: '0 4px 20px rgba(255,107,43,0.35)' }}>
                      {paso1Hecho ? 'Ver más compitas →' : 'Ver compitas disponibles →'}
                    </a>
                  </div>
                </div>
              )}

              {/* Info de familiar incompleta — aviso */}
              {!esNuevo && !usuario.familiar_nombre && (
                <div style={{ marginTop: '16px', background: '#FEF3C7', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#92400E', lineHeight: 1.4 }}>
                    <strong>Falta información de tu familiar.</strong> Tu compita la necesita para prepararse. <a href="#familiar" style={{ color: '#C84B0E', fontWeight: 700 }}>Completar →</a>
                  </p>
                </div>
              )}
            </div>
          )
        })()}

        {/* Banner post-pago */}
        {recienContratado && visitaPreVisita && (
          <>
            <LimpiarParamContratado />
            <div style={{ background: '#F0FDF4', border: '2px solid #22c55e', borderRadius: '16px', padding: '20px 24px', marginBottom: '28px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '28px', flexShrink: 0 }}>🎉</span>
              <div>
                <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '17px', color: '#15803d', margin: '0 0 4px' }}>
                  ¡Contratación confirmada!
                </p>
                <p style={{ color: '#166534', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
                  <strong>{visitaPreVisita.compita.nombre}</strong> ya recibió la notificación y te va a escribir por este chat para coordinar la fecha de la primera visita. Puedes escribirle tú también.
                </p>
              </div>
            </div>
          </>
        )}

        {/* ─────────────────────────────────────────────
            SECCIÓN 1.5: DECISIÓN PENDIENTE POST-LLAMADA
            Alta visibilidad — si hay una llamada completada sin decisión,
            esta sección aparece primero para no perder la venta.
        ───────────────────────────────────────────── */}
        {pendientesDecision.length > 0 && pendientesDecision.map((sol) => {
          const t = sol.token_respuesta!
          const compitaNombre = (sol.compitas as { nombre: string } | null)?.nombre ?? 'tu compita'
          const contratoUrl = `/pago?solicitud=${sol.id}`
          const noContratoUrl = `/api/solicitud/resultado-llamada?token=${t}&resultado=no_contratar&${qRol(t, 'cliente')}`
          return (
            <section key={sol.id} style={{ marginBottom: '32px', background: 'linear-gradient(135deg, #FFF7ED 0%, #FFF3E8 100%)', border: '3px solid #FF6B2B', borderRadius: '20px', padding: '28px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '28px' }}>📞</span>
                <div>
                  <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: '20px', color: '#1A0A3C', margin: 0 }}>
                    ¿Contratas a {compitaNombre}?
                  </h2>
                  <p style={{ color: '#C84B0E', fontSize: '14px', margin: '4px 0 0', fontWeight: 600 }}>
                    Tu llamada terminó — decide ahora para no perder este cupo
                  </p>
                </div>
              </div>
              <p style={{ color: '#4A3B6B', fontSize: '15px', lineHeight: '1.6', margin: '0 0 24px' }}>
                Tuviste una llamada con <strong>{compitaNombre}</strong>. Si quieres contratarle, hazlo ahora.
                Este botón también llegó a tu correo — si ya lo usaste, esta sección desaparecerá sola.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <a
                  href={contratoUrl}
                  style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '14px 28px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: '17px', textDecoration: 'none', display: 'inline-block', boxShadow: '0 4px 16px rgba(255,107,43,0.4)' }}
                >
                  ✅ Sí, quiero contratar a {compitaNombre}
                </a>
                <a
                  href={noContratoUrl}
                  style={{ background: 'transparent', color: '#6B5C90', border: '2px solid #C4B5D4', borderRadius: '9999px', padding: '12px 22px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', textDecoration: 'none', display: 'inline-block' }}
                >
                  No por ahora
                </a>
              </div>
            </section>
          )
        })}

        {/* ─────────────────────────────────────────────
            SECCIÓN 1.7: ENTREVISTA CONFIRMADA
            Visible siempre que haya una llamada próxima,
            sin importar si ya hay compita asignado o no.
        ───────────────────────────────────────────── */}
        {entrevistasConfirmadas.length > 0 && (() => {
          const hayActiva = entrevistasConfirmadas.some((sol) => {
            const slotMs = sol.slot_confirmado ? new Date(sol.slot_confirmado).getTime() : Infinity
            return sol.room_url && sol.token_respuesta && Date.now() >= slotMs - 10 * 60_000
          })
          return (
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
                {hayActiva ? '🟠 Llamada en curso' : '📞 Tu próxima entrevista'}
              </h2>
              <div style={{ background: hayActiva ? '#FFF3E8' : 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)', border: `2px solid ${hayActiva ? '#FF6B2B' : '#22C55E'}`, borderRadius: '20px', padding: '24px 24px 20px' }}>
                {hayActiva && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#FF6B2B', boxShadow: '0 0 0 3px rgba(255,107,43,0.3)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: '15px', color: '#C84B0E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Llamada activa ahora — entra ya
                    </span>
                  </div>
                )}
                {!hayActiva && (
                  <p style={{ color: '#166534', fontSize: '14px', fontWeight: 600, margin: '0 0 16px', lineHeight: 1.5 }}>
                    Tienes una llamada de 20 minutos agendada para conocer a tu compita. El enlace para entrar aparecerá aquí cuando sea la hora.
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {entrevistasConfirmadas.map((sol) => {
                    const c = sol.compitas
                    const fechaLabel = sol.slot_confirmado
                      ? new Date(sol.slot_confirmado).toLocaleString('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: true })
                      : '—'
                    const ahora = Date.now()
                    const slotMs = sol.slot_confirmado ? new Date(sol.slot_confirmado).getTime() : Infinity
                    const enCurso = !!(sol.room_url && sol.token_respuesta && ahora >= slotMs - 10 * 60_000)
                    const salaUrl = enCurso && sol.token_respuesta
                      ? `/sala/${sol.token_respuesta}?${qRol(sol.token_respuesta, 'cliente')}`
                      : null
                    return (
                      <div key={sol.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: enCurso ? '#FFF3E8' : 'white', border: `1.5px solid ${enCurso ? '#FF6B2B' : '#86EFAC'}`, borderRadius: '14px', flexWrap: 'wrap' }}>
                        {c?.foto_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={c.foto_url} alt={c.nombre} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: enCurso ? '#FFE4D6' : '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0 }}>👤</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, color: '#1A0A3C', fontSize: '17px' }}>{c?.nombre ?? '—'}</div>
                          {enCurso
                            ? <div style={{ color: '#C84B0E', fontSize: '14px', fontWeight: 700, marginTop: '4px' }}>🟠 Llamada en curso ahora</div>
                            : <div style={{ color: '#166534', fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>📅 {fechaLabel} (hora Venezuela)</div>
                          }
                          <div style={{ color: '#6B5C90', fontSize: '12px', marginTop: '4px' }}>⏱️ Llamada de 20 minutos</div>
                        </div>
                        {salaUrl ? (
                          <a href={salaUrl}
                            style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '12px 24px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: '15px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 4px 16px rgba(255,107,43,0.4)' }}>
                            Entrar a la llamada →
                          </a>
                        ) : (
                          <span style={{ background: '#DCFCE7', color: '#166534', border: '1.5px solid #86EFAC', borderRadius: '9999px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            ✅ Confirmada
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {!hayActiva && (
                  <p style={{ color: '#9B8AB8', fontSize: '12px', margin: '14px 0 0', lineHeight: 1.5 }}>
                    El enlace para entrar a la llamada también llegó a tu correo. Si no lo encuentras, actualiza esta página cuando sea la hora.
                  </p>
                )}
              </div>
            </section>
          )
        })()}

        {/* ─────────────────────────────────────────────
            SECCIÓN 2: ESTADO ACTUAL DE LA VISITA
            Muestra solo el estado activo. Sin duplicados.
        ───────────────────────────────────────────── */}

        {/* 2a. Visita en curso (o esperando confirmación del cliente) */}
        {visitaActiva && (
          <section id="visita-en-curso" style={{ marginBottom: '40px' }}>
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
              {visitaActiva.estado === 'confirmando_inicio' ? '¡Tu compita llegó!' : 'Visita en curso'}
            </h2>

            {visitaActiva.estado === 'confirmando_inicio' && !previewUid && (
              <ConfirmarInicioVisita
                visitaId={visitaActiva.id}
                compitaNombre={visitaActiva.compita.nombre}
              />
            )}

            {visitaActiva.estado === 'en_curso' && !previewUid && (
              <VideoCall
                visitaId={visitaActiva.id}
                compitaNombre={visitaActiva.compita.nombre}
                roomUrlInicial={visitaActiva.room_url ?? null}
              />
            )}
            {visitaActiva.estado === 'en_curso' && previewUid && visitaActiva.room_url && (
              <div style={{ marginBottom: '16px' }}>
                <a href={visitaActiva.room_url} target="_blank" rel="noreferrer"
                  style={{ background: '#2D1464', color: 'white', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>
                  📹 Unirse a la llamada activa
                </a>
              </div>
            )}
            {(visitaActiva.estado === 'en_curso' || visitaActiva.estado === 'confirmando_inicio') && (
              <div style={{ background: 'white', border: `2px solid ${visitaActiva.estado === 'en_curso' ? '#22c55e' : '#1d4ed8'}`, borderRadius: '16px', overflow: 'hidden', height: '500px', display: 'flex', flexDirection: 'column' }}>
                <Chat visita={visitaActiva} mensajesIniciales={mensajes} compitaNombre={visitaActiva.compita.nombre} />
              </div>
            )}
          </section>
        )}

        {/* 2b. Coordinando la primera visita (pre_visita) */}
        {!visitaActiva && visitaPreVisita && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {esPrimeraVisita ? 'Coordinando primera visita' : 'Coordinando próxima visita'}
              {unreadCount > 0 && (
                <span style={{ background: '#DC2626', color: 'white', borderRadius: '9999px', padding: '2px 8px', fontSize: '11px', fontWeight: 900, fontFamily: 'Inter, sans-serif', textTransform: 'none', letterSpacing: 0 }}>
                  {unreadCount} nuevo{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </h2>
            <div id="fecha-programada">
              {!previewUid && (
                <FechaProgramada
                  visitaId={visitaPreVisita.id}
                  fechaActual={visitaPreVisita.fecha_programada ?? null}
                  horaInicioActual={visitaPreVisita.hora_inicio_programada ?? null}
                  horaFinActual={visitaPreVisita.hora_fin_programada ?? null}
                  compitaNombre={visitaPreVisita.compita.nombre}
                />
              )}
            </div>
            <div style={{ background: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>🗓️</span>
              <div>
                <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, color: '#15803d', fontSize: '15px', margin: '0 0 4px' }}>
                  {esPrimeraVisita ? '¡Contratación confirmada! Coordina la primera visita' : 'Coordina la próxima visita'}
                </p>
                <p style={{ color: '#166534', fontSize: '13px', margin: '0 0 8px', lineHeight: '1.5' }}>
                  Usa este chat para ponerte de acuerdo con <strong>{visitaPreVisita.compita.nombre}</strong> en la fecha y hora de {esPrimeraVisita ? 'la primera visita' : 'la próxima visita'}.
                </p>
                <p style={{ color: '#15803d', fontSize: '12px', margin: 0, background: 'rgba(34,197,94,0.1)', borderRadius: '8px', padding: '8px 12px', lineHeight: '1.5' }}>
                  🛡️ <strong>Mantén la conversación aquí.</strong> Las comunicaciones dentro de Compaz están protegidas y garantizamos el servicio. Acuerdos fuera de la plataforma quedan fuera de nuestra cobertura.
                </p>
              </div>
            </div>
            <div style={{ background: 'white', border: '2px solid #86EFAC', borderRadius: '16px', overflow: 'hidden', height: '400px', display: 'flex', flexDirection: 'column' }}>
              <Chat visita={visitaPreVisita} mensajesIniciales={mensajes} compitaNombre={visitaPreVisita.compita.nombre} />
            </div>
            {!previewUid && (
              <PreVisitaActions
                compitaNombre={visitaPreVisita.compita.nombre}
                tieneFecha={!!visitaPreVisita.fecha_programada}
              />
            )}
          </section>
        )}

        {/* 2c. Visita programada: fecha confirmada, esperando el día */}
        {!visitaActiva && !visitaPreVisita && visitaProgramada && (() => {
          const fecha = visitaProgramada.fecha_programada
          const fechaFormateada = fecha
            ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            : null
          // Detectar retraso: la visita era hoy y ya pasó la hora de inicio
          const horaInicio = visitaProgramada.hora_inicio_programada
          const horaActualVE = new Date(Date.now() - 4 * 3600_000).toISOString().slice(11, 16)
          const esHoy = fecha === new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10)
          const hayRetraso = esHoy && !!horaInicio && horaActualVE > horaInicio
          return (
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
                Próxima visita
              </h2>
              {hayRetraso && (
                <div style={{ background: '#FEF3C7', border: '2px solid #F59E0B', borderRadius: '16px', padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
                  <div>
                    <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, color: '#92400E', fontSize: '15px', margin: '0 0 4px' }}>
                      La visita debería haber empezado
                    </p>
                    <p style={{ color: '#78350F', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                      {visitaProgramada.compita.nombre} aún no ha iniciado la visita. Ya le enviamos un aviso. Si no te contacta pronto, escríbele por el chat o contáctanos a hola@micompaz.com.
                    </p>
                  </div>
                </div>
              )}
              <div style={{ background: hayRetraso ? '#FFFBEB' : '#F5F0FF', border: `2px solid ${hayRetraso ? '#F59E0B' : '#7C4DFF'}`, borderRadius: '16px', padding: '28px', marginBottom: '16px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px', color: '#2D1464', margin: '0 0 6px' }}>
                  🗓️ {fechaFormateada ? `Tu visita es el ${fechaFormateada}` : 'Visita próximamente'}
                </p>
                {visitaProgramada.hora_inicio_programada && visitaProgramada.hora_fin_programada && (
                  <p style={{ color: '#2D1464', fontSize: '17px', fontWeight: 700, margin: '0 0 6px' }}>
                    🕐 {visitaProgramada.hora_inicio_programada} – {visitaProgramada.hora_fin_programada}
                  </p>
                )}
                <p style={{ color: '#6B5C90', fontSize: '15px', margin: 0 }}>
                  {visitaProgramada.compita.nombre} visitará a tu familiar ese día.
                </p>
              </div>
              <ChatColapsable
                visita={visitaProgramada}
                mensajesIniciales={mensajes}
                compitaNombre={visitaProgramada.compita.nombre}
              />
              <ReagendarButton visitaId={visitaProgramada.id} compitaNombre={visitaProgramada.compita.nombre} />
            </section>
          )
        })()}

        {/* 2d. Visita terminó hoy — mensaje de cierre + CTA agendar */}
        {visitaTerminoHoy && (
          <section style={{ marginBottom: '40px' }}>
            <div style={{ background: '#F0FDF4', border: '2px solid #22c55e', borderRadius: '16px', padding: '28px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '36px', flexShrink: 0 }}>🎉</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '18px', color: '#15803d', margin: '0 0 4px' }}>
                  La visita de hoy terminó
                </p>
                <p style={{ color: '#166534', fontSize: '14px', margin: '0 0 4px' }}>
                  Gracias a <strong>{compita?.nombre ?? 'tu compita'}</strong> por acompañar a tu familiar.
                </p>
                <p style={{ color: '#4A7C59', fontSize: '13px', margin: 0 }}>
                  El resumen completo llegará a tu correo en breve.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ─────────────────────────────────────────────
            SECCIÓN 3: TU COMPITA
        ───────────────────────────────────────────── */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
            Tu compita
          </h2>

          {compita ? (
            /* Compita asignado: tarjeta con acciones rápidas */
            <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '20px', padding: '24px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '16px' }}>
                {compita.foto_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={compita.foto_url} alt={compita.nombre} style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', flexShrink: 0 }}>👤</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <h3 style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px', margin: 0 }}>
                      {compita.nombre}
                    </h3>
                    {compita.verificado && (
                      <span style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '9999px', padding: '2px 10px', fontSize: '12px', color: '#15803d', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>
                        ✓ Verificado
                      </span>
                    )}
                  </div>
                  <p style={{ color: '#9B8AB8', fontSize: '13px', margin: '0 0 6px' }}>{compita.zona}</p>
                  <p style={{ color: '#4A3B6B', fontSize: '13px', margin: 0 }}>
                    {totalVisitas} {totalVisitas === 1 ? 'visita realizada' : 'visitas realizadas'}
                    {usuario?.plan ? ` · Plan ${usuario.plan}` : ''}
                  </p>
                </div>
              </div>
              {/* Acciones rápidas */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1.5px solid #F0EBF8', paddingTop: '16px' }}>
                {puedeAgendarOtra && (
                  <a href="#agendar" style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none' }}>
                    📅 Agendar visita
                  </a>
                )}
                <a href="/compitas" style={{ background: '#F5F0FF', color: '#4A3B6B', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>
                  Ver otros compitas
                </a>
              </div>
            </div>
          ) : (
            /* Sin compita: solicitudes en curso + CTA */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Solicitudes pendientes */}
              {solicitudesPendientes.length > 0 && (
                <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', color: '#1A0A3C', margin: 0 }}>
                      ⏳ Esperando respuesta
                    </h3>
                    <span style={{ color: '#9B8AB8', fontSize: '12px' }}>{solicitudesPendientes.length}/3 solicitudes</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {solicitudesPendientes.map((sol) => {
                      const c = sol.compitas
                      return (
                        <div key={sol.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#FDFAF6', border: '1.5px solid #E8E0D4', borderRadius: '10px' }}>
                          {c?.foto_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={c.foto_url} alt={c.nombre} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>👤</div>
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#1A0A3C', fontSize: '14px' }}>{c?.nombre ?? '—'}</div>
                            {c?.zona && <div style={{ color: '#9B8AB8', fontSize: '11px', marginTop: '1px' }}>{c.zona}</div>}
                          </div>
                          <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: '9999px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            Pendiente
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p style={{ color: '#9B8AB8', fontSize: '12px', marginTop: '12px', marginBottom: 0, lineHeight: 1.4 }}>
                    El compita elige el horario que le funcione. Recibirás un correo de confirmación.
                  </p>
                </div>
              )}

              {/* CTA: buscar compita (si aún puede enviar solicitudes) */}
              {solicitudesPendientes.length < 3 && (
                <div style={{ background: todasRechazadas ? 'white' : '#FDFAF6', border: `2px solid ${todasRechazadas ? '#FF6B2B' : '#E8E0D4'}`, borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', color: '#1A0A3C', margin: '0 0 4px' }}>
                      {todasRechazadas ? 'Ningún compita pudo esta vez' : solicitudesPendientes.length > 0 ? 'Solicita a otro compita también' : 'Aún no tienes compita'}
                    </h3>
                    <p style={{ color: '#6B5C90', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>
                      {todasRechazadas ? 'Hay más compitas disponibles. Intenta con otros perfiles.' : 'Explora los perfiles y elige el que mejor encaje con tu familiar.'}
                    </p>
                  </div>
                  <a href="/compitas" style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '11px 22px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Ver compitas →
                  </a>
                </div>
              )}

              {/* Historial de solicitudes (colapsado visualmente) */}
              {solicitudesHistorial.length > 0 && (
                <details style={{ background: 'white', border: '1.5px solid #E8E0D4', borderRadius: '12px', padding: '0' }}>
                  <summary style={{ padding: '12px 16px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', color: '#9B8AB8', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Solicitudes anteriores ({solicitudesHistorial.length})</span>
                    <span style={{ fontSize: '11px' }}>▾</span>
                  </summary>
                  <div style={{ borderTop: '1.5px solid #F0EBF8', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {solicitudesHistorial.map((sol) => {
                      const c = sol.compitas
                      const esCompletada = sol.estado === 'completada'
                      const esRechazada = sol.estado === 'rechazada'
                      const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://micompaz.com'
                      const mensajeCompita = esRechazada ? (sol as unknown as { mensaje_compita_reagendar?: string | null }).mensaje_compita_reagendar : null
                      return (
                        <div key={sol.id} style={{ padding: '10px 12px', background: '#FDFAF6', border: '1.5px solid #E8E0D4', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            {c?.foto_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={c.foto_url} alt={c.nombre} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                              : <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>👤</div>
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#9B8AB8', fontSize: '13px' }}>{c?.nombre ?? '—'}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              {esRechazada && sol.token_respuesta && !previewUid && (
                                <a href={`${SITE}/reagendar/${sol.token_respuesta}`}
                                  style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', color: '#FF6B2B', border: '1.5px solid #FF6B2B', borderRadius: '9999px', padding: '2px 9px', textDecoration: 'none' }}>
                                  🔄 Reagendar
                                </a>
                              )}
                              <span style={{ borderRadius: '9999px', padding: '2px 9px', fontSize: '11px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', background: esCompletada ? '#DCFCE7' : '#FEF2F2', color: esCompletada ? '#166534' : '#991b1b', border: esCompletada ? '1.5px solid #86EFAC' : '1.5px solid #fca5a5' }}>
                                {esCompletada ? '✅ Contratado' : mensajeCompita ? '🔄 Propuso otro horario' : '✗ No pudo esta vez'}
                              </span>
                            </div>
                          </div>
                          {mensajeCompita && (
                            <div style={{ marginTop: '10px', background: '#F5F0FF', border: '1.5px solid rgba(124,77,255,0.25)', borderRadius: '8px', padding: '10px 14px' }}>
                              <p style={{ margin: '0 0 4px', fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700, color: '#7C4DFF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Mensaje de {c?.nombre ?? 'el compita'}
                              </p>
                              <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#1A0A3C', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                {mensajeCompita}
                              </p>
                              {sol.token_respuesta && !previewUid && (
                                <p style={{ margin: '8px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#6B5C90' }}>
                                  ¿Te funciona alguno? Usa el botón <strong>🔄 Reagendar</strong> para agendar con {c?.nombre ?? 'el compita'} en esa nueva fecha.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </details>
              )}
            </div>
          )}
        </section>

        {/* Agendar otra visita — justo después de ver al compita */}
        {puedeAgendarOtra && compita && (
          <section id="agendar" style={{ marginBottom: '32px', scrollMarginTop: '24px' }}>
            <AgendarOtraVisita compitaNombre={compita.nombre} cupo={cupo} />
          </section>
        )}

        {/* ─────────────────────────────────────────────
            SECCIÓN 4: TU FAMILIAR
        ───────────────────────────────────────────── */}
        {usuario && (
          <section id="familiar" style={{ marginBottom: '40px', scrollMarginTop: '24px' }}>
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
              Tu familiar
            </h2>
            {!previewUid ? <PerfilFamiliar usuario={usuario} /> : <PerfilFamiliar usuario={usuario} readonly />}
          </section>
        )}

        {/* Aviso reseña pendiente de aprobación */}
        {resenasPendientesCount > 0 && (
          <div style={{ background: '#F0FDF4', border: '2px solid #22c55e', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>⭐</span>
            <p style={{ margin: 0, color: '#15803d', fontSize: '14px', lineHeight: '1.5' }}>
              <strong>Tu reseña está en revisión.</strong> En cuanto la aprobemos aparecerá en el perfil público de {(() => { const r = resenasPendientes?.[0] as unknown as { compitas?: { nombre: string }[] } | null; return r?.compitas?.[0]?.nombre ?? 'tu compita' })()} . Gracias por tomarte el tiempo.
            </p>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            SECCIÓN 5: BIENESTAR E HISTORIAL
            Solo si hay visitas terminadas
        ───────────────────────────────────────────── */}
        {(reportes.length > 0 || (visitasPasadas && visitasPasadas.length > 0)) && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
              Seguimiento y bienestar
            </h2>

            {/* Indicadores y gráfico */}
            {compita && reportes.length > 0 && (
              <SeguimientoBienestar reportes={reportes} compitaNombre={compita.nombre} />
            )}

            {/* Registro de novedades */}
            {(() => {
              const novedades = reportes.filter((r) => r.novedad)
              if (novedades.length === 0) return null
              return (
                <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                  <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '15px', color: '#1A0A3C', margin: '0 0 14px' }}>
                    📋 Registro de novedades
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[...novedades].reverse().map((r) => {
                      const fecha = new Date(r.created_at).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })
                      return (
                        <div key={r.id} style={{ display: 'flex', gap: '14px', padding: '12px 16px', background: '#FFF3E8', border: '1.5px solid #FF6B2B', borderRadius: '10px' }}>
                          <span style={{ color: '#C84B0E', fontSize: '12px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap', marginTop: '2px', minWidth: '110px', textTransform: 'capitalize' }}>{fecha}</span>
                          <p style={{ color: '#1A0A3C', fontSize: '14px', margin: 0, lineHeight: '1.5' }}>{r.novedad}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Historial de visitas */}
            {(() => {
              type RawVisita = Visita & { compita?: { nombre: string }; mensajes?: Mensaje[]; reportes_visita?: ReporteVisita[] }
              const visitasConDatos = ((visitasPasadas ?? []) as unknown as RawVisita[]).map((v) => ({
                ...v,
                mensajes: (v.mensajes ?? []) as Mensaje[],
                reporte: Array.isArray(v.reportes_visita) ? (v.reportes_visita[0] ?? null) : null,
              }))
              return (
                <HistorialVisitas
                  visitas={visitasConDatos}
                  compitaId={compita?.id ?? null}
                  compitaNombre={compita?.nombre ?? null}
                />
              )
            })()}
          </section>
        )}

        {/* Planes y pago — al fondo, acción secundaria */}
        {!previewUid && (
          <section style={{ marginBottom: '40px' }}>
            <PlanesPago pendiente={pendientePago} />
          </section>
        )}

      </div>

      {/* Actualiza la página cuando cambia el estado de la visita */}
      {usuario && <VisitaWatcher usuarioId={targetUid} visitaActivaId={visitaActiva?.id ?? null} />}
      {/* Refresca cada 15 s para mostrar cambios en llamadas y solicitudes */}
      <AutoRefresh intervaloSeg={15} />
    </div>
  )
}
