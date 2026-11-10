'use client'

import { useEffect, useState } from 'react'
import { colors, fonts, spacing, radius } from '@/lib/design'

type Estado = { llego: false } | { llego: true; llegada_en: string; tiene_foto: boolean; nadie_abre: boolean; minutos_restantes: number | null; espera_min: number }

/** El compita llegó: foto de la llegada y, si nadie abre, la cuenta atrás con el botón "Ya abrí". */
export default function LlegadaVisita() {
  const [e, setE] = useState<Estado | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    try { const r = await fetch('/api/visita/llegada'); const d = await r.json(); if (d.ok) setE(d.data) } catch { /* sin datos no se muestra */ }
  }
  useEffect(() => { void cargar(); const t = setInterval(() => void cargar(), 30_000); return () => clearInterval(t) }, [])

  async function yaAbri() {
    setEnviando(true); setError('')
    try {
      const r = await fetch('/api/visita/llegada', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'ya_abro' }) })
      const d = await r.json()
      if (!d.ok) setError(d.error ?? 'No pudimos avisar.')
      await cargar()
    } catch { setError('Sin conexión. Intenta de nuevo.') } finally { setEnviando(false) }
  }

  if (!e || !e.llego) return null
  const hora = new Date(e.llegada_en).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s*([ap])\.?\s*m\.?/i, ' $1m')
  return (
    <section style={{ marginTop: spacing.md, background: e.nadie_abre ? colors.rojoClaro : colors.blanco, border: `${e.nadie_abre ? 2 : 1}px solid ${e.nadie_abre ? colors.rojo : colors.gris200}`, borderRadius: radius.lg, padding: spacing.md, fontFamily: fonts.body }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: '16px', color: e.nadie_abre ? colors.rojo : colors.textoOscuro }}>{e.nadie_abre ? 'Tu compita está en la puerta y nadie abre' : `Tu compita llegó a las ${hora}`}</div>
      {e.tiene_foto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/api/visita/llegada-foto" alt="Foto de la llegada del compita" style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: radius.md, marginTop: spacing.sm }} />
      )}
      {e.nadie_abre && (
        <>
          <p role="alert" style={{ color: colors.rojo, fontWeight: 700, fontSize: '16px', margin: `${spacing.sm} 0 ${spacing.xs}` }}>Quedan {e.minutos_restantes ?? e.espera_min} de {e.espera_min} minutos</p>
          <p style={{ color: colors.textoMedio, fontSize: '14px', lineHeight: 1.5, margin: `0 0 ${spacing.sm}` }}>Abre la puerta o avisa a quien deba hacerlo. Tú no necesitas darle tu teléfono a nadie: Compaz hace de puente. Si pasa el tiempo, la visita se cuenta como usada.</p>
          <button type="button" onClick={yaAbri} disabled={enviando} style={{ minHeight: '52px', width: '100%', borderRadius: radius.pill, border: 'none', background: colors.naranja, color: colors.blanco, fontWeight: 800, fontSize: '16px', cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>{enviando ? 'Avisando…' : 'Ya abrí'}</button>
          {error && <p role="alert" style={{ color: colors.rojo, fontWeight: 700, fontSize: '14px', margin: `${spacing.xs} 0 0` }}>{error}</p>}
        </>
      )}
    </section>
  )
}
