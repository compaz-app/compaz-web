'use client'

import { useEffect } from 'react'

/** La ventana emergente del panel: en el teléfono sube desde abajo, en escritorio queda al centro. Escape y tocar fuera la cierran. */
export default function DialogoPanel({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onCerrar])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-negro/40 sm:items-center" onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-blanco p-5 sm:rounded-3xl">
        <h2 className="text-lg font-extrabold">{titulo}</h2>
        {children}
      </div>
    </div>
  )
}
