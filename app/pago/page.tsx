'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// ── Planes ────────────────────────────────────────────────────────────────────
const PLANES = [
  {
    id: 'carta',
    nombre: 'A la carta',
    badge: null,
    precio: 45,
    unidad: 'por visita',
    descripcion: 'Una visita de 2 horas cuando lo necesites. Sin compromiso.',
    detalles: ['Agenda cuando quieras', '2 horas por visita', 'Sin contrato fijo'],
    precioBase: null,
    ahorro: null,
    stripe_price_id: null, // TODO: 'price_xxxx'
  },
  {
    id: 'quincenal',
    nombre: 'Compañía',
    badge: null,
    precio: 75,
    unidad: 'por mes',
    descripcion: '2 visitas al mes con una rutina estable para tu familiar.',
    detalles: ['2 visitas al mes', '2 horas cada visita', 'Agenda fija quincenal'],
    precioBase: 90,
    ahorro: 15,
    stripe_price_id: null, // TODO: 'price_xxxx'
  },
  {
    id: 'semanal',
    nombre: 'Compañía Plus',
    badge: 'RECOMENDADO',
    precio: 140,
    unidad: 'por mes',
    descripcion: 'Una visita por semana. Presencia constante, vínculo real con tu familiar.',
    detalles: ['4 visitas al mes', '2 horas cada visita', 'Agenda fija semanal'],
    precioBase: 180,
    ahorro: 40,
    stripe_price_id: null, // TODO: 'price_xxxx'
  },
]

type PlanId = 'carta' | 'quincenal' | 'semanal'

type SolicitudInfo = {
  compitaNombre: string
  compitaFoto: string | null
  clienteNombre: string
}

