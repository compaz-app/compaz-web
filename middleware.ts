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

  const isAdminRoute = pathname.startsWith('/admin')
  const isAreaCliente = pathname.startsWith('/dashboard') || pathname.startsWith('/compitas') || pathname.startsWith('/pago')
  if (!isAdminRoute && !isAreaCliente) return NextResponse.next()

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

  // Área de clientes: una cuenta bloqueada se expulsa en cada navegación (cierra su sesión y vuelve al login).
  // Los Server Components y las rutas de la API repiten la comprobación (getClienteActivo), esto es la primera barrera.
  if (isAreaCliente) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || isAdminEmail(user.email ?? '')) return response
      const { data: fila } = await supabase.from('usuarios').select('plan').eq('id', user.id).maybeSingle()
      if (fila?.plan === 'bloqueado') {
        await supabase.auth.signOut()
        const salida = NextResponse.redirect(urlPublica('/login?error=bloqueado', request))
        response.cookies.getAll().forEach((c) => salida.cookies.set(c))
        return salida
      }
    } catch (e) {
      console.error('[middleware] comprobación de cuenta bloqueada falló:', e)
    }
    return response
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(urlPublica('/login', request))
  if (!isAdminEmail(user.email ?? '')) return NextResponse.redirect(urlPublica('/dashboard', request))

  return response
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/compitas/:path*', '/pago/:path*', '/admin/:path*'],
}
