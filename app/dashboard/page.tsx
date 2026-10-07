import { redirect } from 'next/navigation'
import { requireAuth, getUsuario, isAdminEmail } from '@/lib/auth'
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
import type { Visita, Compita, Mensaje, Usuario, ReporteVisita } from '@/types'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const session = await requireAuth()
  const params = await searchParams
  const previewUid = params.preview ?? null

  const isAdmin = isAdminEmail(session.user.email ?? '')

  // Admin sin preview → redirigir al panel
  if (isAdmin && !previewUid) redirect('/admin')

  // Modo preview: solo admins pueden ver el dashboard de otro usuario
  const targetUid = (previewUid && isAdmin) ? previewUid : session.user.id

  const db = previewUid && isAdmin ? createAdminSupabase() : await createServerSupabase()

  const { data: usuario } = await db
    .from('usuarios')
    .select('*, compita:compitas(id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, created_at), familiar_nombre, familiar_edad, familiar_condicion, familiar_notas')
    .eq('id', targetUid)
    .single() as { data: Usuario | null }

  if (!usuario && !previewUid) redirect('/login')

  // Visita activa (en curso)
  const { data: visitaActiva } = await db
    .from('visitas')
    .select('*, compita:compitas(id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, created_at)')
    .eq('usuario_id', targetUid)
    .eq('estado', 'en_curso')
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
    .select('id, compita_id, estado, slot_confirmado, room_url, created_at, slots_propuestos, compitas(nombre, foto_url, zona)')
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
    compitas: { nombre: string; foto_url: string | null; zona: string } | null
  }
  const solicitudes = ((solicitudesRaw ?? []) as unknown[]).map((r) => r as SolicitudRow)
  const solicitudesPendientes = solicitudes.filter((s) => s.estado === 'pendiente')
  const entrevistasConfirmadas = solicitudes.filter((s) => s.estado === 'aceptada' && s.slot_confirmado)
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
    ? new Date(ultimaVisitaPasada.created_at).toDateString() === new Date().toDateString()
    : false
  const hayVisitaActivaOCercana = !!(visitaActiva || visitaPreVisita || visitaProgramada)

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', fontFamily: 'Inter, sans-serif' }}>

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
            SECCIÓN 1: CABECERA DE CUENTA
        ───────────────────────────────────────────── */}
        {usuario && (() => {
          const inicial = usuario.nombre?.charAt(0).toUpperCase() ?? '?'
          const clienteDesde = new Date(usuario.created_at ?? '').toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
          const hayEntrevista = entrevistasConfirmadas.length > 0
          const hayPendiente = solicitudesPendientes.length > 0
          const badge = visitaActiva
            ? { label: '🟢 Visita en curso', bg: '#F0FDF4', color: '#15803d', border: '#22c55e' }
            : visitaPreVisita
            ? { label: '📋 Coordinando visita', bg: '#F0FDF4', color: '#15803d', border: '#86EFAC' }
            : visitaProgramada
            ? { label: '🗓️ Visita programada', bg: '#F5F0FF', color: '#2D1464', border: '#7C4DFF' }
            : hayEntrevista
            ? { label: '📅 Entrevista confirmada', bg: '#EFF6FF', color: '#1d4ed8', border: '#60a5fa' }
            : hayPendiente
            ? { label: '⏳ Esperando respuesta', bg: '#FFF3E8', color: '#C84B0E', border: '#FF6B2B' }
            : compita
            ? { label: '✅ Compita asignado', bg: '#F0FDF4', color: '#15803d', border: '#22c55e' }
            : { label: '🔍 Buscando compita', bg: '#F5F0E8', color: '#6B5C90', border: '#D4CAE8' }
          return (
            <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '20px 24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#2D1464', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px' }}>{inicial}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '18px', color: '#1A0A3C' }}>{usuario.nombre}</div>
                <div style={{ fontSize: '13px', color: '#9B8AB8', marginTop: '2px' }}>
                  Cliente desde {clienteDesde} · {totalVisitas} {totalVisitas === 1 ? 'visita' : 'visitas'}
                  {usuario.plan ? ` · Plan ${usuario.plan}` : ''}
                </div>
              </div>
              <span style={{ background: badge.bg, color: badge.color, border: `1.5px solid ${badge.border}`, borderRadius: '9999px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {badge.label}
              </span>
            </div>
          )
        })()}

        {/* ─────────────────────────────────────────────
            SECCIÓN 2: ESTADO ACTUAL DE LA VISITA
            Muestra solo el estado activo. Sin duplicados.
        ───────────────────────────────────────────── */}

        {/* 2a. Visita en curso */}
        {visitaActiva && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
              Visita en curso
            </h2>
            {!previewUid && (
              <VideoCall
                visitaId={visitaActiva.id}
                compitaNombre={visitaActiva.compita.nombre}
                roomUrlInicial={visitaActiva.room_url ?? null}
              />
            )}
            {previewUid && visitaActiva.room_url && (
              <div style={{ marginBottom: '16px' }}>
                <a href={visitaActiva.room_url} target="_blank" rel="noreferrer"
                  style={{ background: '#2D1464', color: 'white', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>
                  📹 Unirse a la llamada activa
                </a>
              </div>
            )}
            <div style={{ background: 'white', border: '2px solid #22c55e', borderRadius: '16px', overflow: 'hidden', height: '500px', display: 'flex', flexDirection: 'column' }}>
              <Chat visita={visitaActiva} mensajesIniciales={mensajes} compitaNombre={visitaActiva.compita.nombre} />
            </div>
          </section>
        )}

        {/* 2b. Coordinando la primera visita (pre_visita) */}
        {!visitaActiva && visitaPreVisita && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
              Coordinando primera visita
            </h2>
            <div id="fecha-programada">
              {!previewUid && (
                <FechaProgramada
                  visitaId={visitaPreVisita.id}
                  fechaActual={visitaPreVisita.fecha_programada ?? null}
                  compitaNombre={visitaPreVisita.compita.nombre}
                />
              )}
            </div>
            <div style={{ background: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>🗓️</span>
              <div>
                <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, color: '#15803d', fontSize: '15px', margin: '0 0 4px' }}>
                  ¡Contratación confirmada! Coordina la primera visita
                </p>
                <p style={{ color: '#166534', fontSize: '13px', margin: '0 0 8px', lineHeight: '1.5' }}>
                  Usa este chat para ponerte de acuerdo con <strong>{visitaPreVisita.compita.nombre}</strong> en la fecha y hora de la primera visita.
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
                visitaId={visitaPreVisita.id}
                compitaNombre={visitaPreVisita.compita.nombre}
                fechaActual={visitaPreVisita.fecha_programada ?? null}
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
          return (
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
                Próxima visita
              </h2>
              <div style={{ background: '#F5F0FF', border: '2px solid #7C4DFF', borderRadius: '16px', padding: '28px', marginBottom: '16px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '22px', color: '#2D1464', margin: '0 0 6px' }}>
                  🗓️ {fechaFormateada ? `Tu visita es el ${fechaFormateada}` : 'Visita próximamente'}
                </p>
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
              {compita && (
                <a href="/compitas" style={{ background: '#2D1464', color: 'white', borderRadius: '9999px', padding: '12px 24px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Agendar otra visita →
                </a>
              )}
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
            <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
              {compita.foto_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={compita.foto_url} alt={compita.nombre}
                  style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <h3 style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px', margin: 0 }}>
                    {compita.nombre}
                  </h3>
                  {compita.verificado && (
                    <span style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '9999px', padding: '2px 10px', fontSize: '12px', color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: '#FF6B2B' }}>✓</span> Verificado
                    </span>
                  )}
                  {usuario?.plan && (
                    <span style={{ background: '#F5F0E8', color: '#2D1464', borderRadius: '9999px', padding: '2px 10px', fontSize: '12px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>
                      Plan {usuario.plan}
                    </span>
                  )}
                </div>
                <p style={{ color: '#6B5C90', fontSize: '14px', margin: '0 0 10px' }}>{compita.zona}</p>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: '#4A3B6B', fontSize: '13px' }}>
                    {totalVisitas} {totalVisitas === 1 ? 'visita realizada' : 'visitas realizadas'}
                  </span>
                  <a href="/compitas" style={{ color: '#FF6B2B', fontSize: '13px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', textDecoration: 'none' }}>
                    Ver otros compitas →
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Entrevistas confirmadas */}
              {entrevistasConfirmadas.length > 0 && (
                <div style={{ background: 'white', border: '2px solid #22C55E', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
                  <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '15px', color: '#1A0A3C', margin: '0 0 14px' }}>
                    📅 Llamadas confirmadas
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {entrevistasConfirmadas.map((sol) => {
                      const c = sol.compitas
                      const fecha = sol.slot_confirmado
                        ? new Date(sol.slot_confirmado).toLocaleString('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: true })
                        : '—'
                      return (
                        <div key={sol.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', flexWrap: 'wrap' }}>
                          {c?.foto_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={c.foto_url} alt={c.nombre} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>👤</div>
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#1A0A3C', fontSize: '15px' }}>{c?.nombre ?? '—'}</div>
                            <div style={{ color: '#166534', fontSize: '13px', marginTop: '2px' }}>📅 {fecha}</div>
                            <div style={{ color: '#6B5C90', fontSize: '12px', marginTop: '2px' }}>⏱️ Llamada de 20 minutos</div>
                          </div>
                          {sol.room_url && (
                            <a href={sol.room_url} target="_blank" rel="noreferrer"
                              style={{ background: '#22C55E', color: 'white', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              Entrar →
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Solicitudes pendientes */}
              {solicitudesPendientes.length > 0 && (
                <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '15px', color: '#1A0A3C', margin: 0 }}>
                      ⏳ Esperando respuesta
                    </h3>
                    <span style={{ color: '#9B8AB8', fontSize: '13px' }}>{solicitudesPendientes.length}/3 solicitudes enviadas</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {solicitudesPendientes.map((sol) => {
                      const c = sol.compitas
                      return (
                        <div key={sol.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: '#FDFAF6', border: '1.5px solid #E8E0D4', borderRadius: '12px' }}>
                          {c?.foto_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={c.foto_url} alt={c.nombre} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>👤</div>
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#1A0A3C', fontSize: '15px' }}>{c?.nombre ?? '—'}</div>
                            {c?.zona && <div style={{ color: '#9B8AB8', fontSize: '12px', marginTop: '2px' }}>{c.zona}</div>}
                          </div>
                          <span style={{ background: '#FFF3E8', color: '#C84B0E', border: '1.5px solid #FF6B2B', borderRadius: '9999px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            ⏳ Pendiente
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p style={{ color: '#9B8AB8', fontSize: '12px', marginTop: '14px', marginBottom: 0 }}>
                    El compita elegirá el horario que le funcione y te llegará una confirmación por email.
                  </p>
                </div>
              )}

              {/* CTA todas rechazadas */}
              {todasRechazadas && (
                <div style={{ background: 'white', border: '2px solid #FF6B2B', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
                  <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '17px', color: '#1A0A3C', margin: '0 0 8px' }}>
                    Ningún compita pudo atenderte esta vez
                  </p>
                  <p style={{ color: '#6B5C90', fontSize: '14px', margin: '0 0 16px', lineHeight: '1.6' }}>
                    No te preocupes. Hay más compitas disponibles en tu zona. Intenta con otros perfiles que se adapten mejor a lo que necesitas.
                  </p>
                  <a href="/compitas" style={{ display: 'inline-block', background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '12px 24px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none' }}>
                    Ver otros compitas →
                  </a>
                </div>
              )}

              {/* CTA sin compita ni solicitudes */}
              {!todasRechazadas && solicitudesPendientes.length === 0 && entrevistasConfirmadas.length === 0 && (
                <div style={{ background: 'white', border: '2px solid #FF6B2B', borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '18px', color: '#1A0A3C', margin: '0 0 6px' }}>¿Aún no tienes compita?</h3>
                    <p style={{ color: '#6B5C90', fontSize: '14px', margin: 0 }}>Explora los perfiles disponibles y elige el que mejor se adapte a tu familiar.</p>
                  </div>
                  <a href="/compitas" style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '12px 24px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '15px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    Ver compitas →
                  </a>
                </div>
              )}

              {/* Historial de solicitudes (deemphasized) */}
              {solicitudesHistorial.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', color: '#9B8AB8', margin: '0 0 10px' }}>Solicitudes anteriores</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {solicitudesHistorial.map((sol) => {
                      const c = sol.compitas
                      const esCompletada = sol.estado === 'completada'
                      return (
                        <div key={sol.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'white', border: '1.5px solid #E8E0D4', borderRadius: '12px' }}>
                          {c?.foto_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={c.foto_url} alt={c.nombre} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, opacity: 0.6 }} />
                            : <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>👤</div>
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#9B8AB8', fontSize: '13px' }}>{c?.nombre ?? '—'}</div>
                          </div>
                          <span style={{
                            borderRadius: '9999px', padding: '3px 10px', fontSize: '11px', fontWeight: 700,
                            fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
                            background: esCompletada ? '#DCFCE7' : '#F1F0F5',
                            color: esCompletada ? '#166534' : '#9B8AB8',
                            border: esCompletada ? '1.5px solid #86EFAC' : '1.5px solid #D4CAE8',
                          }}>
                            {esCompletada ? '✅ Contratado' : '✗ No continuó'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ─────────────────────────────────────────────
            SECCIÓN 4: TU FAMILIAR
        ───────────────────────────────────────────── */}
        {usuario && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
              Tu familiar
            </h2>
            {!previewUid ? <PerfilFamiliar usuario={usuario} /> : <PerfilFamiliar usuario={usuario} readonly />}
          </section>
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

        {/* ─────────────────────────────────────────────
            SECCIÓN 6: AGENDAR OTRA VISITA
            Solo si tiene compita y no hay visita activa/en curso
        ───────────────────────────────────────────── */}
        {compita && !hayVisitaActivaOCercana && !visitaTerminoHoy && (visitasPasadas?.length ?? 0) > 0 && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '13px', color: '#9B8AB8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
              Próxima visita
            </h2>
            <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '17px', color: '#1A0A3C', margin: '0 0 4px' }}>
                  ¿Agendar otra visita?
                </p>
                <p style={{ color: '#6B5C90', fontSize: '14px', margin: 0 }}>
                  Con {compita.nombre} →
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <a href={`/compitas/${compita.id}`} style={{ background: '#2D1464', color: 'white', borderRadius: '9999px', padding: '12px 24px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Con {compita.nombre} →
                </a>
                <a href="/compitas" style={{ background: 'white', color: '#2D1464', border: '2px solid #2D1464', borderRadius: '9999px', padding: '12px 24px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Buscar otro compita
                </a>
              </div>
            </div>
          </section>
        )}

      </div>

      {/* Actualiza la página cuando cambia el estado de la visita */}
      {usuario && <VisitaWatcher usuarioId={targetUid} visitaActivaId={visitaActiva?.id ?? null} />}
    </div>
  )
}
