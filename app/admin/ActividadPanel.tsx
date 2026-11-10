'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { colors, fonts, spacing, radius } from '@/lib/design'

interface Fila { id: string; creado_en: string; nivel: 'actividad' | 'tarea' | 'urgente'; resumen: string; categoria: string | null; entidad_nombre: string | null }

const NIVEL = {
  actividad: { icono: '⚪', texto: 'Informativo', color: colors.textoSutil },
  tarea: { icono: '🟠', texto: 'Tarea', color: colors.moradoProfundo },
  urgente: { icono: '🔴', texto: 'Urgente', color: colors.rojo },
} as const
const DIAS = [1, 2, 7, 30]

const hora = (iso: string) => new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s*([ap])\.?\s*m\.?/i, ' $1m')

/** El registro de lo que pasa en el sistema. Aquí queda lo que antes sonaba por Telegram: se consulta cuando se necesita, no interrumpe. */
export default function ActividadPanel() {
  const router = useRouter(); const sp = useSearchParams()
  // Los filtros viven en la dirección: al recargar la página se conservan.
  const nivel = sp.get('act_nivel') ?? ''; const q = sp.get('act_q') ?? ''; const dias = Number(sp.get('act_dias') ?? 2) || 2; const pagina = Number(sp.get('act_pag') ?? 0) || 0
  const [filas, setFilas] = useState<Fila[] | null>(null); const [total, setTotal] = useState(0); const [porPagina, setPorPagina] = useState(50); const [error, setError] = useState('')
  const [texto, setTexto] = useState(q)

  const poner = useCallback((cambios: Record<string, string | number | null>) => {
    const p = new URLSearchParams(sp.toString()); p.set('tab', 'actividad')
    for (const [k, v] of Object.entries(cambios)) { if (v === null || v === '' || v === 0) p.delete(k); else p.set(k, String(v)) }
    router.replace(`/admin?${p.toString()}`, { scroll: false })
  }, [router, sp])

  useEffect(() => {
    let vivo = true
    async function cargar() {
      try {
        const r = await fetch(`/api/admin/actividad?dias=${dias}&nivel=${nivel}&q=${encodeURIComponent(q)}&pagina=${pagina}`)
        const d = await r.json()
        if (!vivo) return
        if (!d.ok) { setError(d.error ?? 'No se pudo cargar'); return }
        setError(''); setFilas(d.data.filas); setTotal(d.data.total); setPorPagina(d.data.porPagina)
      } catch { if (vivo) setError('Sin conexión. Reintentando…') }
    }
    void cargar()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void cargar() }, 30_000)
    return () => { vivo = false; clearInterval(t) }
  }, [dias, nivel, q, pagina])

  const chip = (on: boolean) => ({ minHeight: '44px', padding: `0 ${spacing.md}`, borderRadius: radius.pill, border: on ? 'none' : `1px solid ${colors.gris200}`, background: on ? colors.moradoProfundo : colors.blanco, color: on ? colors.blanco : colors.textoOscuro, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.body } as const)
  const paginas = Math.max(1, Math.ceil(total / porPagina))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, fontFamily: fonts.body }}>
      <p style={{ margin: 0, color: colors.textoMedio, fontSize: '14px', lineHeight: 1.5 }}>Todo lo que pasó en el sistema, en orden. Aquí no suena nada: lo urgente te llega por Telegram y lo que debes hacer está en Atención.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
        {([['', 'Todo'], ['urgente', '🔴 Urgentes'], ['tarea', '🟠 Tareas'], ['actividad', '⚪ Informativo']] as const).map(([v, t]) => <button key={v} type="button" aria-pressed={nivel === v} onClick={() => poner({ act_nivel: v, act_pag: 0 })} style={chip(nivel === v)}>{t}</button>)}
        <span style={{ flex: 1 }} />
        {DIAS.map((d) => <button key={d} type="button" aria-pressed={dias === d} onClick={() => poner({ act_dias: d === 2 ? null : d, act_pag: 0 })} style={chip(dias === d)}>{d === 1 ? 'Hoy' : `${d} días`}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); poner({ act_q: texto.trim(), act_pag: 0 }) }} style={{ display: 'flex', gap: spacing.xs }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por compita, cliente o texto" aria-label="Buscar en la actividad" style={{ flex: 1, minHeight: '44px', border: `1px solid ${colors.gris200}`, borderRadius: radius.md, padding: `0 ${spacing.sm}`, fontSize: '14px' }} />
        <button type="submit" style={chip(false)}>Buscar</button>
      </form>

      {error && <p role="alert" style={{ color: colors.rojo, fontWeight: 700, fontSize: '14px', margin: 0 }}>{error}</p>}
      {filas === null && !error && <p style={{ color: colors.textoSutil }}>Cargando…</p>}
      {filas !== null && filas.length === 0 && <div style={{ background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.md, padding: spacing.lg, textAlign: 'center', color: colors.textoMedio }}>No hay actividad con estos filtros.</div>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        {(filas ?? []).map((f) => {
          const n = NIVEL[f.nivel]; const lineas = f.resumen.split('\n').filter(Boolean)
          return (
            <li key={f.id} style={{ background: colors.blanco, border: `1px solid ${f.nivel === 'urgente' ? colors.rojo : colors.gris200}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}` }}>
              <div style={{ display: 'flex', gap: spacing.xs, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span aria-label={n.texto}>{n.icono}</span>
                <span style={{ fontWeight: 700, color: colors.textoOscuro, fontSize: '14px', overflowWrap: 'anywhere', flex: '1 1 200px' }}>{lineas[0]}</span>
                <span style={{ fontSize: '12px', color: colors.textoSutil, whiteSpace: 'nowrap' }}>{hora(f.creado_en)}</span>
              </div>
              {lineas.length > 1 && <div style={{ fontSize: '13px', color: colors.textoMedio, marginTop: '4px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5 }}>{lineas.slice(1).join('\n')}</div>}
            </li>
          )
        })}
      </ul>
      {paginas > 1 && (
        <div style={{ display: 'flex', gap: spacing.xs, justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" disabled={pagina === 0} onClick={() => poner({ act_pag: pagina - 1 })} style={{ ...chip(false), opacity: pagina === 0 ? 0.4 : 1 }}>‹ Anterior</button>
          <span style={{ color: colors.textoMedio, fontSize: '14px' }}>Página {pagina + 1} de {paginas}</span>
          <button type="button" disabled={pagina + 1 >= paginas} onClick={() => poner({ act_pag: pagina + 1 })} style={{ ...chip(false), opacity: pagina + 1 >= paginas ? 0.4 : 1 }}>Siguiente ›</button>
        </div>
      )}
    </div>
  )
}
