'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors, fonts, spacing, radius } from '@/lib/design'
import type { PostulacionPorResolver } from '@/lib/captacion'

type Resolucion = 'vinculada_airtable' | 'registrada_en_cmc' | 'no_procede'

const OPCIONES: { valor: Resolucion; etiqueta: string; ayuda: string }[] = [
  { valor: 'vinculada_airtable', etiqueta: 'Ya está en Airtable', ayuda: 'Pega el ID del registro (empieza por "rec").' },
  { valor: 'registrada_en_cmc', etiqueta: 'La registré directamente en el CMC', ayuda: 'Escribe el ID COM- o dónde quedó registrada.' },
  { valor: 'no_procede', etiqueta: 'No procede', ayuda: 'Escribe el motivo (prueba, spam, datos falsos…).' },
]

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', dateStyle: 'medium', timeStyle: 'short' })

export default function BandejaPostulaciones({ pendientes }: { pendientes: PostulacionPorResolver[] }) {
  if (pendientes.length === 0) {
    return (
      <div style={{ background: colors.verdeClaro, borderRadius: radius.md, padding: spacing.md, color: colors.verde, fontSize: '14px', fontWeight: 600 }}>
        No hay postulaciones pendientes. Todas llegaron al CMC.
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      <p style={{ color: colors.textoOscuro, fontSize: '14px', fontWeight: 600, margin: 0 }}>{pendientes.length} pendiente(s)</p>
      {pendientes.map((p) => <Tarjeta key={p.id} p={p} />)}
    </div>
  )
}

function Tarjeta({ p }: { p: PostulacionPorResolver }) {
  const router = useRouter()
  const [resolucion, setResolucion] = useState<Resolucion>('vinculada_airtable')
  const [nota, setNota] = useState('')
  const [airtableId, setAirtableId] = useState('')
  const [estado, setEstado] = useState<'' | 'enviando' | 'hecho'>('')
  const [error, setError] = useState('')
  const opcion = OPCIONES.find((o) => o.valor === resolucion)!

  async function resolver() {
    setEstado('enviando'); setError('')
    try {
      const res = await fetch('/api/admin/postulaciones/resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, resolucion, nota, airtableId }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !body?.ok) { setError(body?.error ?? 'No se pudo guardar'); setEstado(''); return }
      setEstado('hecho')
      router.refresh()
    } catch {
      setError('Sin conexión. Intenta de nuevo.'); setEstado('')
    }
  }

  const campo = { width: '100%', boxSizing: 'border-box' as const, border: `1px solid ${colors.gris200}`, borderRadius: radius.sm, padding: spacing.sm, fontSize: '14px', fontFamily: fonts.body, color: colors.textoOscuro, background: colors.blanco }

  return (
    <article style={{ background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.md, padding: spacing.md }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm }}>
        <div style={{ minWidth: '220px' }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, color: colors.textoOscuro, fontSize: '16px' }}>{p.nombre}</div>
          <div style={{ color: colors.textoMedio, fontSize: '13px', marginTop: spacing.xs }}>
            {p.tipo === 'compita' ? 'Aspirante a Compita' : p.tipo === 'familia' ? 'Familia' : 'Tipo desconocido'} · {p.ubicacion}
          </div>
          <div style={{ color: colors.textoMedio, fontSize: '13px', marginTop: spacing.xs, wordBreak: 'break-all' }}>{p.telefono} · {p.email}</div>
        </div>
        <div style={{ color: colors.textoSutil, fontSize: '12px', textAlign: 'right', minWidth: '160px' }}>
          <div>Recibida: {fecha(p.recibida_en)}</div>
          <div style={{ marginTop: spacing.xs, color: p.airtable_estado === 'conflicto' ? colors.amarillo : colors.rojo, fontWeight: 600 }}>
            {p.airtable_estado === 'conflicto' ? 'Posible duplicado en Airtable' : `Airtable falló ${p.airtable_intentos} veces`}
          </div>
        </div>
      </div>
      {p.airtable_ultimo_error && (
        <div style={{ marginTop: spacing.sm, color: colors.textoSutil, fontSize: '12px', fontFamily: fonts.mono, wordBreak: 'break-word' }}>{p.airtable_ultimo_error}</div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, alignItems: 'flex-end' }}>
        <label style={{ flex: '1 1 220px', fontSize: '13px', color: colors.textoMedio }}>
          Resolución
          <select value={resolucion} onChange={(e) => setResolucion(e.target.value as Resolucion)} style={{ ...campo, marginTop: spacing.xs }} disabled={estado !== ''}>
            {OPCIONES.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select>
        </label>
        {resolucion === 'vinculada_airtable' && (
          <label style={{ flex: '1 1 200px', fontSize: '13px', color: colors.textoMedio }}>
            ID de Airtable
            <input value={airtableId} onChange={(e) => setAirtableId(e.target.value)} placeholder="recXXXXXXXXXXXXXX" style={{ ...campo, marginTop: spacing.xs }} disabled={estado !== ''} />
          </label>
        )}
        <label style={{ flex: '2 1 260px', fontSize: '13px', color: colors.textoMedio }}>
          Nota{resolucion === 'vinculada_airtable' ? ' (opcional)' : ''}
          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} style={{ ...campo, marginTop: spacing.xs }} disabled={estado !== ''} />
        </label>
        <button
          onClick={resolver}
          disabled={estado !== ''}
          style={{ background: colors.naranja, color: colors.blanco, border: 'none', borderRadius: radius.pill, padding: `${spacing.sm} ${spacing.lg}`, fontFamily: fonts.display, fontWeight: 700, fontSize: '14px', cursor: estado ? 'default' : 'pointer', opacity: estado ? 0.6 : 1 }}
        >
          {estado === 'enviando' ? 'Guardando…' : estado === 'hecho' ? 'Resuelta' : 'Resolver'}
        </button>
      </div>
      <div style={{ marginTop: spacing.xs, color: colors.textoSutil, fontSize: '12px' }}>{opcion.ayuda}</div>
      {error && <div style={{ marginTop: spacing.sm, color: colors.rojo, fontSize: '13px' }}>{error}</div>}
    </article>
  )
}
