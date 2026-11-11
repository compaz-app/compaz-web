import { NextRequest } from 'next/server'
import { infoDeSala, segundosDeAviso } from '@/lib/llamada'
import { nombreDeSala } from '@/lib/llamada-ruta'
import { ok, err, notFound } from '@/lib/api'

// GET /api/llamada/info?sala=<enlace o nombre de la sala> — cuándo se cierra la sala y cuántos segundos antes se avisa. Lo usa la llamada incrustada
// en el portal. Saber el nombre de la sala equivale a tener su enlace: no da más acceso.
export async function GET(req: NextRequest) {
  const sala = req.nextUrl.searchParams.get('sala')
  if (!sala) return err('Falta la sala')
  const info = await infoDeSala(nombreDeSala(sala))
  if (!info) return notFound()
  return ok({ url: info.url, finEpoch: info.finEpoch, ahoraEpoch: Math.floor(Date.now() / 1000), avisoSeg: await segundosDeAviso(info.tipo), tipo: info.tipo })
}
