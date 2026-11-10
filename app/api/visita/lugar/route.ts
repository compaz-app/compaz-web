// /api/visita/lugar — quién estará en el lugar de la próxima visita.
// GET: la lista vigente y el estado del último cambio. PUT { personas_en_lugar | nadie_mas }: la cambia y AVISA al compita.
import { NextRequest } from 'next/server'
import { getClienteActivo } from '@/lib/auth'
import { visitaParaLugar, listaActual, cambiarPersonasEnLugar, estadoCambioLugar } from '@/lib/lugar'
import { ok, err, unauthorized } from '@/lib/api'

export async function GET() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const v = await visitaParaLugar(user.id)
  if (!v) return err('No tienes una visita próxima', 404)
  return ok({ personas_en_lugar: await listaActual(v), compita: v.compitas?.nombre ?? null, ultimo_cambio: await estadoCambioLugar(v.id) })
}

export async function PUT(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return err('Solicitud inválida')
  const r = await cambiarPersonasEnLugar(user.id, body)
  if (!r.ok) return err(r.error, r.motivo === 'sin_visita' ? 404 : r.motivo === 'error' ? 500 : 400)
  if (!r.cambio) return ok({ cambio: false })
  return ok({ cambio: true, avisado: r.avisado })
}
