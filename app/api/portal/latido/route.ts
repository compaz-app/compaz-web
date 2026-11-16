import { getClienteActivo } from '@/lib/auth'
import { registrarLatido } from '@/lib/novedades'
import { ok, unauthorized } from '@/lib/api'

// POST /api/portal/latido — el portal del cliente avisa que está abierto (cada ~45 s mientras la pestaña está a la vista). Con eso el sistema sabe si el cliente
// está mirando y decide si el correo de respaldo hace falta. Solo marca la hora en la cuenta de quien llama; no recibe datos.
export async function POST() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  await registrarLatido(user.id)
  return ok({ latido: true })
}
