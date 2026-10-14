// GET /api/usuario/yo — datos básicos del cliente autenticado (compita asignada, etc.)
import { getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, unauthorized } from '@/lib/api'

export async function GET() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const admin = createAdminSupabase()
  const { data } = await admin
    .from('usuarios')
    .select('compita_id')
    .eq('id', user.id)
    .maybeSingle()

  return ok({ compita_id: data?.compita_id ?? null })
}
