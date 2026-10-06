import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirect') ?? '/dashboard'

  if (code) {
    const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookies) {
            cookies.forEach(({ name, value }) => req.cookies.set(name, value))
            cookiesToSet.push(...cookies)
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      let destination: string

      if (isAdminEmail(data.user.email ?? '')) {
        destination = '/admin'
      } else {
        const { createAdminSupabase } = await import('@/lib/supabase-server')
        const admin = createAdminSupabase()
        const { data: usuario } = await admin.from('usuarios').select('id').eq('id', data.user.id).maybeSingle()
        if (!usuario) {
          await supabase.auth.signOut()
          return NextResponse.redirect(new URL('/login?error=no-invitado', origin))
        }
        destination = redirectTo
      }

      const response = NextResponse.redirect(new URL(destination, origin))
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      )
      return response
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', origin))
}
