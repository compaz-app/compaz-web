'use client'

import { useState } from 'react'
import { colors, fonts, spacing, radius } from '@/lib/design'
import { PAISES_TEL, PAIS_OTRO, PAIS_POR_DEFECTO, paisPorId, validarNacional, validarTelefono } from '@/lib/telefono'

const caja = { boxSizing: 'border-box' as const, minHeight: '48px', border: `1px solid ${colors.gris200}`, borderRadius: radius.md, fontSize: '16px', fontFamily: fonts.body, color: colors.textoOscuro, background: colors.blanco }

/**
 * Teléfono con país: se elige el país (por defecto Venezuela) y se escribe el número sin el prefijo. Dice en el momento si el número calza con las reglas
 * de ese país y cómo se va a guardar. `onChange` entrega el número en formato internacional (+584145550101) o '' si todavía no es válido.
 * Funciona a 375 px: el país y el número se parten en dos filas si no caben.
 */
export default function CampoTelefono({ valorInicial, onChange, etiquetaId }: { valorInicial: string; onChange: (e164: string) => void; etiquetaId: string }) {
  // Si ya había un número guardado, se separa en país y número nacional para mostrarlo bien.
  const previo = valorInicial ? validarTelefono(valorInicial) : null
  const [pais, setPais] = useState<string>(previo?.ok ? (previo.pais?.id ?? PAIS_OTRO) : PAIS_POR_DEFECTO)
  const [texto, setTexto] = useState<string>(previo?.ok ? (previo.pais ? previo.nacional : previo.e164) : '')
  const [tocado, setTocado] = useState(false)

  const evaluar = (p: string, t: string) => (p === PAIS_OTRO ? validarTelefono(t.startsWith('+') ? t : `+${t}`) : validarNacional(paisPorId(p)!, t))
  const r = texto ? evaluar(pais, texto) : null
  const cambiar = (p: string, t: string) => { setPais(p); setTexto(t); const x = t ? evaluar(p, t) : null; onChange(x?.ok ? x.e164 : '') }
  const actual = paisPorId(pais)

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
        <select aria-label="País del teléfono" value={pais} onChange={(e) => cambiar(e.target.value, texto)} style={{ ...caja, flex: '1 1 150px', padding: `0 ${spacing.sm}` }}>
          {PAISES_TEL.map((p) => <option key={p.id} value={p.id}>{p.nombre} (+{p.prefijo})</option>)}
          <option value={PAIS_OTRO}>Otro país (escribe el + y el código)</option>
        </select>
        <input id={etiquetaId} type="tel" inputMode={pais === PAIS_OTRO ? 'tel' : 'numeric'} autoComplete="off" value={texto} onChange={(e) => cambiar(pais, e.target.value)} onBlur={() => setTocado(true)} maxLength={22}
          placeholder={actual ? `Ej. ${actual.ejemplo}` : '+34 612 345 678'} aria-invalid={tocado && r?.ok === false} style={{ ...caja, flex: '2 1 170px', padding: `0 ${spacing.sm}` }} />
      </div>
      {r?.ok && <p role="status" style={{ margin: `${spacing.xs} 0 0`, fontSize: '13px', color: colors.verde, fontWeight: 700 }}>✓ Se guardará como {r.formateado}</p>}
      {r && !r.ok && tocado && <p role="alert" style={{ margin: `${spacing.xs} 0 0`, fontSize: '13px', color: colors.rojo, fontWeight: 700 }}>{r.error}</p>}
      {!texto && actual && <p style={{ margin: `${spacing.xs} 0 0`, fontSize: '13px', color: colors.textoSutil }}>Escríbelo sin el +{actual.prefijo}{actual.troncal ? ' ni el 0 inicial' : ''}.</p>}
    </div>
  )
}
