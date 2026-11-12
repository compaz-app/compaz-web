// POST /api/solicitud/reagendar-cliente { token } — el cliente pide cambiar la hora de una entrevista agendada con horas
// libres (desde el correo de confirmación). Suelta la hora, avisa al compita y devuelve la solicitud para elegir otra.
import { NextRequest } from 'next/server'
import { getSolicitudPorToken } from '@/lib/solicitudes'
import { esEntrevistaConHoras, reagendarEntrevista } from '@/lib/reagendar'
import { ok, err, notFound } from '@/lib/api'

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null) as { token?: string } | null
  if (!b?.token || typeof b.token !== 'string') return err('Token requerido')
  const s = await getSolicitudPorToken(b.token)
  if (!s) return notFound('Solicitud no encontrada')
  if (!(await esEntrevistaConHoras(s.id))) return err('Esta solicitud no se reagenda por aquí.', 409)
  const r = await reagendarEntrevista(s.id, 'cliente')
  if (!r.ok) return err(r.motivo === 'cerrada' ? 'Esta solicitud ya no admite cambiar la hora.' : 'No pudimos cambiar la hora. Intenta de nuevo.', r.motivo === 'cerrada' ? 409 : 500)
  return ok({ solicitud_id: s.id })
}
