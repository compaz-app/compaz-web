import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, unauthorized, serverError } from '@/lib/api'

export async function PUT(req: NextRequest) {
  let session: Awaited<ReturnType<typeof requireAuth>>
  try {
    session = await requireAuth()
  } catch {
    return unauthorized()
  }

  const body = await req.json() as {
    familiar_nombre?: string
    familiar_edad?: number | null
    familiar_condicion?: string
    familiar_notas?: string
  }

  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('usuarios')
    .update({
      familiar_nombre: body.familiar_nombre?.trim() || null,
      familiar_edad: body.familiar_edad || null,
      familiar_condicion: body.familiar_condicion?.trim() || null,
      familiar_notas: body.familiar_notas?.trim() || null,
    })
    .eq('id', session.user.id)

  if (error) return serverError(error)
  return ok(null)
}
