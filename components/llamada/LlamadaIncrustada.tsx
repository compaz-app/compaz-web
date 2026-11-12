'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// daily-js pesa unos 590 KB: solo se descarga cuando de verdad hay una llamada, no con cada carga del portal.
const SalaDaily = dynamic(() => import('@/components/llamada/SalaDaily'), { ssr: false })

interface Info { url: string; token: string; finEpoch: number | null; ahoraEpoch: number; avisoSeg: number; tipo: 'entrevista' | 'visita' }

/** Una sala dentro de un recuadro de otra pantalla (el portal del cliente): pide a Compaz cuándo se cierra y pone el aviso de fin. */
export default function LlamadaIncrustada({ roomUrl, alto = 480 }: { roomUrl: string; alto?: number }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [fallo, setFallo] = useState(false)
  useEffect(() => {
    let vivo = true
    fetch(`/api/llamada/info?sala=${encodeURIComponent(roomUrl)}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (!vivo) return
      if (j?.ok) setInfo(j.data as Info); else setFallo(true)
    }).catch(() => vivo && setFallo(true))
    return () => { vivo = false }
  }, [roomUrl])
  if (fallo) return <p className="p-4 text-sm font-bold text-morado-profundo">Esta llamada ya terminó. Pide una nueva para seguir hablando.</p>
  if (!info) return <p className="p-4 text-sm text-texto-medio">Conectando la llamada…</p>
  return <SalaDaily token={info.token} url={`${info.url}${info.url.includes('?') ? '&' : '?'}lang=es`} finEpoch={info.finEpoch} ahoraEpoch={info.ahoraEpoch} avisoSeg={info.avisoSeg}
    etiquetaFin={info.tipo === 'entrevista' ? 'La llamada está por terminar.' : 'La llamada de la visita está por terminar.'} alto={alto} />
}
