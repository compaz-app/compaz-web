import { getClienteActivo } from '@/lib/auth'
import { marcarNovedadesVistas } from '@/lib/novedades'
import { ok, unauthorized } from '@/lib/api'

// POST /api/portal/novedades/vistas — el cliente está mirando su portal: lo nuevo hasta ahora queda como visto (y el correo de respaldo de eso ya no hace falta).
// Solo toca las novedades de quien llama.
export async function POST() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  return ok({ marcadas: await marcarNovedadesVistas(user.id) })
}
