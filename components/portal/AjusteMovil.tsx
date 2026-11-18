'use client'

import { useEffect } from 'react'
import { tecladoAbierto } from '@/lib/teclado-movil'

/**
 * Ajustes del portal para el teléfono. Invisible. Mantiene dos cosas en la etiqueta <html> mientras el portal está abierto:
 *  1. `--alto-visible`: el alto REAL de la zona visible (sin teclado), para que el chat ocupe justo lo que se ve y no quede a la mitad.
 *  2. `data-teclado="abierto"` cuando el teclado está arriba, para esconder el menú de abajo (si no, el menú queda flotando atravesado a media pantalla).
 * Sin `visualViewport` (navegadores viejos) no hace nada y todo queda como estaba.
 */
export default function AjusteMovil() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const raiz = document.documentElement
    const ajustar = () => {
      raiz.style.setProperty('--alto-visible', `${Math.round(vv.height)}px`)
      if (tecladoAbierto(window.innerHeight, vv.height)) raiz.dataset.teclado = 'abierto'; else delete raiz.dataset.teclado
    }
    ajustar()
    vv.addEventListener('resize', ajustar); vv.addEventListener('scroll', ajustar)
    return () => { vv.removeEventListener('resize', ajustar); vv.removeEventListener('scroll', ajustar); raiz.style.removeProperty('--alto-visible'); delete raiz.dataset.teclado }
  }, [])
  return null
}
