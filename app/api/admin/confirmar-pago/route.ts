import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { confirmarPagoDeTarea } from '@/lib/panel-bandeja-acciones'
import { ok, err } from '@/lib/api'

// POST /api/admin/confirmar-pago { flag_id } — confirma el pago que pide una tarea de la Bandeja. Permiso de pagos.
export async function POST(req: NextRequest) {
  const g = await requierePermiso('pagos')
  if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { flag_id?: unknown } | null
  if (!b || typeof b.flag_id !== 'string' || !/^[0-9a-zA-Z-]{8,64}$/.test(b.flag_id)) return err('Falta la tarea')
  const r = await confirmarPagoDeTarea(g.actor, b.flag_id)
  return r.ok ? ok({ correo_enviado: r.correoEnviado }) : err(r.error, r.status)
}
