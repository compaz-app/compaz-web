'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { colors, fonts, spacing, radius } from '@/lib/design'

interface Hora { inicio: string; caracas: { dia: string; hora: string }; local: { dia: string; hora: string; zona: string } | null; otroDia: boolean; texto: string }

export default function HoraForm({ solicitudId, compitaNombre, reservadaInicial }: { solicitudId: string; compitaNombre: string; reservadaInicial: { inicio: string; venceEn: string } | null }) {
  const zonaNavegador = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return '' } })()
  const [horas, setHoras] = useState<Hora[] | null>(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState<string | null>(null)
  const [reservada, setReservada] = useState<{ texto: string; venceEn: string } | null>(null)

  async function cargar() {
    setError('')
    try {
      const r = await fetch(`/api/solicitudes/hora?solicitud=${solicitudId}`)
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) { setError(d.error ?? 'No pudimos cargar las horas.'); return }
      setHoras(d.data.horas)
    } catch { setError('Sin conexión. Intenta de nuevo.') }
  }
  useEffect(() => { void cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function elegir(h: Hora) {
    if (enviando) return
    setEnviando(h.inicio); setError('')
    try {
      const r = await fetch('/api/solicitudes/hora', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ solicitud_id: solicitudId, inicio: h.inicio, zona: zonaNavegador }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) { setError(d.error ?? 'No pudimos reservar esa hora.'); if (r.status === 409) void cargar(); return }
      setReservada({ texto: h.texto, venceEn: d.data.vence_en })
    } catch { setError('Sin conexión. Intenta de nuevo.') } finally { setEnviando(null) }
  }

  const envoltura = { minHeight: '100vh', background: colors.fondoCrudo, fontFamily: fonts.body, padding: `${spacing.lg} ${spacing.md}` } as const
  const caja = { maxWidth: '560px', margin: '0 auto' } as const
  const hasta = (iso: string) => new Date(iso).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s*([ap])\.?\s*m\.?/i, ' $1m')

  if (reservada || reservadaInicial) {
    const venceEn = reservada?.venceEn ?? reservadaInicial!.venceEn
    return (
      <main style={envoltura}>
        <div style={{ ...caja, background: colors.blanco, border: `2px solid ${colors.naranja}`, borderRadius: radius.lg, padding: spacing.lg, textAlign: 'center' }}>
          <div style={{ fontSize: '32px' }}>⏳</div>
          <h1 style={{ fontFamily: fonts.display, fontSize: '24px', color: colors.textoOscuro, margin: '4px 0 8px' }}>Hora reservada</h1>
          <p style={{ color: colors.textoMedio, fontSize: '17px', lineHeight: 1.6, margin: 0 }}>{compitaNombre} recibe tu hora por Telegram y la confirma. Si no la confirma antes de las {hasta(venceEn)} (hora de Caracas), se libera y te avisamos para que elijas otra.</p>
          <p style={{ color: colors.textoSutil, fontSize: '15px', margin: `${spacing.sm} 0 ${spacing.md}` }}>No tienes que quedarte esperando: te escribimos por correo apenas responda.</p>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '52px', borderRadius: radius.md, background: colors.naranja, color: colors.blanco, fontWeight: 800, fontSize: '17px', textDecoration: 'none' }}>Ir a mi portal</Link>
        </div>
      </main>
    )
  }

  // Agrupar por día de Caracas
  const porDia = new Map<string, Hora[]>()
  for (const h of horas ?? []) { const k = h.caracas.dia; porDia.set(k, [...(porDia.get(k) ?? []), h]) }

  return (
    <main style={envoltura}>
      <div style={caja}>
        <Link href="/dashboard" style={{ color: colors.textoMedio, fontSize: '15px', fontWeight: 700, textDecoration: 'none' }}>‹ Volver a mi portal</Link>
        <h1 style={{ fontFamily: fonts.display, fontSize: '26px', color: colors.textoOscuro, margin: `${spacing.sm} 0` }}>Elige la hora con {compitaNombre}</h1>
        <p style={{ color: colors.textoMedio, fontSize: '16px', lineHeight: 1.5, margin: `0 0 ${spacing.md}` }}>Videollamada de 20 minutos. Verás cada hora en tu zona y en la de Caracas. La hora que elijas queda reservada hasta que {compitaNombre} la confirme.</p>
        {error && <p role="alert" style={{ color: colors.rojo, fontWeight: 700, fontSize: '15px', margin: `0 0 ${spacing.sm}` }}>{error}</p>}
        {horas === null && !error && <p style={{ color: colors.textoSutil }}>Cargando horas…</p>}
        {horas !== null && horas.length === 0 && (
          <div style={{ background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.lg, padding: spacing.lg, color: colors.textoMedio, fontSize: '16px', lineHeight: 1.6 }}>
            {compitaNombre} no tiene horas libres en los próximos días. Escríbenos a hola@micompaz.com y te ayudamos a coordinar.
          </div>
        )}
        <div style={{ display: 'grid', gap: spacing.md }}>
          {[...porDia.entries()].map(([dia, lista]) => (
            <section key={dia} style={{ background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.lg, padding: spacing.md }}>
              <h2 style={{ fontFamily: fonts.display, fontSize: '17px', color: colors.textoOscuro, margin: `0 0 ${spacing.xs}`, textTransform: 'capitalize' }}>{dia}</h2>
              <div style={{ display: 'grid', gap: spacing.xs }}>
                {lista.map((h) => (
                  <button key={h.inicio} type="button" disabled={!!enviando} onClick={() => elegir(h)} style={{ textAlign: 'left', minHeight: '56px', padding: `${spacing.sm} ${spacing.md}`, borderRadius: radius.md, border: `2px solid ${colors.gris200}`, background: colors.blanco, cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando && enviando !== h.inicio ? 0.5 : 1, fontFamily: fonts.body }}>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: colors.textoOscuro }}>{h.local ? h.local.hora : h.caracas.hora}{h.local && h.otroDia ? ` (${h.local.dia})` : ''}</div>
                    <div style={{ fontSize: '14px', color: colors.textoMedio }}>{enviando === h.inicio ? 'Reservando…' : h.local ? `tu hora · ${h.caracas.hora} hora de Caracas` : 'hora de Caracas'}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
