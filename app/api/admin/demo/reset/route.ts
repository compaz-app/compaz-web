// POST /api/admin/demo/reset
// Limpia todo el estado demo para poder empezar una nueva demostración.
// - Cancela solicitudes activas de compitas demo
// - Termina visitas abiertas de compitas demo
// - Desvincula el compita del usuario demo (usuario.compita_id = null)
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, unauthorized, serverError } from '@/lib/api'

export async function POST(_req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const admin = createAdminSupabase()

  // Obtener IDs de todos los compitas demo
  const { data: demoCompitas, error: eDemos } = await admin
    .from('compitas')
    .select('id')
    .eq('es_demo', true)

  if (eDemos) return serverError(eDemos)
  if (!demoCompitas || demoCompitas.length === 0) return ok({ mensaje: 'No hay compitas demo' })

  const demoIds = demoCompitas.map((c) => c.id)

  // 1. Cancelar solicitudes activas (pendiente / aceptada / completada → rechazada)
  const { error: eSol } = await admin
    .from('solicitudes')
    .update({ estado: 'rechazada' })
    .in('compita_id', demoIds)
    .in('estado', ['pendiente', 'aceptada', 'completada', 'contratada'])

  if (eSol) console.error('[demo/reset] solicitudes:', eSol)

  // 2. Terminar visitas abiertas
  const { error: eVis } = await admin
    .from('visitas')
    .update({ estado: 'terminada', fin: new Date().toISOString() })
    .in('compita_id', demoIds)
    .in('estado', ['pre_visita', 'programada', 'confirmando_inicio', 'en_curso'])

  if (eVis) console.error('[demo/reset] visitas:', eVis)

  // 3. Desvincular compita demo de usuarios que lo tengan asignado
  const { error: eUsr } = await admin
    .from('usuarios')
    .update({ compita_id: null })
    .in('compita_id', demoIds)

  if (eUsr) console.error('[demo/reset] usuarios:', eUsr)

  return ok({ mensaje: 'Demo reiniciado' })
}
