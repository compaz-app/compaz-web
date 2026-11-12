'use client'

import { useEffect, useState } from 'react'
import { colors, fonts, spacing, radius } from '@/lib/design'
import { TIPOS_PERSONA } from '@/lib/validar-solicitud'

type Estado = { personas_en_lugar: string[] | null; compita: string | null; ultimo_cambio: { estado: 'pendiente' | 'sigue' | 'no_va' } | null }

const chip = (on: boolean) => ({ minHeight: '44px', padding: `0 ${spacing.md}`, borderRadius: radius.pill, fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.body, border: on ? 'none' : `1px solid ${colors.gris200}`, background: on ? colors.moradoProfundo : colors.blanco, color: on ? colors.blanco : colors.textoOscuro })

/** Quién estará en el lugar de la próxima visita. Si el cliente lo cambia, el compita se entera de inmediato y decide. */
export default function LugarPersonas() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [editando, setEditando] = useState(false)
  const [personas, setPersonas] = useState<string[]>([])
  const [nadie, setNadie] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState<{ avisado: boolean } | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [enviadoChat, setEnviadoChat] = useState(false)

  async function cargar() {
    try {
      const r = await fetch('/api/visita/lugar'); const d = await r.json()
      if (d.ok) setEstado(d.data)
    } catch { /* si falla no se muestra nada */ }
  }
  useEffect(() => { void cargar() }, [])

  // Solo aplica a un lugar privado (si no hay lista, no hay nada que avisar).
  if (!estado || estado.personas_en_lugar === null) return null
  const compita = estado.compita?.split(' ')[0] ?? 'tu compita'
  const actual = estado.personas_en_lugar.length === 0 ? 'Nadie más, solo tu familiar' : estado.personas_en_lugar.join(', ')

  function empezar() { setEditando(true); setError(''); setAviso(null); setEnviadoChat(false); setPersonas(estado!.personas_en_lugar!); setNadie(estado!.personas_en_lugar!.length === 0) }

  async function guardar() {
    setGuardando(true); setError('')
    try {
      const r = await fetch('/api/visita/lugar', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personas_en_lugar: nadie ? [] : personas, nadie_mas: nadie }) })
      const d = await r.json()
      if (!d.ok) { setError(d.error ?? 'No pudimos guardar el cambio.'); return }
      setEditando(false)
      if (d.data.cambio) {
        setAviso({ avisado: d.data.avisado })
        setMensaje(`Hola ${compita}, cambié quién estará en el lugar: ${nadie ? 'nadie más, solo mi familiar' : personas.join(', ')}. Si tienes alguna duda, escríbeme por aquí.`)
      }
      await cargar()
    } catch { setError('Sin conexión. Intenta de nuevo.') } finally { setGuardando(false) }
  }

  async function escribirAlChat() {
    try {
      const r = await fetch('/api/send-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contenido: mensaje }) })
      if (r.ok) setEnviadoChat(true); else { const d = await r.json().catch(() => ({})); setError(d.error ?? 'No pudimos enviar el mensaje.') }
    } catch { setError('Sin conexión. Intenta de nuevo.') }
  }

  const ult = estado.ultimo_cambio
  return (
    <section style={{ marginTop: spacing.md, background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.lg, padding: spacing.md, fontFamily: fonts.body }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: '16px', color: colors.textoOscuro }}>¿Quién estará en el lugar?</div>
      <p style={{ margin: `${spacing.xs} 0`, color: colors.textoMedio, fontSize: '14px', lineHeight: 1.5 }}>Hoy: <strong>{actual}</strong></p>

      {ult?.estado === 'pendiente' && <p role="status" style={{ background: colors.amarilloClaro, borderRadius: radius.md, padding: spacing.sm, fontSize: '14px', color: colors.moradoProfundo, margin: `${spacing.xs} 0` }}>Le avisamos a {compita} del cambio. Estamos esperando su respuesta.</p>}
      {ult?.estado === 'sigue' && <p role="status" style={{ background: colors.verdeClaro, borderRadius: radius.md, padding: spacing.sm, fontSize: '14px', color: colors.verde, margin: `${spacing.xs} 0` }}>{compita} confirmó que sigue con la visita.</p>}
      {ult?.estado === 'no_va' && <p role="status" style={{ background: colors.rojoClaro, borderRadius: radius.md, padding: spacing.sm, fontSize: '14px', color: colors.rojo, margin: `${spacing.xs} 0` }}>{compita} prefirió no ir por este cambio. No se pierde tu visita ni se cobra nada: elige otro horario o compita.</p>}
      {aviso && <p role="status" style={{ color: colors.verde, fontWeight: 700, fontSize: '14px', margin: `${spacing.xs} 0` }}>{aviso.avisado ? `Listo. Le avisamos a ${compita} ahora mismo.` : `Guardamos el cambio. No pudimos avisar a ${compita} por Telegram, pero el equipo de Compaz ya lo sabe.`}</p>}

      {aviso && !enviadoChat && (
        <div style={{ margin: `${spacing.sm} 0` }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: colors.textoOscuro }}>Para que lo vea más rápido, también puedes escribirle por el chat de Compaz:
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={500} rows={3} style={{ width: '100%', boxSizing: 'border-box', marginTop: spacing.xs, borderRadius: radius.md, border: `1px solid ${colors.gris200}`, padding: spacing.sm, fontSize: '14px', fontFamily: fonts.body, fontWeight: 400 }} />
          </label>
          <button type="button" onClick={escribirAlChat} style={{ ...chip(false), marginTop: spacing.xs }}>Enviar por el chat</button>
        </div>
      )}
      {enviadoChat && <p style={{ color: colors.verde, fontSize: '14px', fontWeight: 700 }}>Mensaje enviado por el chat.</p>}

      {!editando ? (
        <button type="button" onClick={empezar} style={{ ...chip(false), marginTop: spacing.xs }}>Cambiar quién estará</button>
      ) : (
        <div style={{ marginTop: spacing.sm }}>
          <p style={{ color: colors.moradoProfundo, fontSize: '13px', fontWeight: 700, margin: `0 0 ${spacing.xs}` }}>Si cambias la lista, {compita} se entera de inmediato y decide si sigue con la visita.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
            {TIPOS_PERSONA.map((t) => <button key={t} type="button" onClick={() => { setNadie(false); setPersonas((l) => (l.length < 10 ? [...l, t] : l)) }} style={chip(false)}>+ {t}</button>)}
          </div>
          {personas.length > 0 && !nadie && (
            <ul aria-label="Personas que estarán" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, listStyle: 'none', padding: 0, margin: `${spacing.sm} 0 0` }}>
              {personas.map((t, i) => <li key={i}><button type="button" aria-label={`Quitar: ${t}`} onClick={() => setPersonas((l) => l.filter((_, k) => k !== i))} style={{ ...chip(true), minHeight: '40px' }}>{t} ✕</button></li>)}
            </ul>
          )}
          <button type="button" aria-pressed={nadie} onClick={() => { setNadie((n) => !n); setPersonas([]) }} style={{ ...chip(nadie), marginTop: spacing.sm }}>Nadie más, solo mi familiar</button>
          {error && <p role="alert" style={{ color: colors.rojo, fontWeight: 700, fontSize: '14px', margin: `${spacing.xs} 0 0` }}>{error}</p>}
          <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' }}>
            <button type="button" onClick={guardar} disabled={guardando || (!nadie && personas.length === 0)} style={{ minHeight: '48px', padding: `0 ${spacing.lg}`, borderRadius: radius.pill, border: 'none', background: colors.naranja, color: colors.blanco, fontWeight: 800, fontSize: '15px', cursor: 'pointer', opacity: guardando || (!nadie && personas.length === 0) ? 0.5 : 1 }}>{guardando ? 'Guardando…' : `Guardar y avisar a ${compita}`}</button>
            <button type="button" onClick={() => setEditando(false)} style={chip(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {!editando && error && <p role="alert" style={{ color: colors.rojo, fontWeight: 700, fontSize: '14px' }}>{error}</p>}
    </section>
  )
}
