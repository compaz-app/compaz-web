import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { ok, err, unauthorized, notFound } from '@/lib/api'

// POST /api/visita/cerrar-chat
// Cierra el ciclo de coordinación: pre_visita → programada
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const { visita_id } = await req.json() as { visita_id: string }
  if (!visita_id) return err('Falta visita_id')

  const admin = createAdminSupabase()

  const { data: visita } = await admin
    .from('visitas')
    .select('id, usuario_id, estado')
    .eq('id', visita_id)
    .single()

  if (!visita) return notFound()
  if (visita.usuario_id !== user.id) return err('Sin acceso', 403)
  if (visita.estado !== 'pre_visita') return err('Solo se puede cerrar una visita en pre_visita')

  const { error } = await admin
    .from('visitas')
    .update({ estado: 'programada' })
    .eq('id', visita_id)

  if (error) return err(error.message)

  return ok({ estado: 'programada' })
}
