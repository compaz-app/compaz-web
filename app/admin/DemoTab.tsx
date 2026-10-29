'use client'

import { useState, useEffect, useCallback } from 'react'

type Compita = { id: string; nombre: string; zona: string; estado: string; verificado: boolean }
type Solicitud = { id: string; compita_id: string; cliente_id: string; estado: string; slot_confirmado: string | null; room_url: string | null; token_respuesta: string }
type Visita = { id: string; compita_id: string; usuario_id: string; estado: string; inicio: string | null }
type Cliente = { id: string; nombre: string; email: string }

type Stage =
  | 'loading'
  | 'sin_compita_demo'
  | 'esperando_solicitud'
  | 'entrevista_pendiente'
  | 'entrevista_en_curso'
  | 'crear_visita'
  | 'visita_programada'
  | 'visita_en_curso'
  | 'demo_completado'

type EstadoDemo = {
  stage: Stage
  compitasDemo: Compita[]
  solicitud: Solicitud | null
  visita: Visita | null
  cliente: Cliente | null
}

const PURPLE = '#2D1464'
const ORANGE = '#FF6B2B'
const LIGHT_BG = '#F5F0FF'
const BORDER = '#D4C9E8'
const TEXT = '#4A3B6B'
const MUTED = '#9B8AB8'

const btn = (disabled = false) => ({
  background: disabled ? '#E8E0D4' : ORANGE,
  color: disabled ? MUTED : 'white',
  border: 'none',
  borderRadius: '9999px',
  padding: '12px 28px',
  fontSize: '15px',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'Bricolage Grotesque, sans-serif',
} as const)

const secondaryBtn = () => ({
  background: LIGHT_BG,
  color: PURPLE,
  border: `2px solid ${BORDER}`,
  borderRadius: '9999px',
  padding: '10px 22px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
} as const)

function Box({ children, color = LIGHT_BG, borderColor = BORDER }: { children: React.ReactNode; color?: string; borderColor?: string }) {
  return (
    <div style={{ background: color, border: `1.5px solid ${borderColor}`, borderRadius: '16px', padding: '20px 24px', marginBottom: '16px' }}>
      {children}
    </div>
  )
}

function StepBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: active ? ORANGE : BORDER, color: active ? 'white' : MUTED, fontSize: '13px', fontWeight: 800, marginRight: '10px', flexShrink: 0 }}>
      {n}
    </span>
  )
}

