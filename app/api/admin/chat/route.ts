import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { verChat, refrescarChat } from '@/lib/panel-chat'
import { ok, err } from '@/lib/api'

const ID = /^[0-9a-zA-Z-]{8,64}$/

// POST /api/admin/chat { clienteId, compitaId, motivo } — la conversación entre un cliente y un compita. Se anota quién la abrió y por qué.
// POST /api/admin/chat { clienteId, compitaId, refrescar: true, desde } — solo los mensajes nuevos de un chat que esta persona abrió hace menos de
// 30 minutos (no anota otro acceso; pasado el plazo responde 403 con `caducado` y hay que abrirlo de nuevo).
export async function POST(req: NextRequest) {
  const g = await requierePermiso('chats')
  if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { clienteId?: unknown; compitaId?: unknown; motivo?: unknown; refrescar?: unknown; desde?: unknown } | null
  if (!b || typeof b.clienteId !== 'string' || typeof b.compitaId !== 'string' || !ID.test(b.clienteId) || !ID.test(b.compitaId)) return err('Faltan campos requeridos')
  if (b.refrescar === true) {
    const n = await refrescarChat(g.actor, { clienteId: b.clienteId, compitaId: b.compitaId, desde: b.desde })
    return n.ok ? ok({ mensajes: n.mensajes }) : err(n.error, n.status)
  }
  const r = await verChat(g.actor, { clienteId: b.clienteId, compitaId: b.compitaId, motivo: b.motivo })
  return r.ok ? ok({ cliente: r.cliente, compita: r.compita, mensajes: r.mensajes }) : err(r.error, r.status)
}
