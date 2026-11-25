// POST /api/solicitud/llamada-no-ocurrio { token } — la página «cambiar la hora» se abrió desde el correo «¿Pudiste hablar?» (botón «No se pudo»):
// si la hora de la llamada ya pasó, queda anotado que NO ocurrió, sin pedirle otro clic al cliente. Es un POST a propósito: los escáneres de correo
// solo hacen GET y no ejecutan la página, así que no pueden disparar esto por error. Es idempotente (solo anota la primera vez).
import { NextRequest } from 'next/server'
import { getSolicitudPorToken } from '@/lib/solicitudes'
import { registrarRespuestaLlamada } from '@/lib/confirmacion-llamada'
import { ok, err, notFound } from '@/lib/api'

const DURACION_LLAMADA_MS = 20 * 60_000

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null) as { token?: string } | null
  if (!b?.token || typeof b.token !== 'string') return err('Token requerido')
  const s = await getSolicitudPorToken(b.token)
  if (!s) return notFound('Solicitud no encontrada')
  // Solo cuenta si la llamada ya debió terminar. Pedir otra hora ANTES de la llamada es un cambio normal, no un «no se pudo».
  const termino = s.slot_confirmado ? new Date(s.slot_confirmado).getTime() + DURACION_LLAMADA_MS : null
  if (s.estado !== 'aceptada' || !termino || termino > Date.now()) return ok({ registrada: false })
  await registrarRespuestaLlamada(b.token, 'cliente', 'no')
  return ok({ registrada: true })
}
