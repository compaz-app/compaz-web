// GET /api/admin/pagos?usuario_id=... — historial de pagos del cliente y su cupo actual.
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { listarPagos } from '@/lib/pagos'
import { solicitudPendiente, referenciaDe } from '@/lib/solicitudes-pago'
import { resumenInsistencias } from '@/lib/confirmar-pago'
import { cupoDelPlan } from '@/lib/visitas'
import { ok, err } from '@/lib/api'

export async function GET(req: NextRequest) {
  const g = await requierePermiso('pagos'); if (!g.ok) return g.res
  const id = req.nextUrl.searchParams.get('usuario_id')
  if (!id) return err('Falta usuario_id')
  const sp = await solicitudPendiente(id)
  return ok({ pagos: await listarPagos(id), cupo: await cupoDelPlan(id), pendiente: sp ? { ...sp, referencia: referenciaDe(sp.id), insistencias: await resumenInsistencias(sp.id) } : null })
}
