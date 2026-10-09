import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { destinoTrasLogin, BLOQUEADO } from '@/lib/login-destino'
import { urlPublica } from '@/lib/site'
import { rutaInterna } from '@/lib/html'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const redirectTo = rutaInterna(searchParams.get('redirect'), '/dashboard') // evita open redirect (//evil.com)

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
    if (error) console.error('[auth/callback] exchangeCodeForSession falló:', error.status, error.code, error.message)

    if (!error && data.user) {
      const destination = await destinoTrasLogin(data.user.id, data.user.email, redirectTo)
      if (destination === BLOQUEADO) {
        await supabase.auth.signOut()
        return NextResponse.redirect(urlPublica('/login?error=bloqueado', req))
      }
      if (!destination) {
        await supabase.auth.signOut()
        return NextResponse.redirect(urlPublica('/login?error=no-invitado', req))
      }

      const response = NextResponse.redirect(urlPublica(destination, req))
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      )
      return response
    }
  }

  console.error('[auth/callback] sin code o sin sesión; code presente:', !!code)
  return NextResponse.redirect(urlPublica(`/login?error=auth&motivo=${code ? 'intercambio' : 'sin_code'}`, req))
}
