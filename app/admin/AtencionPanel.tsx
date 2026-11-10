'use client'

import { useMemo, useState } from 'react'
import { colors, fonts, spacing, radius } from '@/lib/design'

export interface TareaPanel {
  id: string
  entidad_tipo: 'visita' | 'compita' | 'cliente'
  entidad_id: string
  entidad_nombre: string
  nota: string
  reportado_por: string
  created_at: string
  tipo?: string | null
  prioridad?: number | null
}

const limpiarNota = (n: string) => n.replace(/\n?\[[^\]]+\]\s*$/, '').trim()
const hace = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`
}
/** "⚠️ Cambio en el lugar: María / Ana" → "María / Ana"; las del sistema van aparte. */
const etiquetaGrupo = (t: TareaPanel) => (t.entidad_id === 'sistema' ? 'Sistema' : (t.entidad_nombre.includes(': ') ? t.entidad_nombre.split(': ').slice(-1)[0] : t.entidad_nombre)) || 'Sin nombre'

const NIVELES = [
  { p: 1, titulo: 'Urgente: actúa ya', color: colors.rojo, fondo: colors.rojoClaro },
  { p: 2, titulo: 'Para hacer', color: colors.moradoProfundo, fondo: colors.amarilloClaro },
  { p: 3, titulo: 'Cuando puedas', color: colors.textoMedio, fondo: colors.gris100 },
] as const

/** La bandeja del equipo: lo urgente primero, agrupado por persona, con un botón para resolver. Sirve igual al administrador y al colaborador. */
export default function AtencionPanel({ tareas, puedeAtender, onResolver, onVer }: { tareas: TareaPanel[]; puedeAtender: boolean; onResolver: (id: string) => void; onVer: (t: TareaPanel) => void }) {
  const [q, setQ] = useState('')
  const [soloUrgentes, setSoloUrgentes] = useState(false)
  const [cerrados, setCerrados] = useState<Record<string, boolean>>({})

  const visibles = useMemo(() => tareas.filter((t) => (!soloUrgentes || (t.prioridad ?? 2) === 1) && (!q.trim() || `${t.entidad_nombre} ${t.nota}`.toLowerCase().includes(q.trim().toLowerCase()))), [tareas, q, soloUrgentes])
  const nUrgentes = tareas.filter((t) => (t.prioridad ?? 2) === 1).length

  if (tareas.length === 0) {
    return (
      <div style={{ background: colors.blanco, border: `2px solid ${colors.gris200}`, borderRadius: radius.lg, padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px' }}>✅</div>
        <p style={{ color: colors.textoOscuro, fontFamily: fonts.display, fontWeight: 800, fontSize: '18px', margin: '8px 0 4px' }}>Todo en orden</p>
        <p style={{ color: colors.textoMedio, fontSize: '14px', margin: 0 }}>No hay nada pendiente. Lo que pase aparece aquí, y lo informativo lo ves en la pestaña Actividad.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, fontFamily: fonts.body }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por compita, cliente o texto" aria-label="Buscar en la bandeja" style={{ flex: '1 1 240px', minHeight: '44px', border: `1px solid ${colors.gris200}`, borderRadius: radius.md, padding: `0 ${spacing.sm}`, fontSize: '14px' }} />
        <button type="button" aria-pressed={soloUrgentes} onClick={() => setSoloUrgentes((v) => !v)} style={{ minHeight: '44px', padding: `0 ${spacing.md}`, borderRadius: radius.pill, border: soloUrgentes ? 'none' : `1px solid ${colors.gris200}`, background: soloUrgentes ? colors.rojo : colors.blanco, color: soloUrgentes ? colors.blanco : colors.textoOscuro, fontWeight: 700, cursor: 'pointer' }}>
          Solo urgentes ({nUrgentes})
        </button>
      </div>

      {NIVELES.map((nivel) => {
        const delNivel = visibles.filter((t) => Math.min(3, Math.max(1, t.prioridad ?? 2)) === nivel.p)
        if (delNivel.length === 0) return null
        const grupos = new Map<string, TareaPanel[]>()
        for (const t of delNivel) { const k = `${t.entidad_tipo}:${t.entidad_id}`; grupos.set(k, [...(grupos.get(k) ?? []), t]) }
        return (
          <section key={nivel.p}>
            <h2 style={{ fontFamily: fonts.display, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: nivel.color, margin: `0 0 ${spacing.xs}` }}>{nivel.titulo} ({delNivel.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {[...grupos.entries()].map(([clave, lista]) => {
                const k = `${nivel.p}-${clave}`; const cerrado = cerrados[k] ?? (lista.length > 1 && nivel.p !== 1)
                return (
                  <div key={k} style={{ background: colors.blanco, border: `2px solid ${nivel.p === 1 ? colors.rojo : colors.gris200}`, borderRadius: radius.md, overflow: 'hidden' }}>
                    <button type="button" onClick={() => setCerrados((c) => ({ ...c, [k]: !cerrado }))} aria-expanded={!cerrado} style={{ width: '100%', minHeight: '48px', display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `0 ${spacing.md}`, background: nivel.fondo, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: '15px', color: colors.textoOscuro, flex: 1 }}>{etiquetaGrupo(lista[0])}</span>
                      <span style={{ background: nivel.color, color: colors.blanco, borderRadius: radius.pill, padding: '1px 9px', fontSize: '12px', fontWeight: 800 }}>{lista.length}</span>
                      <span aria-hidden style={{ color: colors.textoSutil }}>{cerrado ? '▸' : '▾'}</span>
                    </button>
                    {!cerrado && lista.map((t) => (
                      <div key={t.id} style={{ padding: spacing.md, borderTop: `1px solid ${colors.gris100}`, display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: colors.textoOscuro, fontSize: '14px', marginBottom: '4px', overflowWrap: 'anywhere' }}>{t.entidad_nombre}</div>
                          <div style={{ fontSize: '14px', color: colors.textoMedio, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5 }}>{limpiarNota(t.nota)}</div>
                          <div style={{ fontSize: '12px', color: colors.textoSutil, marginTop: '6px' }}>{hace(t.created_at)} · {t.reportado_por}</div>
                        </div>
                        <div style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap' }}>
                          {t.entidad_id !== 'sistema' && <button type="button" onClick={() => onVer(t)} style={{ minHeight: '44px', padding: `0 ${spacing.md}`, borderRadius: radius.pill, border: `1.5px solid ${colors.gris200}`, background: colors.blanco, fontWeight: 700, cursor: 'pointer', color: colors.textoOscuro }}>Ver →</button>}
                          {puedeAtender && <button type="button" onClick={() => onResolver(t.id)} style={{ minHeight: '44px', padding: `0 ${spacing.md}`, borderRadius: radius.pill, border: `1.5px solid ${colors.verde}`, background: colors.verdeClaro, color: colors.verde, fontWeight: 700, cursor: 'pointer' }}>✓ Resolver</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
      {visibles.length === 0 && <p style={{ color: colors.textoMedio, textAlign: 'center' }}>Nada coincide con tu búsqueda.</p>}
    </div>
  )
}
