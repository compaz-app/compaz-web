import { NextRequest } from 'next/server'
import { infoDeSala, segundosDeAviso } from '@/lib/llamada'
import { nombreDeSala } from '@/lib/llamada-ruta'
import { autorizarLlamada, pedirPase } from '@/lib/llamada-acceso'
import { ok, err, notFound, unauthorized } from '@/lib/api'

// GET /api/llamada/info?sala=<enlace o nombre> — cuándo se cierra la sala, cuántos segundos antes se avisa y el pase para entrar. Lo usa la llamada
// incrustada en el portal. Solo para quien tiene acceso a esa sala (administrador, o el cliente de esa visita con su sesión).
export async function GET(req: NextRequest) {
  const sala = req.nextUrl.searchParams.get('sala')
  if (!sala) return err('Falta la sala')
  const nombre = nombreDeSala(sala)
  const acceso = await autorizarLlamada(nombre, { rol: req.nextUrl.searchParams.get('r'), s: req.nextUrl.searchParams.get('s') })
  if (!acceso.ok) return unauthorized()
  const info = await infoDeSala(nombre)
  if (!info) return notFound()
  const pase = await pedirPase(nombre, acceso.rol, info.finEpoch)
  if (!pase) return err('No pudimos abrir la llamada', 503)
  return ok({ url: info.url, token: pase, finEpoch: info.finEpoch, ahoraEpoch: Math.floor(Date.now() / 1000), avisoSeg: await segundosDeAviso(info.tipo), tipo: info.tipo })
}
