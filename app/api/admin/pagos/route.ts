// GET /api/admin/pagos?usuario_id=... — historial de pagos del cliente y su cupo actual.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { listarPagos } from '@/lib/pagos'
import { cupoDelPlan } from '@/lib/visitas'
import { ok, err, unauthorized } from '@/lib/api'

export async function GET(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()
  const id = req.nextUrl.searchParams.get('usuario_id')
  if (!id) return err('Falta usuario_id')
  return ok({ pagos: await listarPagos(id), cupo: await cupoDelPlan(id) })
}