function PagoContent() {
  const searchParams = useSearchParams()
  const solicitudId = searchParams.get('solicitud')

  const [info, setInfo] = useState<SolicitudInfo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [planElegido, setPlanElegido] = useState<PlanId | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!solicitudId) { setCargando(false); return }
    fetch(`/api/pago/info?solicitud=${solicitudId}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setInfo(d.data) })
      .finally(() => setCargando(false))
  }, [solicitudId])

  async function pagar() {
    if (!planElegido || !solicitudId) return
    const plan = PLANES.find(p => p.id === planElegido)!

    // Cuando Stripe esté activo: crear checkout session y redirigir
    // if (plan.stripe_price_id) {
    //   const res = await fetch('/api/pago/stripe-session', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ solicitud_id: solicitudId, plan: planElegido }),
    //   })
    //   const { url } = await res.json()
    //   window.location.href = url
    //   return
    // }

    // Placeholder: simular pago
    setProcesando(true)
    setError('')
    const res = await fetch('/api/pago/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitud_id: solicitudId, plan: planElegido }),
    })
    const data = await res.json()
    if (!data.ok) {
      setError(data.error ?? 'Ocurrió un error. Intenta de nuevo.')
      setProcesando(false)
    } else {
      window.location.href = '/dashboard?contratado=1'
    }
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6B5C90', fontFamily: 'Inter, sans-serif' }}>Cargando…</p>
      </div>
    )
  }

  if (!solicitudId || !info) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'white', border: '2px solid #E8E0D4', borderRadius: '24px', padding: '40px 32px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <h2 style={{ color: '#1A0A3C', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800 }}>Enlace inválido</h2>
          <p style={{ color: '#6B5C90', fontFamily: 'Inter, sans-serif' }}>Este enlace no es válido o ya fue utilizado.</p>
        </div>
      </div>
    )
  }

  const primerNombre = info.clienteNombre.split(' ')[0]

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF6', fontFamily: 'Inter, sans-serif' }}>
      {/* Nav */}
      <nav style={{ background: '#2D1464', padding: '16px 24px' }}>
        <span style={{ color: 'white', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '20px' }}>Compaz</span>
      </nav>

      <div style={{ maxWidth: '580px', margin: '0 auto', padding: '40px 16px 80px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          {info.compitaFoto
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={info.compitaFoto} alt={info.compitaNombre} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '16px', border: '3px solid #FF6B2B' }} />
            : <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', margin: '0 auto 16px' }}>👤</div>
          }
          <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '24px', color: '#1A0A3C', margin: '0 0 8px' }}>
            ¡Excelente elección, {primerNombre}!
          </h1>
          <p style={{ color: '#6B5C90', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
            Elige cómo quieres que sea la relación con <strong style={{ color: '#1A0A3C' }}>{info.compitaNombre}</strong>.
          </p>
        </div>

        {/* Aviso placeholder */}
        <div style={{ background: '#FFF3E8', border: '2px solid #FF6B2B', borderRadius: '12px', padding: '12px 16px', marginBottom: '28px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>🔧</span>
          <p style={{ color: '#C84B0E', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
            <strong>Pago en configuración.</strong> Por ahora el proceso es manual — nuestro equipo te contactará para coordinar. Stripe estará activo muy pronto.
          </p>
        </div>

        {/* Planes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
          {PLANES.map(plan => {
            const elegido = planElegido === plan.id
            return (
              <button
                key={plan.id}
                onClick={() => setPlanElegido(plan.id as PlanId)}
                style={{
                  background: elegido ? '#F5F0FF' : 'white',
                  border: `2px solid ${elegido ? '#7C4DFF' : '#E8E0D4'}`,
                  borderRadius: '18px',
                  padding: '20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Badge */}
                {plan.badge && (
                  <div style={{
                    position: 'absolute', top: '-1px', right: '20px',
                    background: plan.badge === 'RECOMENDADO' ? '#FF6B2B' : '#22C55E',
                    color: 'white', fontSize: '10px', fontWeight: 800,
                    fontFamily: 'Bricolage Grotesque, sans-serif',
                    padding: '3px 10px', borderRadius: '0 0 8px 8px',
                  }}>
                    {plan.badge}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    {/* Nombre + radio */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${elegido ? '#7C4DFF' : '#D4C9E8'}`,
                        background: elegido ? '#7C4DFF' : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {elegido && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'white' }} />}
                      </div>
                      <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '16px', color: '#1A0A3C' }}>
                        {plan.nombre}
                      </span>
                    </div>

                    <p style={{ color: '#6B5C90', fontSize: '13px', lineHeight: 1.5, margin: '0 0 10px' }}>
                      {plan.descripcion}
                    </p>

                    {/* Detalles */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {plan.detalles.map(d => (
                        <span key={d} style={{ fontSize: '12px', color: '#4A3B6B' }}>✓ {d}</span>
                      ))}
                    </div>
                  </div>

                  {/* Precio */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '24px', color: '#2D1464', lineHeight: 1 }}>
                      ${plan.precio}
                    </div>
                    <div style={{ color: '#9B8AB8', fontSize: '12px', marginTop: '2px' }}>{plan.unidad}</div>
                    {plan.precioBase && plan.ahorro && (
                      <div style={{ marginTop: '6px' }}>
                        <span style={{ textDecoration: 'line-through', color: '#BDBDBD', fontSize: '12px' }}>${plan.precioBase}</span>
                        <span style={{ background: '#DCFCE7', color: '#166534', fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', marginLeft: '6px' }}>
                          −${plan.ahorro}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Garantía */}
        <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
          <p style={{ color: '#166534', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
            🛡️ <strong>Garantía Compaz:</strong> Todas las visitas están monitoreadas por nuestro equipo. Si algo no va bien, te ayudamos a resolverlo.
          </p>
        </div>

        {/* Aviso plataforma */}
        <div style={{ background: '#FFF3E8', border: '1.5px solid #FF6B2B', borderRadius: '12px', padding: '14px 16px', marginBottom: '28px' }}>
          <p style={{ color: '#C84B0E', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
            <strong>Importante:</strong> Para que Compaz pueda garantizarte el servicio, mantén toda la comunicación con tu compita dentro de la plataforma. Si coordinan por fuera, Compaz no podrá responder por lo que suceda ni ofrecer cobertura o garantía.
          </p>
        </div>

        {error && (
          <p style={{ color: '#E05520', fontSize: '14px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>
        )}

        {/* Botón */}
        <button
          onClick={pagar}
          disabled={!planElegido || procesando}
          style={{
            width: '100%',
            background: !planElegido || procesando ? '#E8E0D4' : '#FF6B2B',
            color: !planElegido || procesando ? '#9B8AB8' : 'white',
            border: 'none',
            borderRadius: '9999px',
            padding: '18px',
            fontFamily: 'Bricolage Grotesque, sans-serif',
            fontWeight: 800,
            fontSize: '17px',
            cursor: !planElegido || procesando ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {procesando
            ? 'Procesando…'
            : planElegido
              ? `Contratar — $${PLANES.find(p => p.id === planElegido)!.precio} ${PLANES.find(p => p.id === planElegido)!.unidad} →`
              : 'Elige un plan para continuar'}
        </button>

        <p style={{ color: '#9B8AB8', fontSize: '12px', textAlign: 'center', marginTop: '16px', lineHeight: 1.5 }}>
          Al continuar aceptas los <a href="/terminos" style={{ color: '#9B8AB8' }}>términos del servicio</a> de Compaz.
        </p>
      </div>
    </div>
  )
}

export default function PagoPage() {
  return (
    <Suspense>
      <PagoContent />
    </Suspense>
  )
}
