'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors } from '@/lib/design'
import { PLANES, PLANES_IDS, METODOS_PAGO, ETIQUETA_METODO, PRECIO_HORA_EXTRA_USD, HORAS_MINIMAS_EXTRA, type PlanId, type MetodoPago } from '@/lib/planes'

type Pago = {
  id: string; tipo: 'plan' | 'extra'; plan: string | null; visitas: number; horas: number | null; monto_usd: number
  metodo: MetodoPago; referencia: string | null; estado: 'activo' | 'anulado'; inicio: string; vence: string
}
type Cupo = { planNombre: string; limite: number; usadas: number; restantes: number; vence: string | null; renueva: string | null } | null

const campo = { border: `2px solid ${colors.gris200}`, borderRadius: '10px', padding: '8px 10px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: colors.textoOscuro, background: colors.blanco, minWidth: 0 } as const
const etiqueta = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700, color: colors.textoSutil, fontFamily: 'Bricolage Grotesque, sans-serif', flex: '1 1 140px' } as const
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })

/** Panel de pagos de un cliente: cupo actual, historial y formulario para registrar Zelle, transferencia, etc. */
export default function RegistrarPago({ usuarioId, nombre }: { usuarioId: string; nombre: string }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [pagos, setPagos] = useState<Pago[]>([])
  const [cupo, setCupo] = useState<Cupo>(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [tipo, setTipo] = useState<'plan' | 'extra'>('plan')
  const [plan, setPlan] = useState<PlanId>('quincenal')
  const [horas, setHoras] = useState(HORAS_MINIMAS_EXTRA)
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('zelle')
  const [referencia, setReferencia] = useState('')

  const sugerido = tipo === 'plan' ? PLANES[plan].precioUsd : horas * PRECIO_HORA_EXTRA_USD

  async function cargar() {
    setCargando(true)
    try {
      const r = await fetch(`/api/admin/pagos?usuario_id=${usuarioId}`)
      const d = await r.json()
      if (d.ok) { setPagos(d.data.pagos); setCupo(d.data.cupo) }
    } finally { setCargando(false) }
  }
  useEffect(() => { if (abierto) cargar() }, [abierto]) // eslint-disable-line react-hooks/exhaustive-deps

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    if (guardando) return
    setGuardando(true); setError(''); setAviso('')
    try {
      const r = await fetch('/api/admin/registrar-pago', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuarioId, tipo, plan: tipo === 'plan' ? plan : undefined, horas: tipo === 'extra' ? horas : undefined,
          monto_usd: monto.trim() === '' ? undefined : Number(monto), metodo, referencia: referencia.trim() || undefined,
        }),
      })
      const d = await r.json()
      if (!d.ok) { setError(d.error ?? 'No se pudo registrar el pago'); return }
      setAviso(d.data.correo_enviado ? 'Pago registrado y cliente avisado por correo.' : 'Pago registrado. No se pudo enviar el correo al cliente.')
      setMonto(''); setReferencia('')
      await cargar(); router.refresh()
    } catch { setError('Error de conexión') } finally { setGuardando(false) }
  }

  async function anular(p: Pago) {
    const motivo = window.prompt(`¿Por qué anulas este pago de $${p.monto_usd}? (opcional)`)
    if (motivo === null) return
    const r = await fetch('/api/admin/anular-pago', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pago_id: p.id, motivo }) })
    const d = await r.json()
    if (!d.ok) { setError(d.error ?? 'No se pudo anular'); return }
    await cargar(); router.refresh()
  }

  return (
    <div style={{ width: '100%' }}>
      <button
        onClick={() => setAbierto((a) => !a)}
        style={{ background: abierto ? colors.moradoMedio : colors.blanco, color: abierto ? colors.blanco : colors.moradoMedio, border: `2px solid ${colors.moradoMedio}`, borderRadius: '9999px', padding: '8px 14px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        💳 Pagos y plan
      </button>

      {abierto && (
        <div style={{ marginTop: '14px', background: colors.fondoClaro, border: `1.5px solid ${colors.fondoCard}`, borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ color: colors.textoOscuro, fontSize: '14px', lineHeight: 1.5 }}>
            {cargando ? 'Cargando…' : cupo
              ? <>
                  <strong>{cupo.planNombre}</strong>: {cupo.restantes} {cupo.restantes === 1 ? 'visita disponible' : 'visitas disponibles'} de {cupo.limite}
                  {cupo.vence && cupo.restantes > 0 ? <> · usar antes del <strong>{fecha(cupo.vence)}</strong></> : null}
                  {cupo.renueva ? <> · próximo pago: <strong>{fecha(cupo.renueva)}</strong></> : null}
                </>
              : <>Sin plan registrado: <strong>{nombre}</strong> no tiene límite de visitas.</>}
          </div>

          <form onSubmit={registrar} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
            <label style={etiqueta}>Tipo
              <select value={tipo} onChange={(e) => setTipo(e.target.value as 'plan' | 'extra')} style={campo}>
                <option value="plan">Plan mensual</option>
                <option value="extra">Visita extra</option>
              </select>
            </label>
            {tipo === 'plan' ? (
              <label style={etiqueta}>Plan
                <select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)} style={campo}>
                  {PLANES_IDS.map((id) => <option key={id} value={id}>{PLANES[id].nombre} · {PLANES[id].visitas} {PLANES[id].visitas === 1 ? 'visita' : 'visitas'} · ${PLANES[id].precioUsd}</option>)}
                </select>
              </label>
            ) : (
              <label style={etiqueta}>Horas (mín. {HORAS_MINIMAS_EXTRA}, ${PRECIO_HORA_EXTRA_USD}/h)
                <input type="number" min={HORAS_MINIMAS_EXTRA} max={12} value={horas} onChange={(e) => setHoras(Number(e.target.value))} style={campo} />
              </label>
            )}
            <label style={etiqueta}>Método
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)} style={campo}>
                {METODOS_PAGO.map((m) => <option key={m} value={m}>{ETIQUETA_METODO[m]}</option>)}
              </select>
            </label>
            <label style={etiqueta}>Monto (USD)
              <input type="number" min={0} step="0.01" value={monto} placeholder={String(sugerido)} onChange={(e) => setMonto(e.target.value)} style={campo} />
            </label>
            <label style={{ ...etiqueta, flex: '2 1 200px' }}>Referencia (opcional)
              <input value={referencia} maxLength={200} placeholder="Ej. confirmación de Zelle" onChange={(e) => setReferencia(e.target.value)} style={campo} />
            </label>
            <button type="submit" disabled={guardando}
              style={{ background: colors.naranja, color: colors.blanco, border: 'none', borderRadius: '9999px', padding: '11px 20px', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: '14px', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.6 : 1, flex: '1 1 160px' }}>
              {guardando ? 'Registrando…' : 'Registrar pago'}
            </button>
          </form>
          {error && <div style={{ color: colors.rojo, fontSize: '13px' }}>{error}</div>}
          {aviso && <div style={{ color: colors.verde, fontSize: '13px' }}>{aviso}</div>}

          {pagos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '12px', color: colors.textoSutil, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Historial de pagos</div>
              {pagos.map((p) => (
                <div key={p.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: colors.blanco, border: `1px solid ${colors.fondoCard}`, borderRadius: '10px', padding: '8px 12px', opacity: p.estado === 'anulado' ? 0.5 : 1 }}>
                  <div style={{ fontSize: '13px', color: colors.textoOscuro, textDecoration: p.estado === 'anulado' ? 'line-through' : 'none' }}>
                    <strong>{p.tipo === 'plan' ? PLANES[p.plan as PlanId]?.nombre ?? p.plan : `Visita extra ${p.horas} h`}</strong> · ${p.monto_usd} · {ETIQUETA_METODO[p.metodo]}
                    <span style={{ color: colors.textoSutil }}> · {fecha(p.inicio)} → vence {fecha(p.vence)}{p.referencia ? ` · ${p.referencia}` : ''}</span>
                  </div>
                  {p.estado === 'activo'
                    ? <button onClick={() => anular(p)} style={{ background: 'none', border: `1.5px solid ${colors.rojo}`, color: colors.rojo, borderRadius: '9999px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Anular</button>
                    : <span style={{ fontSize: '12px', color: colors.textoSutil }}>Anulado</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
