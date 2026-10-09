// POST /api/admin/anular-pago — { pago_id, motivo } deja el pago como anulado y recalcula el cupo.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { anularPago } from '@/lib/pagos'
import { cupoDelPlan } from '@/lib/visitas'
import { ok, err, unauthorized } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()
  const b = await req.json().catch(() => null) as { pago_id?: string; motivo?: string } | null
  if (!b?.pago_id) return err('Falta pago_id')
  const r = await anularPago(b.pago_id, b.motivo ?? '')
  if (!r.ok) return err(r.error, 400)
  return ok({ cupo: await cupoDelPlan(r.usuarioId) })
}
