import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const admin = { email: g.actor.correo }

  const { id } = await req.json() as { id: string }
  const supabase = createAdminSupabase()

  const { error } = await supabase
    .from('solicitudes')
    .update({ estado: 'completada' })
    .eq('id', id)
    .eq('estado', 'aceptada')

  if (error) return serverError(error)
  return ok(null)
}
