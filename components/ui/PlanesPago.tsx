'use client'

import InfoBoton from '@/components/ui/InfoBoton'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors } from '@/lib/design'
import { usePrecios, dolares } from '@/components/ui/usePrecios'
import { PLANES, PLANES_IDS, ETIQUETA_METODO, HORAS_MINIMAS_EXTRA, etiquetaHoras, VIGENCIA_CREDITOS_DIAS, TEXTO_REEMBOLSO, type PlanId } from '@/lib/planes'

type Pendiente = { id: string; tipo: string; plan: string | null; horas: number | null; monto_usd: number; metodo: 'zelle' | 'transferencia'; referencia: string; lineas: string[]; configurado: boolean }
const titulo = { fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800 } as const

/** Sección del dashboard: elegir y pagar un plan sin pasar antes por una compita. */
export default function PlanesPago({ pendiente }: { pendiente: Pendiente | null }) {
  const router = useRouter()
  const precios = usePrecios()
  const [plan, setPlan] = useState<PlanId | 'extra'>('quincenal')
  const [horas, setHoras] = useState(HORAS_MINIMAS_EXTRA)
  const [metodo, setMetodo] = useState<'zelle' | 'transferencia'>('zelle')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [avisado, setAvisado] = useState(false)
  // Si ya se avisó hace poco, el servidor dice por qué no se avisa otra vez y cuándo se podrá.
  const [espera, setEspera] = useState<{ resumen: string; porQue: string } | null>(null)

  async function enviar(url: string, body: object) {
    if (cargando) return
    setCargando(true); setError('')
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!d.ok) { setError(d.error ?? 'No se pudo completar'); return }
      if (url === '/api/pago/insistir') { setAvisado(true); setEspera(typeof d.data?.resumen === 'string' && typeof d.data?.porQue === 'string' ? { resumen: d.data.resumen, porQue: d.data.porQue } : null) }
      router.refresh()
    } catch { setError('Error de conexión. Intenta de nuevo.') } finally { setCargando(false) }
  }

  if (pendiente) {
    return (
      <div style={{ background: colors.amarilloClaro, border: `2px solid ${colors.amarillo}`, borderRadius: '16px', padding: '20px 24px' }}>
        <p style={{ ...titulo, fontSize: '17px', color: colors.moradoMedio, margin: '0 0 8px' }}>Completa tu pago de ${pendiente.monto_usd}</p>
        <p style={{ color: colors.textoMedio, fontSize: '14px', lineHeight: 1.6, margin: '0 0 8px' }}>
          Envía <strong>${pendiente.monto_usd}</strong> exactos por <strong>{ETIQUETA_METODO[pendiente.metodo]}</strong> y escribe esta referencia en la nota: <strong>{pendiente.referencia}</strong>.
        </p>
        {pendiente.configurado
          ? <div style={{ background: colors.blanco, borderRadius: '10px', padding: '10px 14px', fontSize: '14px', color: colors.textoOscuro, lineHeight: 1.6, margin: '0 0 8px', wordBreak: 'break-word' }}>{pendiente.lineas.map((l) => <div key={l}>{l}</div>)}</div>
          : <p style={{ color: colors.textoMedio, fontSize: '14px', margin: '0 0 8px' }}>Te enviaremos los datos para pagar a tu correo, o escríbenos a <strong>hola@micompaz.com</strong>.</p>}
        <p style={{ color: colors.textoSutil, fontSize: '13px', lineHeight: 1.5, margin: '0 0 12px' }}>Cuando recibamos el pago, tus visitas se activan y te avisamos por correo.</p>
        {error && <p style={{ color: colors.rojo, fontSize: '13px', margin: '0 0 8px' }}>{error}</p>}
        {avisado && (
          <div role="status" style={{ margin: '0 0 8px' }}>
            <p style={{ color: colors.verde, fontSize: '13px', fontWeight: 700, lineHeight: 1.5, margin: 0, display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}>
              <span>{espera?.resumen ?? 'Avisamos al equipo. Te escribimos por correo apenas lo confirmemos.'}</span>
              {espera && <InfoBoton que="Por qué no se avisa otra vez" texto={espera.porQue} />}
            </p>
            
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button onClick={() => enviar('/api/pago/insistir', {})} disabled={cargando} style={{ background: colors.naranja, border: 'none', color: colors.blanco, borderRadius: '9999px', padding: '10px 18px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', minHeight: '44px' }}>Ya envié el pago, avisar al equipo</button>
        <button onClick={() => enviar('/api/pago/cancelar', { id: pendiente.id })} disabled={cargando} style={{ background: 'none', border: `2px solid ${colors.gris400}`, color: colors.textoSutil, borderRadius: '9999px', padding: '8px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', minHeight: '44px' }}>Cancelar solicitud</button>
        </div>
      </div>
    )
  }

  const monto = precios ? (plan === 'extra' ? horas * precios.hora : precios.planes[plan]) : undefined
  const tarjeta = (activo: boolean) => ({ flex: '1 1 200px', textAlign: 'left', cursor: 'pointer', background: activo ? colors.blanco : colors.fondoCrudo, border: `2px solid ${activo ? colors.naranja : colors.fondoCard}`, borderRadius: '14px', padding: '14px 16px', fontFamily: 'Inter, sans-serif' } as const)

  return (
    <div style={{ background: colors.blanco, border: `2px solid ${colors.fondoCard}`, borderRadius: '16px', padding: '20px 24px' }}>
      <p style={{ ...titulo, fontSize: '17px', color: colors.moradoMedio, margin: '0 0 4px' }}>Planes y pago</p>
      <p style={{ color: colors.textoSutil, fontSize: '14px', margin: '0 0 14px', lineHeight: 1.5 }}>¿Ya sabes lo que quieres? Paga ahora y elige a tu compita cuando quieras. Las visitas duran {VIGENCIA_CREDITOS_DIAS} días.</p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {PLANES_IDS.map((id) => (
          <button key={id} onClick={() => setPlan(id)} style={tarjeta(plan === id)}>
            <div style={{ ...titulo, fontSize: '15px', color: colors.moradoMedio }}>{PLANES[id].nombre}</div>
            <div style={{ ...titulo, fontSize: '22px', color: colors.naranja }}>{dolares(precios?.planes[id])}</div>
            <div style={{ fontSize: '13px', color: colors.textoSutil }}>{PLANES[id].visitas} {PLANES[id].visitas === 1 ? 'visita' : 'visitas'}</div>
          </button>
        ))}
        <button onClick={() => setPlan('extra')} style={tarjeta(plan === 'extra')}>
          <div style={{ ...titulo, fontSize: '15px', color: colors.moradoMedio }}>Visita extra</div>
          <div style={{ ...titulo, fontSize: '22px', color: colors.naranja }}>{dolares(precios?.hora)}/h</div>
          <div style={{ fontSize: '13px', color: colors.textoSutil }}>Mínimo {etiquetaHoras(HORAS_MINIMAS_EXTRA)}</div>
        </button>
      </div>
      {plan === 'extra' && (
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: colors.textoSutil, marginBottom: '12px' }}>
          Horas
          <input type="number" min={HORAS_MINIMAS_EXTRA} max={12} value={horas} onChange={(e) => setHoras(Math.max(HORAS_MINIMAS_EXTRA, Math.min(12, Math.floor(Number(e.target.value)) || HORAS_MINIMAS_EXTRA)))} style={{ display: 'block', marginTop: '4px', width: '100px', border: `2px solid ${colors.gris200}`, borderRadius: '10px', padding: '8px 10px', fontSize: '16px' }} />
        </label>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        {(['zelle', 'transferencia'] as const).map((m) => (
          <button key={m} onClick={() => setMetodo(m)} style={{ background: metodo === m ? colors.moradoMedio : colors.blanco, color: metodo === m ? colors.blanco : colors.moradoMedio, border: `2px solid ${colors.moradoMedio}`, borderRadius: '9999px', padding: '8px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>{ETIQUETA_METODO[m]}</button>
        ))}
      </div>
      {error && <p style={{ color: colors.rojo, fontSize: '13px', margin: '0 0 8px' }}>{error}</p>}
      <button
        onClick={() => enviar('/api/pago/solicitar', plan === 'extra' ? { tipo: 'extra', horas, metodo } : { tipo: 'plan', plan, metodo })}
        disabled={cargando}
        style={{ background: cargando ? colors.fondoCard : colors.naranja, color: colors.blanco, border: 'none', borderRadius: '9999px', padding: '12px 24px', ...titulo, fontSize: '15px', cursor: cargando ? 'not-allowed' : 'pointer' }}
      >
        {cargando ? 'Un momento…' : `Pagar ${dolares(monto)} por ${ETIQUETA_METODO[metodo]}`}
      </button>
      <p style={{ color: colors.textoSutil, fontSize: '12px', margin: '12px 0 0', lineHeight: 1.5 }}>{TEXTO_REEMBOLSO}</p>
    </div>
  )
}
