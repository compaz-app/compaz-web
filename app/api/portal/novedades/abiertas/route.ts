import { getClienteActivo } from '@/lib/auth'
import { marcarNovedadesAbiertas } from '@/lib/novedades'
import { ok, unauthorized } from '@/lib/api'

// POST /api/portal/novedades/abiertas — el cliente abrió la campana de avisos: lo nuevo queda atendido y el círculo rojo se quita. Solo toca a quien llama.
export async function POST() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  return ok({ marcadas: await marcarNovedadesAbiertas(user.id) })
}
