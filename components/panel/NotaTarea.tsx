'use client'

import { useState } from 'react'

const LARGO_CORTO = 150

/** La nota de una tarea: si es larga se ve recortada a tres líneas, con «Ver más» para leerla completa (antes quedaba cortada sin forma de leerla). */
export default function NotaTarea({ texto }: { texto: string }) {
  const [abierta, setAbierta] = useState(false)
  const larga = texto.length > LARGO_CORTO
  return (
    <div>
      <p className={`whitespace-pre-wrap text-sm text-texto-medio [overflow-wrap:anywhere] ${larga && !abierta ? 'line-clamp-3' : ''}`}>{texto}</p>
      {larga && <button type="button" aria-expanded={abierta} onClick={() => setAbierta((a) => !a)} className="mt-0.5 min-h-9 text-xs font-bold text-morado-medio underline-offset-2 hover:underline">{abierta ? 'Ver menos' : 'Ver más'}</button>}
    </div>
  )
}
