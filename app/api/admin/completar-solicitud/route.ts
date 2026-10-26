import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, unauthorized, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return unauthorized()

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
