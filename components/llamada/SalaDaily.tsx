'use client'

import { useEffect, useRef, useState } from 'react'
import DailyIframe, { type DailyCall } from '@daily-co/daily-js'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * La sala de Daily dentro de una página de Compaz, con el aviso de fin: cuando faltan `avisoSeg` segundos para que la sala se cierre sola
 * aparece una franja con la cuenta atrás. Los segundos se cuentan contra el reloj del servidor (`ahoraEpoch`), no el del aparato.
 */
export default function SalaDaily({ url, finEpoch, ahoraEpoch, avisoSeg, etiquetaFin, alto }: { alto?: number; url: string; finEpoch: number | null; ahoraEpoch: number; avisoSeg: number; etiquetaFin: string }) {
  const caja = useRef<HTMLDivElement>(null)
  const desfase = useRef(ahoraEpoch * 1000 - Date.now())
  const [faltan, setFaltan] = useState<number | null>(null)
  const [fuera, setFuera] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!caja.current) return
    let call: DailyCall | null = null
    try {
      call = DailyIframe.createFrame(caja.current, { iframeStyle: { width: '100%', height: '100%', border: '0' }, showLeaveButton: true, lang: 'es' })
      call.on('left-meeting', () => setFuera(true))
      call.on('error', () => setError('No pudimos conectar la llamada. Cierra esta pestaña y vuelve a abrir el enlace.'))
      call.join({ url }).catch(() => setError('No pudimos conectar la llamada. Cierra esta pestaña y vuelve a abrir el enlace.'))
    } catch { setError('Tu navegador no permite abrir la llamada. Prueba con Chrome o Safari actualizado.') }
    return () => { try { call?.destroy() } catch { /* ya cerrada */ } }
  }, [url])

  useEffect(() => {
    if (finEpoch === null) return
    const t = setInterval(() => setFaltan(Math.max(0, Math.round(finEpoch - (Date.now() + desfase.current) / 1000))), 1000)
    return () => clearInterval(t)
  }, [finEpoch])

  const aviso = faltan !== null && faltan <= avisoSeg
  if (fuera) return <main className="grid min-h-40 place-items-center bg-fondo-claro p-6 text-center"><p className="text-base font-bold text-morado-profundo">La llamada terminó. Ya puedes cerrar esta pestaña.</p></main>
  return (
    <main className="relative w-full bg-morado-profundo" style={{ height: alto ? `${alto}px` : '100dvh' }}>
      {aviso && (
        <div role="alert" aria-live="assertive" className="absolute inset-x-0 top-0 z-10 border-b-2 border-amarillo bg-amarillo-claro px-4 py-2 text-center text-sm font-extrabold text-morado-profundo shadow-lg">
          {faltan === 0 ? 'La llamada se está cerrando.' : `${etiquetaFin} Quedan ${mmss(faltan ?? 0)}.`}
        </div>
      )}
      {error && <p role="alert" className="absolute inset-x-0 top-12 z-10 mx-auto max-w-md rounded-xl bg-blanco p-3 text-center text-sm font-bold text-rojo-oscuro">{error}</p>}
      <div ref={caja} className="h-full w-full" />
    </main>
  )
}
