import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/auth'
import { urlPublica } from '@/lib/site'

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Red de seguridad: si Supabase devuelve el enlace mágico a la raíz (?code=...) porque la URL de
  // retorno no está en su lista permitida, se reenvía al callback para completar el inicio de sesión.
  if (pathname === '/' && searchParams.has('code')) {
    const destino = urlPublica('/auth/callback', request)
    destino.searchParams.set('code', searchParams.get('code')!)
    return NextResponse.redirect(destino)
  }

  // Solo proteger /admin en middleware — el dashboard lo protege requireAuth() en el Server Component
  const isAdminRoute = pathname.startsWith('/admin')
  if (!isAdminRoute) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(urlPublica('/login', request))
  if (!isAdminEmail(user.email ?? '')) return NextResponse.redirect(urlPublica('/dashboard', request))

  return response
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/compitas/:path*', '/admin/:path*'],
}
