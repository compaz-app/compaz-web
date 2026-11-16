import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { responderDudaDeTarea } from '@/lib/responder-duda'
import { ok, err } from '@/lib/api'

// POST /api/admin/responder-duda { flag_id, texto } — responde por Telegram a un compita con una "Duda sin resolver" y cierra la tarea.
export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender')
  if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { flag_id?: unknown; texto?: unknown } | null
  if (!b || typeof b.flag_id !== 'string' || !/^[0-9a-zA-Z-]{8,64}$/.test(b.flag_id)) return err('Falta la tarea')
  const r = await responderDudaDeTarea(g.actor, b.flag_id, b.texto)
  return r.ok ? ok({ enviado: true }) : err(r.error, r.status)
}
