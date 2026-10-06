// GET /api/solicitud/info-reagendar?token=xxx
// Devuelve info básica de la solicitud para la página de reagendado (sin login)
import { NextRequest } from 'next/server'
import { getSolicitudPorToken } from '@/lib/solicitudes'
import { ok, err, notFound } from '@/lib/api'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return err('Token requerido')

  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud) return notFound('Solicitud no encontrada')

  if (solicitud.estado === 'completada' || solicitud.estado === 'contratada') {
    return err('Esta solicitud ya está cerrada.')
  }

  return ok({
    compita_nombre: solicitud.compita_nombre ?? '',
    compita_foto: solicitud.compita_foto ?? null,
    estado: solicitud.estado,
  })
}
