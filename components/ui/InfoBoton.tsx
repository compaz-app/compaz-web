'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { colors, radius } from '@/lib/design'

/**
 * El icono ⓘ que acompaña a cada botón: al tocarlo explica en una frase qué hace el botón y qué efecto tiene.
 * Funciona con toque (móvil) y clic (escritorio); se cierra al tocar fuera o con Escape.
 */
export default function InfoBoton({ que, texto }: { /** Nombre corto del botón al que explica (para lectores de pantalla). */ que: string; /** Qué hace y qué provoca. */ texto: string }) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: Event) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('pointerdown', fuera); document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla) }
  }, [abierto])

  return (
    <span ref={raiz} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button type="button" aria-label={/^(Por qué|Qué es|Qué son)/.test(que) ? que : `Qué hace: ${que}`} aria-expanded={abierto} aria-controls={abierto ? id : undefined} onClick={() => setAbierto((v) => !v)}
        style={{ width: '44px', height: '44px', margin: '-6px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <span aria-hidden style={{ width: '20px', height: '20px', borderRadius: '50%', border: `1.5px solid ${colors.textoSutil}`, color: colors.textoSutil, fontSize: '12px', fontWeight: 800, fontStyle: 'italic', fontFamily: 'Georgia, serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, background: abierto ? colors.amarilloClaro : 'transparent' }}>i</span>
      </button>
      {abierto && (
        <span id={id} role="note" style={{ position: 'absolute', zIndex: 50, top: '34px', right: 0, width: '240px', maxWidth: 'calc(100vw - 32px)', background: colors.blanco, color: colors.textoOscuro, border: `1.5px solid ${colors.gris200}`, borderRadius: radius.md, padding: '10px 12px', fontSize: '13px', lineHeight: 1.5, fontWeight: 500, boxShadow: '0 6px 20px rgba(45,20,100,0.18)', textAlign: 'left', whiteSpace: 'normal' }}>
          {texto}
        </span>
      )}
    </span>
  )
}
