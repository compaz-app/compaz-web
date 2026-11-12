'use client'
import { useEffect, useId, useRef, useState } from 'react'

// El icono ⓘ que acompaña a cada botón: al tocarlo explica qué hace y qué provoca. En el sistema real es components/ui/InfoBoton.tsx.
export default function InfoBoton({ que, texto, alineado = 'derecha' }: { que: string; texto: string; alineado?: 'derecha' | 'izquierda' }) {
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
    <span ref={raiz} className="relative inline-flex shrink-0 items-center">
      <button type="button" aria-label={/^(Por qué|Qué es|Qué son)/.test(que) ? que : `Qué hace: ${que}`} aria-expanded={abierto} aria-controls={abierto ? id : undefined} onClick={() => setAbierto((v) => !v)} className="flex h-12 w-12 items-center justify-center">
        <span aria-hidden className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--text-light)] font-serif text-sm font-extrabold italic text-[var(--text-light)] ${abierto ? 'bg-[var(--yellow)]' : ''}`}>i</span>
      </button>
      {abierto && <span id={id} role="note" className={`absolute top-12 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-[var(--border-muted)] bg-white p-3 text-left text-sm font-medium leading-snug text-[var(--text-dark,#1A0A3C)] shadow-lg ${alineado === 'derecha' ? 'right-0' : 'left-0'}`}>{texto}</span>}
    </span>
  )
}
