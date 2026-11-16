import { getClienteActivo } from '@/lib/auth'
import { marcarChatLeido } from '@/lib/portal-mensajes'
import { ok, unauthorized } from '@/lib/api'

// POST /api/portal/chat/leido — el cliente tiene su chat a la vista: lo anterior queda leído y el círculo rojo se quita. Solo toca al que llama.
export async function POST() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  return ok({ marcado: await marcarChatLeido(user.id) })
}
