'use client'

import { useEffect, useState } from 'react'
import { colors, fonts, spacing, radius } from '@/lib/design'

interface Datos { direccion: string; indicaciones: string | null; quien_abre: string | null; contacto_nombre: string; contacto_tel: string }
interface Estado { registrada: boolean; actual: Datos | null; anterior: Datos | null; programada: boolean }

const campo = { width: '100%', boxSizing: 'border-box' as const, minHeight: '48px', border: `1px solid ${colors.gris200}`, borderRadius: radius.md, padding: `0 ${spacing.sm}`, fontSize: '16px', fontFamily: fonts.body, color: colors.textoOscuro, background: colors.blanco }
const etiqueta = { display: 'block', fontSize: '14px', fontWeight: 700, color: colors.textoOscuro, marginTop: spacing.sm } as const

/** Dónde será la próxima visita. Se pide por cita; el compita recibe la dirección exacta unas horas antes, por Telegram. */
export default function DireccionVisita() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [f, setF] = useState<Datos>({ direccion: '', indicaciones: '', quien_abre: '', contacto_nombre: '', contacto_tel: '' } as unknown as Datos)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState<{ entregada: boolean } | null>(null)
  const set = (k: keyof Datos, v: string) => setF((x) => ({ ...x, [k]: v }))

  async function cargar() {
    try { const r = await fetch('/api/visita/direccion'); const d = await r.json(); if (d.ok) setEstado(d.data) } catch { /* sin datos no se muestra */ }
  }
  useEffect(() => { void cargar() }, [])
  if (!estado) return null

  function abrir() {
    setError(''); setListo(null); setEditando(true)
    const base = estado!.actual
    setF({ direccion: base?.direccion ?? '', indicaciones: base?.indicaciones ?? '', quien_abre: base?.quien_abre ?? '', contacto_nombre: base?.contacto_nombre ?? '', contacto_tel: base?.contacto_tel ?? '' })
  }
  function usarAnterior() { const a = estado!.anterior!; setF({ direccion: a.direccion, indicaciones: a.indicaciones ?? '', quien_abre: a.quien_abre ?? '', contacto_nombre: a.contacto_nombre, contacto_tel: a.contacto_tel }) }

  async function guardar() {
    setGuardando(true); setError('')
    try {
      const r = await fetch('/api/visita/direccion', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const d = await r.json()
      if (!d.ok) { setError(d.error ?? 'No pudimos guardar la dirección.'); return }
      setEditando(false); setListo({ entregada: d.data.entregada }); await cargar()
    } catch { setError('Sin conexión. Intenta de nuevo.') } finally { setGuardando(false) }
  }

  return (
    <section style={{ marginTop: spacing.md, background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.lg, padding: spacing.md, fontFamily: fonts.body }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: '16px', color: colors.textoOscuro }}>¿Dónde será esta visita?</div>
      {!editando && (
        <>
          {estado.registrada && estado.actual
            ? <p style={{ margin: `${spacing.xs} 0`, color: colors.textoMedio, fontSize: '14px', lineHeight: 1.5 }}>📍 <strong>{estado.actual.direccion}</strong>{estado.actual.indicaciones ? ` · ${estado.actual.indicaciones}` : ''}</p>
            : <p role="alert" style={{ margin: `${spacing.xs} 0`, background: colors.amarilloClaro, borderRadius: radius.md, padding: spacing.sm, color: colors.moradoProfundo, fontSize: '14px', fontWeight: 700 }}>Todavía falta registrar la dirección. Sin ella tu compita no puede llegar.</p>}
          {listo && <p role="status" style={{ color: colors.verde, fontWeight: 700, fontSize: '14px' }}>{listo.entregada ? 'Listo. Tu compita ya recibió la dirección.' : 'Listo. Tu compita la recibe por Telegram unas horas antes de la visita.'}</p>}
          <button type="button" onClick={abrir} style={{ minHeight: '44px', padding: `0 ${spacing.md}`, borderRadius: radius.pill, border: `1px solid ${colors.gris200}`, background: colors.blanco, fontWeight: 700, cursor: 'pointer', color: colors.textoOscuro }}>{estado.registrada ? 'Cambiar la dirección' : 'Registrar la dirección'}</button>
        </>
      )}
      {editando && (
        <div>
          <p style={{ margin: `${spacing.xs} 0 0`, color: colors.textoMedio, fontSize: '14px', lineHeight: 1.5 }}>Se pide por cada visita. Tu compita la recibe por Telegram unas horas antes, nunca por el chat.</p>
          <p style={{ margin: `${spacing.sm} 0 0`, background: colors.amarilloClaro, borderRadius: radius.md, padding: spacing.sm, fontSize: '13px', fontWeight: 700, color: colors.moradoProfundo, lineHeight: 1.5 }}>Está prohibido compartir teléfonos, correos u otros contactos directos por el chat. Es por seguridad, la tuya, la de tu familiar y la del compita: si lo intentas, el chat lo borra y se avisa al equipo.</p>
          {estado.anterior && <button type="button" onClick={usarAnterior} style={{ marginTop: spacing.sm, minHeight: '44px', padding: `0 ${spacing.md}`, borderRadius: radius.pill, border: `1px solid ${colors.gris200}`, background: colors.blanco, fontWeight: 700, cursor: 'pointer' }}>Usar la dirección de mi visita anterior</button>}
          <label style={etiqueta}>Dirección o punto de encuentro<input value={f.direccion} onChange={(e) => set('direccion', e.target.value)} maxLength={300} style={campo} /></label>
          <label style={etiqueta}>Cómo entrar <span style={{ fontWeight: 400, color: colors.textoSutil }}>(opcional)</span><input value={f.indicaciones ?? ''} onChange={(e) => set('indicaciones', e.target.value)} maxLength={200} style={campo} /></label>
          <label style={etiqueta}>Quién abre <span style={{ fontWeight: 400, color: colors.textoSutil }}>(opcional)</span><input value={f.quien_abre ?? ''} onChange={(e) => set('quien_abre', e.target.value)} maxLength={100} style={campo} /></label>
          <label style={etiqueta}>Nombre del contacto en el sitio<input value={f.contacto_nombre} onChange={(e) => set('contacto_nombre', e.target.value)} maxLength={100} style={campo} /></label>
          <label style={etiqueta}>Teléfono del contacto en el sitio <span style={{ fontWeight: 400, color: colors.textoSutil }}>(solo lo ve el equipo de Compaz, nunca el compita)</span><input inputMode="tel" value={f.contacto_tel} onChange={(e) => set('contacto_tel', e.target.value)} maxLength={25} style={campo} /></label>
          {error && <p role="alert" style={{ color: colors.rojo, fontWeight: 700, fontSize: '14px', margin: `${spacing.xs} 0 0` }}>{error}</p>}
          <div style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.sm }}>
            <button type="button" onClick={guardar} disabled={guardando} style={{ minHeight: '48px', padding: `0 ${spacing.lg}`, borderRadius: radius.pill, border: 'none', background: colors.naranja, color: colors.blanco, fontWeight: 800, fontSize: '15px', cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando…' : 'Guardar la dirección'}</button>
            <button type="button" onClick={() => setEditando(false)} style={{ minHeight: '44px', padding: `0 ${spacing.md}`, borderRadius: radius.pill, border: `1px solid ${colors.gris200}`, background: colors.blanco, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  )
}
