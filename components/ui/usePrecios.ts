'use client'

import { useEffect, useState } from 'react'
import type { Precios } from '@/lib/precios'

let guardado: Precios | null = null

/**
 * Los precios que rigen hoy (los de Ajustes), para MOSTRARLOS. Devuelve null mientras llegan: la pantalla pone "…" en vez de una cifra
 * que podría estar vieja. El importe que se cobra lo calcula siempre el servidor.
 */
export function usePrecios(): Precios | null {
  const [p, setP] = useState<Precios | null>(guardado)
  useEffect(() => {
    let vivo = true
    fetch('/api/precios', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (j?.ok && vivo) { guardado = j.data as Precios; setP(guardado) }
    }).catch(() => {})
    return () => { vivo = false }
  }, [])
  return p
}

/** "$22" o "…" mientras no llega. */
export const dolares = (n: number | undefined) => (n === undefined ? '…' : `$${n}`)
