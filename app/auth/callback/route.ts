import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirect') ?? '/dashboard'

  if (code) {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      if (isAdminEmail(data.user.email ?? '')) {
        return NextResponse.redirect(new URL('/admin', origin))
      }
      // Verificar que el usuario existe en la tabla usuarios (fue invitado)
      const { createAdminSupabase } = await import('@/lib/supabase-server')
      const admin = createAdminSupabase()
      const { data: usuario } = await admin.from('usuarios').select('id').eq('id', data.user.id).maybeSingle()
      if (!usuario) {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/login?error=no-invitado', origin))
      }
      return NextResponse.redirect(new URL(redirectTo, origin))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', origin))
}
