import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { verificarCompita, desactivarCompita } from '@/lib/compitas'
import { ok, err, unauthorized, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return unauthorized()

  const { compita_id, verificado } = await req.json() as { compita_id: string; verificado: boolean }
  if (!compita_id || typeof verificado !== 'boolean') return err('Parámetros inválidos')

  try {
    if (verificado) {
      await verificarCompita(compita_id)
    } else {
      await desactivarCompita(compita_id)
    }
    return ok({ compita_id, verificado })
  } catch (e) {
    return serverError(e)
  }
}
