import { getClienteActivo } from '@/lib/auth'
import { getSolicitudesCliente } from '@/lib/solicitudes'
import { ok, unauthorized, serverError } from '@/lib/api'

export async function GET() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  try {
    const solicitudes = await getSolicitudesCliente(user.id)
    return ok({ solicitudes })
  } catch (e) {
    console.error('[mis-solicitudes] error:', e)
    return serverError(e)
  }
}
