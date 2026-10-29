// POST /api/admin/demo/crear-visita
// Crea una visita demo directamente desde una solicitud completada, sin pago.
// Asigna la compita al cliente y marca la solicitud como contratada.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, err, unauthorized, notFound, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { solicitud_id } = (await req.json().catch(() => ({}))) as { solicitud_id?: string }
  if (!solicitud_id) return err('Falta solicitud_id')

  const admin = createAdminSupabase()

  const { data: sol } = await admin
    .from('solicitudes')
    .select('id, cliente_id, compita_id, estado')
    .eq('id', solicitud_id)
    .single()

  if (!sol) return notFound('Solicitud no encontrada')
  if (sol.estado !== 'completada') return err(`La solicitud debe estar completada (actual: "${sol.estado}")`)

  // Asignar compita al cliente
  const { error: eU } = await admin
    .from('usuarios')
    .update({ compita_id: sol.compita_id })
    .eq('id', sol.cliente_id)
  if (eU) return serverError(eU)

  // Marcar solicitud como contratada
  const { error: eSol } = await admin
    .from('solicitudes')
    .update({ estado: 'contratada' })
    .eq('id', solicitud_id)
  if (eSol) return serverError(eSol)

  // Crear visita en estado programada (demo no requiere pre_visita)
  const { data: visita, error: eV } = await admin
    .from('visitas')
    .insert({ compita_id: sol.compita_id, usuario_id: sol.cliente_id, estado: 'programada' })
    .select('id')
    .single()
  if (eV) return serverError(eV)

  return ok({ visita_id: visita.id })
}
