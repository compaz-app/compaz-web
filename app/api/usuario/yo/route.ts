// GET /api/usuario/yo — datos del cliente: compita asignada + compitas con historial
import { getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, unauthorized } from '@/lib/api'

export async function GET() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const admin = createAdminSupabase()

  const [{ data: usuarioRow }, { data: visitasRow }] = await Promise.all([
    admin.from('usuarios').select('compita_id').eq('id', user.id).maybeSingle(),
    admin.from('visitas').select('compita_id').eq('usuario_id', user.id).neq('estado', 'pre_visita'),
  ])

  const compitaAsignadaId = usuarioRow?.compita_id ?? null

  // IDs únicos de todas las compitas con las que tuvo visitas (además de la asignada)
  const compitasConHistorial = [...new Set(
    (visitasRow ?? [])
      .map((v) => v.compita_id as string)
      .filter(Boolean)
  )]

  return ok({ compita_id: compitaAsignadaId, compitas_con_historial: compitasConHistorial })
}
