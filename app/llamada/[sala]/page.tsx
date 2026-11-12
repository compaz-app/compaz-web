// /llamada/<sala> — la videollamada dentro de Compaz, con el aviso de fin. La sala de Daily es privada: aquí se comprueba quién entra (enlace firmado,
// administrador o el cliente de esa visita) y solo entonces se pide el pase de Daily. Saber el nombre de la sala ya no basta.
import type { Metadata } from 'next'
import SalaDaily from '@/components/llamada/SalaDaily'
import { infoDeSala, segundosDeAviso } from '@/lib/llamada'
import { autorizarLlamada, pedirPase } from '@/lib/llamada-acceso'

export const metadata: Metadata = { title: 'Llamada', robots: { index: false } }
export const dynamic = 'force-dynamic'

const Mensaje = ({ texto }: { texto: string }) => <main className="grid min-h-dvh place-items-center bg-fondo-claro p-6 text-center"><p className="max-w-sm text-base font-bold text-morado-profundo">{texto}</p></main>

export default async function LlamadaPage({ params, searchParams }: { params: Promise<{ sala: string }>; searchParams: Promise<{ r?: string; s?: string }> }) {
  const { sala: salaCruda } = await params
  const { r, s } = await searchParams
  let sala: string
  try { sala = decodeURIComponent(salaCruda) } catch { return <Mensaje texto="Esta llamada ya terminó o el enlace no es válido. Si la necesitas otra vez, pide un enlace nuevo." /> } // un % mal formado no debe dar un error 500
  // Mismo mensaje para "no existe" y "no tienes acceso": no se revela qué salas hay.
  const acceso = await autorizarLlamada(sala, { rol: r ?? null, s: s ?? null })
  const info = acceso.ok ? await infoDeSala(sala) : null
  const ahora = Math.floor(Date.now() / 1000)
  if (!acceso.ok || !info || (info.finEpoch !== null && info.finEpoch <= ahora)) return <Mensaje texto="Esta llamada ya terminó o el enlace no es válido. Si la necesitas otra vez, pide un enlace nuevo." />
  const pase = await pedirPase(sala, acceso.rol, info.finEpoch)
  if (!pase) return <Mensaje texto="No pudimos abrir la llamada. Inténtalo de nuevo en un momento." />
  const avisoSeg = await segundosDeAviso(info.tipo)
  const etiquetaFin = info.tipo === 'entrevista' ? 'La llamada está por terminar.' : 'La llamada de la visita está por terminar.'
  return <SalaDaily url={`${info.url}${info.url.includes('?') ? '&' : '?'}lang=es`} token={pase} finEpoch={info.finEpoch} ahoraEpoch={ahora} avisoSeg={avisoSeg} etiquetaFin={etiquetaFin} />
}
