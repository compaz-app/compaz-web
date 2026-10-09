// POST /api/admin/plan-cliente — el admin fija, renueva o quita el plan de un cliente (cobro manual).
// { usuario_id, plan: 'carta'|'quincenal'|'semanal'|null }  → reinicia el ciclo desde hoy.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { LIMITES_PLAN } from '@/lib/pago'
import { cupoDelPlan } from '@/lib/visitas'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()
  const body = await req.json().catch(() => null) as { usuario_id?: string; plan?: string | null } | null
  if (!body?.usuario_id) return err('Falta usuario_id')
  if (body.plan && !(body.plan in LIMITES_PLAN)) return err('Plan inválido')

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('usuarios')
    .update({ plan_contratado: body.plan || null, plan_inicio: body.plan ? new Date().toISOString() : null })
    .eq('id', body.usuario_id)
    .select('id')
    .maybeSingle()
  if (error) return serverError(error)
  if (!data) return err('Cliente no encontrado', 404)
  return ok({ usuario_id: body.usuario_id, plan: body.plan || null, cupo: await cupoDelPlan(body.usuario_id) })
}
