// POST /api/admin/anular-pago — { pago_id, motivo } deja el pago como anulado y recalcula el cupo.
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { anularPago } from '@/lib/pagos'
import { cupoDelPlan } from '@/lib/visitas'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('pagos'); if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { pago_id?: string; motivo?: string } | null
  if (!b?.pago_id) return err('Falta pago_id')
  const r = await anularPago(b.pago_id, b.motivo ?? '')
  if (!r.ok) return err(r.error, 400)
  return ok({ cupo: await cupoDelPlan(r.usuarioId) })
}
