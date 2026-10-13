// GET /api/solicitud/estado?token=X
// Devuelve si la llamada ya fue procesada (Daily webhook disparó y envió notificaciones).
// Usado por SalaEntrevista para polling y auto-avance sin que el usuario pulse "Terminé".
import { NextRequest } from 'next/server'
import { getSolicitudPorToken } from '@/lib/solicitudes'
import { ok, err } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return err('token requerido', 400)

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return err('no encontrado', 404)

  return ok({ procesado: solicitud.confirmacion_llamada_enviada })
}