export default function DemoTab() {
  const [estado, setEstado] = useState<EstadoDemo>({ stage: 'loading', compitasDemo: [], solicitud: null, visita: null, cliente: null })
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [salaAdmin, setSalaAdmin] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/demo/estado')
      const d = await r.json()
      if (d.data) setEstado(d.data)
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function accion(url: string, body: Record<string, string>, exito: string) {
    setCargando(true); setMsg(null)
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) { setMsg({ texto: d.error ?? 'Error desconocido', tipo: 'error' }); return null }
      setMsg({ texto: exito, tipo: 'ok' })
      await cargar()
      return d.data
    } catch {
      setMsg({ texto: 'Error de red', tipo: 'error' })
      return null
    } finally {
      setCargando(false)
    }
  }

  const { stage, compitasDemo, solicitud, visita, cliente } = estado
  const compitaDemo = compitasDemo[0] ?? null

  // ── helpers de etapas ──────────────────────────────────────────────────────

  const stepStyle = (active: boolean) => ({
    opacity: active ? 1 : 0.4,
    padding: '16px 0',
    borderBottom: `1px solid ${BORDER}`,
  } as const)

  const stages: Stage[] = [
    'esperando_solicitud', 'entrevista_pendiente', 'entrevista_en_curso',
    'crear_visita', 'visita_programada', 'visita_en_curso', 'demo_completado',
  ]
  const stageIdx = stages.indexOf(stage)

  if (stage === 'loading') {
    return <div style={{ padding: '40px', color: MUTED, fontFamily: 'Inter, sans-serif' }}>Cargando estado de demo…</div>
  }

  if (stage === 'sin_compita_demo') {
    return (
      <div style={{ padding: '32px', maxWidth: '600px' }}>
        <Box color='#FFF3E8' borderColor='#FF6B2B'>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, color: '#C84B0E', fontSize: '15px', marginBottom: '6px' }}>No hay compitas demo</div>
          <div style={{ fontFamily: 'Inter, sans-serif', color: TEXT, fontSize: '14px' }}>
            Registra al menos un perfil con la casilla "Perfil demo" activada en la pestaña Compitas antes de usar la demo.
          </div>
        </Box>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '640px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px', color: PURPLE }}>
          Panel de demo
        </div>
        <div style={{ color: MUTED, fontSize: '13px', marginTop: '4px' }}>
          Compita demo: <strong style={{ color: PURPLE }}>{compitaDemo?.nombre ?? '—'}</strong> · {compitaDemo?.zona}
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.tipo === 'ok' ? '#ECFDF5' : '#FEF2F2', border: `1.5px solid ${msg.tipo === 'ok' ? '#6EE7B7' : '#FECACA'}`, borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', color: msg.tipo === 'ok' ? '#065F46' : '#991B1B', fontSize: '14px' }}>
          {msg.tipo === 'ok' ? '✅ ' : '❌ '}{msg.texto}
        </div>
      )}

      {/* Etapa 1 — Invitar al inversionista */}
      <div style={stepStyle(stage === 'esperando_solicitud')}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <StepBadge n={1} active={stage === 'esperando_solicitud'} />
          <span style={{ fontWeight: 700, color: PURPLE, fontSize: '15px' }}>Invitar al inversionista</span>
        </div>
        {stage === 'esperando_solicitud' && (
          <>
            {cliente ? (
              <Box>
                <div style={{ fontSize: '14px', color: TEXT }}>
                  Invitación enviada a <strong>{cliente.nombre}</strong> ({cliente.email}).
                  Esperando que el inversionista envíe una solicitud de entrevista desde su portal.
                </div>
              </Box>
            ) : (
              <Box>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    placeholder="Nombre del inversionista"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    style={{ border: `1.5px solid ${BORDER}`, borderRadius: '10px', padding: '10px 14px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: PURPLE, outline: 'none' }}
                  />
                  <input
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ border: `1.5px solid ${BORDER}`, borderRadius: '10px', padding: '10px 14px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: PURPLE, outline: 'none' }}
                  />
                  <button
                    disabled={cargando || !nombre.trim() || !email.trim()}
                    style={btn(cargando || !nombre.trim() || !email.trim())}
                    onClick={async () => {
                      await accion('/api/admin/invitar-cliente', { nombre: nombre.trim(), email: email.trim().toLowerCase() }, `Invitación enviada a ${email}`)
                      setNombre(''); setEmail('')
                    }}
                  >
                    {cargando ? 'Enviando…' : 'Invitar al inversionista →'}
                  </button>
                </div>
              </Box>
            )}
          </>
        )}
      </div>

      {/* Etapa 2 — Aceptar entrevista */}
      <div style={stepStyle(stage === 'entrevista_pendiente')}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <StepBadge n={2} active={stageIdx >= 1} />
          <span style={{ fontWeight: 700, color: PURPLE, fontSize: '15px' }}>Aceptar entrevista</span>
        </div>
        {stage === 'entrevista_pendiente' && solicitud && (
          <Box>
            <div style={{ fontSize: '14px', color: TEXT, marginBottom: '12px' }}>
              Solicitud recibida de <strong>{cliente?.nombre ?? '…'}</strong>. Pulsa para aceptar y enviarle el link de sala al inversionista.
            </div>
            <button
              disabled={cargando}
              style={btn(cargando)}
              onClick={async () => {
                const d = await accion('/api/admin/demo/aceptar-entrevista', { solicitud_id: solicitud.id }, 'Entrevista aceptada — link enviado al inversionista')
                if (d?.sala_admin_url) setSalaAdmin(d.sala_admin_url)
              }}
            >
              {cargando ? 'Procesando…' : 'Aceptar entrevista →'}
            </button>
          </Box>
        )}
      </div>

      {/* Etapa 3 — Entrar y cerrar entrevista */}
      <div style={stepStyle(stage === 'entrevista_en_curso')}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <StepBadge n={3} active={stageIdx >= 2} />
          <span style={{ fontWeight: 700, color: PURPLE, fontSize: '15px' }}>Entrar y cerrar entrevista</span>
        </div>
        {stage === 'entrevista_en_curso' && solicitud && (
          <Box>
            {(salaAdmin ?? solicitud.room_url) && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', color: MUTED, marginBottom: '6px' }}>Tu sala (rol compita):</div>
                <a
                  href={salaAdmin ?? solicitud.room_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', background: PURPLE, color: 'white', padding: '10px 22px', borderRadius: '9999px', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}
                >
                  Entrar a la sala →
                </a>
              </div>
            )}
            <div style={{ fontSize: '13px', color: MUTED, marginBottom: '10px' }}>Cuando termines la llamada con el inversionista, pulsa para cerrar la entrevista.</div>
            <button
              disabled={cargando}
              style={btn(cargando)}
              onClick={() => accion('/api/admin/completar-solicitud', { id: solicitud.id }, 'Entrevista cerrada')}
            >
              {cargando ? 'Cerrando…' : 'Cerrar entrevista →'}
            </button>
          </Box>
        )}
      </div>

      {/* Etapa 4 — Crear visita */}
      <div style={stepStyle(stage === 'crear_visita')}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <StepBadge n={4} active={stageIdx >= 3} />
          <span style={{ fontWeight: 700, color: PURPLE, fontSize: '15px' }}>Crear visita</span>
        </div>
        {stage === 'crear_visita' && solicitud && (
          <Box>
            <div style={{ fontSize: '14px', color: TEXT, marginBottom: '12px' }}>
              La entrevista está completa. Pulsa para contratar la visita y que el inversionista la vea en su portal.
            </div>
            <button
              disabled={cargando}
              style={btn(cargando)}
              onClick={() => accion('/api/admin/demo/crear-visita', { solicitud_id: solicitud.id }, 'Visita creada — el inversionista la ve en su portal')}
            >
              {cargando ? 'Creando…' : 'Crear visita →'}
            </button>
          </Box>
        )}
      </div>

      {/* Etapa 5 — Iniciar visita */}
      <div style={stepStyle(stage === 'visita_programada')}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <StepBadge n={5} active={stageIdx >= 4} />
          <span style={{ fontWeight: 700, color: PURPLE, fontSize: '15px' }}>Iniciar visita</span>
        </div>
        {stage === 'visita_programada' && visita && (
          <Box>
            <div style={{ fontSize: '14px', color: TEXT, marginBottom: '12px' }}>
              La visita está programada. Al pulsar, el inversionista recibirá el correo de inicio y la verá activa en su portal.
            </div>
            <button
              disabled={cargando}
              style={btn(cargando)}
              onClick={() => accion('/api/admin/demo/iniciar-visita', { visita_id: visita.id }, 'Visita iniciada — correo de inicio enviado al inversionista')}
            >
              {cargando ? 'Iniciando…' : 'Iniciar visita →'}
            </button>
          </Box>
        )}
      </div>

      {/* Etapa 6 — Cerrar visita */}
      <div style={stepStyle(stage === 'visita_en_curso')}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <StepBadge n={6} active={stageIdx >= 5} />
          <span style={{ fontWeight: 700, color: PURPLE, fontSize: '15px' }}>Cerrar visita</span>
        </div>
        {stage === 'visita_en_curso' && visita && (
          <Box>
            <div style={{ fontSize: '14px', color: TEXT, marginBottom: '12px' }}>
              La visita está en curso. Al cerrarla el inversionista recibirá el resumen con calificación y opciones de "Agendar otra visita" y "Elegir otro compita".
            </div>
            <button
              disabled={cargando}
              style={btn(cargando)}
              onClick={() => accion('/api/admin/demo/cerrar-visita', { visita_id: visita.id }, 'Visita cerrada — resumen enviado al inversionista')}
            >
              {cargando ? 'Cerrando…' : 'Cerrar visita →'}
            </button>
          </Box>
        )}
      </div>

      {/* Etapa 7 — Demo completado */}
      {stage === 'demo_completado' && (
        <Box color='#ECFDF5' borderColor='#6EE7B7'>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '18px', color: '#065F46', marginBottom: '8px' }}>
            🎉 Demo completado
          </div>
          <div style={{ fontSize: '14px', color: '#065F46', marginBottom: '16px' }}>
            El inversionista ya recibió el resumen con la calificación y los botones de seguimiento.
          </div>
          <button
            style={secondaryBtn()}
            onClick={() => { setMsg(null); setSalaAdmin(null); cargar() }}
          >
            Actualizar estado
          </button>
        </Box>
      )}

      {/* Botón de refresco manual */}
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: `1px solid ${BORDER}` }}>
        <button style={secondaryBtn()} onClick={() => { setMsg(null); cargar() }}>
          🔄 Refrescar estado
        </button>
      </div>
    </div>
  )
}
