'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { colors, radius } from '@/lib/design'

/**
 * El icono ⓘ que acompaña a cada botón: al tocarlo explica en una frase qué hace el botón y qué efecto tiene.
 * Funciona con toque (móvil) y clic (escritorio); se cierra al tocar fuera, con Escape o al desplazar la página.
 * El globo se coloca con `position: fixed` y se acomoda dentro de la pantalla (sin salirse por los lados y, si abajo no cabe, hacia arriba),
 * así nunca lo corta un contenedor con `overflow: hidden` (listas, tarjetas, paneles).
 */
export default function InfoBoton({ que, texto }: { /** Nombre corto del botón al que explica (para lectores de pantalla). */ que: string; /** Qué hace y qué provoca. */ texto: string }) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLSpanElement>(null)
  const globo = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const id = useId()
  const ancho = typeof window === 'undefined' ? 240 : Math.min(280, window.innerWidth - 32)

  // Coloca el globo junto al icono: centrado, dentro de la pantalla, y hacia arriba si abajo no cabe.
  useLayoutEffect(() => {
    if (!abierto || !raiz.current) { setPos(null); return }
    const r = raiz.current.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight, alto = globo.current?.offsetHeight ?? 120
    const left = Math.min(Math.max(16, r.left + r.width / 2 - ancho / 2), vw - ancho - 16)
    const abajo = r.bottom + 4
    setPos({ left, top: abajo + alto > vh - 8 && r.top - alto - 4 > 8 ? r.top - alto - 4 : abajo })
  }, [abierto, texto, ancho])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: Event) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    const cerrar = () => setAbierto(false)
    document.addEventListener('pointerdown', fuera); document.addEventListener('keydown', tecla); window.addEventListener('scroll', cerrar, true); window.addEventListener('resize', cerrar)
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); window.removeEventListener('scroll', cerrar, true); window.removeEventListener('resize', cerrar) }
  }, [abierto])

  return (
    <span ref={raiz} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button type="button" aria-label={/^(Por qué|Qué es|Qué son)/.test(que) ? que : `Qué hace: ${que}`} aria-expanded={abierto} aria-controls={abierto ? id : undefined} onClick={() => setAbierto((v) => !v)}
        style={{ width: '44px', height: '44px', margin: '-6px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <span aria-hidden style={{ width: '20px', height: '20px', borderRadius: '50%', border: `1.5px solid ${colors.textoSutil}`, color: colors.textoSutil, fontSize: '12px', fontWeight: 800, fontStyle: 'italic', fontFamily: 'Georgia, serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, background: abierto ? colors.amarilloClaro : 'transparent' }}>i</span>
      </button>
      {abierto && (
        <span ref={globo} id={id} role="note" style={{ position: 'fixed', zIndex: 60, top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden', width: `${ancho}px`, background: colors.blanco, color: colors.textoOscuro, border: `1.5px solid ${colors.gris200}`, borderRadius: radius.md, padding: '10px 12px', fontSize: '13px', lineHeight: 1.5, fontWeight: 500, boxShadow: '0 6px 20px rgba(45,20,100,0.18)', textAlign: 'left', whiteSpace: 'normal' }}>
          {texto}
        </span>
      )}
    </span>
  )
}
