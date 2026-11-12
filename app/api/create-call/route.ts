import { NextRequest } from 'next/server'
import { getClienteActivo } from '@/lib/auth'
import { iniciarLlamadaDeVisita } from '@/lib/llamada-visita'
import { ok, err, unauthorized } from '@/lib/api'

// POST /api/create-call { solo_audio? } — el cliente llama a su compita durante una visita en curso. La lógica vive en lib/llamada-visita.ts.
export async function POST(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const body = await req.json().catch(() => ({})) as { solo_audio?: unknown }
  const r = await iniciarLlamadaDeVisita(user.id, body.solo_audio === true)
  if (!r.ok) return err(r.error, r.status)
  return ok({ url: r.url, room_name: r.roomName })
}
