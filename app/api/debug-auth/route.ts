import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  let usuario = null
  let usuarioError = null
  if (user) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*, compita:compitas(*)')
      .eq('id', user.id)
      .single()
    usuario = data
    usuarioError = error?.message ?? null
  }

  return NextResponse.json({
    user: user?.email ?? null,
    userError: userError?.message ?? null,
    usuario,
    usuarioError
  })
}
