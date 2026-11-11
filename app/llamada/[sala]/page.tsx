// /llamada/<sala> — la videollamada dentro de Compaz, con el aviso de fin. Saber el nombre de la sala es lo mismo que tener el enlace de Daily:
// no da más acceso que ese enlace.
import type { Metadata } from 'next'
import SalaDaily from '@/components/llamada/SalaDaily'
import { infoDeSala, segundosDeAviso } from '@/lib/llamada'

export const metadata: Metadata = { title: 'Llamada', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function LlamadaPage({ params }: { params: Promise<{ sala: string }> }) {
  const { sala } = await params
  const info = await infoDeSala(decodeURIComponent(sala))
  const ahora = Math.floor(Date.now() / 1000)
  if (!info || (info.finEpoch !== null && info.finEpoch <= ahora)) {
    return <main className="grid min-h-dvh place-items-center bg-fondo-claro p-6 text-center"><p className="max-w-sm text-base font-bold text-morado-profundo">Esta llamada ya terminó o el enlace no es válido. Si la necesitas otra vez, pide un enlace nuevo.</p></main>
  }
  const avisoSeg = await segundosDeAviso(info.tipo)
  const etiquetaFin = info.tipo === 'entrevista' ? 'La llamada está por terminar.' : 'La llamada de la visita está por terminar.'
  return <SalaDaily url={`${info.url}${info.url.includes('?') ? '&' : '?'}lang=es`} finEpoch={info.finEpoch} ahoraEpoch={ahora} avisoSeg={avisoSeg} etiquetaFin={etiquetaFin} />
}
