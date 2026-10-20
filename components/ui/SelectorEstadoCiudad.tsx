'use client'

import type { CSSProperties } from 'react'
import { colors } from '@/lib/design'
import { VENEZUELA_ESTADOS } from '@/lib/venezuela'

interface Props {
  estado: string
  ciudad: string
  onChange: (valor: { estado: string; ciudad: string }) => void
  placeholderEstado: string
}

const ESTADOS_ORDENADOS = Object.keys(VENEZUELA_ESTADOS).sort()

// Selector de estado → ciudad usado por los formularios públicos (home y landing de Compitas).
// Al cambiar de estado se vacía la ciudad.
export default function SelectorEstadoCiudad({ estado, ciudad, onChange, placeholderEstado }: Props) {
  const ciudadesDelEstado = estado ? VENEZUELA_ESTADOS[estado] ?? [] : []
  const clase = 'w-full rounded-xl px-5 py-4 text-base outline-none focus:ring-2'
  const estilo = (conValor: boolean) => ({
    backgroundColor: colors.blanco,
    color: conValor ? colors.textoOscuro : colors.gris400,
    fontFamily: 'var(--font-inter)',
    '--tw-ring-color': colors.moradoMedio,
  }) as CSSProperties

  return (
    <>
      <select
        required
        aria-label={placeholderEstado}
        value={estado}
        onChange={(e) => onChange({ estado: e.target.value, ciudad: '' })}
        className={clase}
        style={estilo(!!estado)}
      >
        <option value="" disabled>{placeholderEstado}</option>
        {ESTADOS_ORDENADOS.map((e) => (
          <option key={e} value={e}>{e}</option>
        ))}
      </select>
      {estado && (
        <select
          required
          aria-label="Ciudad o municipio"
          value={ciudad}
          onChange={(e) => onChange({ estado, ciudad: e.target.value })}
          className={clase}
          style={estilo(!!ciudad)}
        >
          <option value="" disabled>Ciudad o municipio</option>
          {ciudadesDelEstado.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}
    </>
  )
}
