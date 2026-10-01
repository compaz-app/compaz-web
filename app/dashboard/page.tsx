import { redirect } from 'next/navigation'
import { requireAuth, getUsuario, isAdminEmail } from '@/lib/auth'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import Chat from '@/components/ui/Chat'
import VideoCall from '@/components/ui/VideoCall'
import VisitaWatcher from '@/components/ui/VisitaWatcher'
import LogoutButton from '@/components/ui/LogoutButton'
import type { Visita, Compita, Mensaje, Usuario } from '@/types'

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
    .select('*, compita:compitas(id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, created_at)')
    .eq('id', targetUid)
    .single() as { data: Usuario | null }

  if (!usuario && !previewUid) redirect('/login')

  // Visita activa
  const { data: visitaActiva } = await db
    .from('visitas')
    .select('*, compita:compitas(id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, created_at)')
    .eq('usuario_id', targetUid)
    .eq('estado', 'en_curso')
    .maybeSingle() as { data: (Visita & { compita: Compita }) | null }

  // Mensajes de la visita activa
  let mensajes: Mensaje[] = []
  if (visitaActiva) {
    const { data } = await db
      .from('mensajes')
      .select('*')
      .eq('visit_id', visitaActiva.id)
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
  const solicitudes = (solicitudesRaw ?? []) as SolicitudRow[]
  const solicitudesPendientes = solicitudes.filter((s) => s.estado === 'pendiente')
  const entrevistasConfirmadas = solicitudes.filter((s) => s.estado === 'aceptada' && s.slot_confirmado)
  const solicitudesHistorial = solicitudes.filter((s) => s.estado === 'rechazada' || s.estado === 'completada')

  // Visitas pasadas
  const { data: visitasPasadas } = await db
    .from('visitas')
    .select('*, compita:compitas(nombre)')
    .eq('usuario_id', targetUid)
    .eq('estado', 'terminada')
    .order('created_at', { ascending: false })
    .limit(10)

  const totalVisitas = (visitasPasadas?.length ?? 0) + (visitaActiva ? 1 : 0)
  const compita = usuario?.compita ?? null

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

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Saludo */}
        {!previewUid && usuario?.nombre && (
          <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '24px', color: '#1A0A3C', margin: '0 0 24px' }}>
            Hola, {usuario.nombre.split(' ')[0]} 👋
          </h1>
        )}

        {/* Compita asignado */}
        {compita && (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', marginBottom: '24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
            {compita.foto_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={compita.foto_url}
                alt={compita.nombre}
                style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h2 style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px', margin: 0 }}>
                  {compita.nombre}
                </h2>
                {compita.verificado && (
                  <span style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '9999px', padding: '2px 10px', fontSize: '12px', color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#FF6B2B' }}>✓</span> Verificado
                  </span>
                )}
              </div>
              <p style={{ color: '#6B5C90', fontSize: '14px', margin: '0 0 8px' }}>{compita.zona}</p>
              <p style={{ color: '#4A3B6B', fontSize: '14px', margin: '0 0 8px' }}>
                Tu familiar ha recibido <strong>{totalVisitas}</strong> {totalVisitas === 1 ? 'visita' : 'visitas'} con Compaz
              </p>
              <a href="/compitas" style={{ color: '#FF6B2B', fontSize: '13px', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', textDecoration: 'none' }}>
                Ver otros compitas →
              </a>
            </div>
            {usuario?.plan && (
              <div style={{ background: '#F5F0E8', borderRadius: '12px', padding: '10px 16px', textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: '11px', color: '#6B5C90', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Plan</div>
                <div style={{ color: '#2D1464', fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif' }}>{usuario.plan}</div>
              </div>
            )}
          </div>
        )}

        {/* Acceso al marketplace si no tiene compita asignada */}
        {!compita && (
          <div style={{ background: 'white', border: '2px solid #FF6B2B', borderRadius: '16px', padding: '24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '18px', color: '#1A0A3C', margin: '0 0 6px' }}>¿Aún no tienes compita?</h3>
              <p style={{ color: '#6B5C90', fontSize: '14px', margin: 0 }}>Explora los perfiles disponibles y elige el que mejor se adapte a tu familiar.</p>
            </div>
            <a href="/compitas" style={{ background: '#FF6B2B', color: 'white', borderRadius: '9999px', padding: '12px 24px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '15px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Ver compitas →
            </a>
          </div>
        )}

        {/* Entrevistas confirmadas */}
        {entrevistasConfirmadas.length > 0 && (
          <div style={{ background: 'white', border: '2px solid #22C55E', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', color: '#1A0A3C', margin: '0 0 16px' }}>
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

        {/* Solicitudes pendientes de respuesta */}
        {solicitudesPendientes.length > 0 && (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', color: '#1A0A3C', margin: 0 }}>
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

        {/* Historial de solicitudes */}
        {solicitudesHistorial.length > 0 && (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', color: '#1A0A3C', margin: '0 0 16px' }}>
              Historial de solicitudes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {solicitudesHistorial.map((sol) => {
                const c = sol.compitas
                const esCompletada = sol.estado === 'completada'
                return (
                  <div key={sol.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: '#FDFAF6', border: '1.5px solid #E8E0D4', borderRadius: '12px' }}>
                    {c?.foto_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.foto_url} alt={c.nombre} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, opacity: 0.7 }} />
                      : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>👤</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#4A3B6B', fontSize: '14px' }}>{c?.nombre ?? '—'}</div>
                    </div>
                    <span style={{
                      borderRadius: '9999px', padding: '4px 12px', fontSize: '12px', fontWeight: 700,
                      fontFamily: 'Bricolage Grotesque, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
                      background: esCompletada ? '#DCFCE7' : '#F1F0F5',
                      color: esCompletada ? '#166534' : '#6B5C90',
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

        {/* Videollamada + chat */}
        {visitaActiva ? (
          <>
            {/* En modo preview no mostrar botones de llamada para no iniciar una real */}
            {!previewUid && (
              <VideoCall
                visitaId={visitaActiva.id}
                compitaNombre={visitaActiva.compita.nombre}
                roomUrlInicial={visitaActiva.room_url ?? null}
              />
            )}
            {previewUid && visitaActiva.room_url && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <a
                  href={visitaActiva.room_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ background: '#2D1464', color: 'white', borderRadius: '9999px', padding: '10px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}
                >
                  📹 Unirse a la llamada activa
                </a>
              </div>
            )}
            <div style={{ background: 'white', border: '2px solid #22c55e', borderRadius: '16px', overflow: 'hidden', height: '500px', display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
              <Chat visita={visitaActiva} mensajesIniciales={mensajes} compitaNombre={visitaActiva.compita.nombre} />
            </div>
          </>
        ) : (
          <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '16px', padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
            {(() => {
              const ultimaVisita = visitasPasadas?.[0]
              const fueHoy = ultimaVisita
                ? new Date(ultimaVisita.created_at).toDateString() === new Date().toDateString()
                : false
              if (fueHoy) {
                return (
                  <>
                    <p style={{ color: '#22c55e', fontSize: '20px', fontWeight: 800, fontFamily: 'Bricolage Grotesque, sans-serif', margin: '0 0 8px' }}>
                      La visita de hoy terminó
                    </p>
                    <p style={{ color: '#4A3B6B', fontSize: '15px', margin: '0 0 6px' }}>
                      Gracias a <strong>{compita?.nombre ?? 'tu compita'}</strong> por acompañar a tu familiar.
                    </p>
                    <p style={{ color: '#6B5C90', fontSize: '14px', margin: 0 }}>
                      El resumen completo llegará a tu correo en breve.
                    </p>
                  </>
                )
              }
              return (
                <>
                  <p style={{ color: '#6B5C90', fontSize: '16px', margin: '0 0 8px' }}>No hay visita activa en este momento.</p>
                  <p style={{ color: '#4A3B6B', fontSize: '14px', margin: 0 }}>
                    Cuando {compita?.nombre ?? 'tu compita'} inicie una visita, aparecerá aquí en tiempo real.
                  </p>
                </>
              )
            })()}
          </div>
        )}

        {/* Historial */}
        {visitasPasadas && visitasPasadas.length > 0 && (
          <div>
            <h3 style={{ color: '#2D1464', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, marginBottom: '16px' }}>
              Visitas anteriores
            </h3>
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

      {/* Actualiza la página cuando cambia el estado de la visita */}
      {usuario && <VisitaWatcher usuarioId={targetUid} visitaActivaId={visitaActiva?.id ?? null} />}
    </div>
  )
}
