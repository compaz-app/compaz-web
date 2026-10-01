import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { usuario_id, compita_id } = await req.json() as { usuario_id: string; compita_id: string }

  const admin = createAdminSupabase()
  const { error } = await admin
    .from('usuarios')
    .update({ compita_id: compita_id || null })
    .eq('id', usuario_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
