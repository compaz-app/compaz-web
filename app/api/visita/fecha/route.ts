import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { ok, err, unauthorized, notFound } from '@/lib/api'

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const { visita_id, fecha_programada } = await req.json() as {
    visita_id: string
    fecha_programada: string // 'YYYY-MM-DD'
  }

  if (!visita_id || !fecha_programada) return err('Faltan parámetros')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_programada)) return err('Fecha inválida')
  const hoy = new Date().toISOString().slice(0, 10)
  if (fecha_programada < hoy) return err('La fecha debe ser hoy o en el futuro')

  const admin = createAdminSupabase()

  const { data: visita } = await admin
    .from('visitas')
    .select('id, usuario_id, estado')
    .eq('id', visita_id)
    .single()

  if (!visita) return notFound()
  if (visita.usuario_id !== user.id) return err('Sin acceso', 403)
  if (visita.estado !== 'pre_visita') return err('Solo se puede asignar fecha en pre_visita')

  const { error } = await admin
    .from('visitas')
    .update({ fecha_programada })
    .eq('id', visita_id)

  if (error) return err(error.message)

  return ok({ fecha_programada })
}
