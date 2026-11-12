'use client'

import { useState } from 'react'
import Boton from '@/components/ui/base/Boton'
import { MOTIVOS_CONTACTO, MOTIVO_OTRO, armarMotivo } from '@/lib/panel-personas-tipos'

// Pide el motivo antes de mostrar un dato sensible (contacto o chat). El servidor vuelve a exigirlo: esto es solo la pantalla.
export default function MotivoDialog({ titulo, texto, continuar = 'Continuar', info = 'Guarda tu motivo junto con tu nombre en Actividad y te muestra el dato. Si no lo necesitas, cancela.', onListo, onCancelar }: {
  titulo: string; texto: string; continuar?: string; info?: string; onListo: (motivo: string) => void; onCancelar: () => void
}) {
  const [elegido, setElegido] = useState('')
  const [detalle, setDetalle] = useState('')
  const otro = elegido === MOTIVO_OTRO
  const listo = !!elegido && (!otro || detalle.trim().length >= 5)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-negro/40 sm:items-center" onClick={onCancelar}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo} className="w-full max-w-md rounded-t-3xl bg-blanco p-5 sm:rounded-3xl">
        <h2 className="text-lg font-extrabold">{titulo}</h2>
        <p className="mt-1 text-sm text-texto-medio">{texto}</p>
        <div className="mt-3 grid gap-2">
          {MOTIVOS_CONTACTO.map((m) => <button key={m} type="button" onClick={() => setElegido(m)} aria-pressed={elegido === m} className={`min-h-11 rounded-xl border px-3 text-left text-sm font-bold ${elegido === m ? 'border-morado-medio bg-lavanda-sutil' : 'border-borde'}`}>{m}</button>)}
        </div>
        {otro && <label className="mt-3 block text-base font-bold">Explica el motivo<textarea value={detalle} maxLength={300} onChange={(e) => setDetalle(e.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-borde p-3 text-base font-normal" /></label>}
        <div className="mt-4 flex items-center justify-end gap-2">
          <Boton tamano="compacto" variante="fantasma" navegacion onClick={onCancelar}>Cancelar</Boton>
          <Boton tamano="compacto" info={info} disabled={!listo} onClick={() => onListo(armarMotivo(elegido, detalle))}>{continuar}</Boton>
        </div>
      </div>
    </div>
  )
}
