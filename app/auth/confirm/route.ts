// /auth/confirm?token_hash=...&type=email|invite|magiclink|recovery&next=/dashboard
// Inicio de sesión por enlace que NO depende del navegador donde se pidió (sin PKCE): funciona al abrir
// el correo desde el celular, la app de Gmail o cualquier otro dispositivo.
// GET muestra un botón (los escáneres de correo no consumen el enlace); POST verifica y crea la sesión.
// Plantilla de Supabase:  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabase, type CookieASetear } from '@/lib/supabase-server'
import { destinoTrasLogin } from '@/lib/login-destino'
import { rutaInterna } from '@/lib/html'
import { puertaConfirmacion } from '@/lib/confirm'

const TIPOS = ['email', 'magiclink', 'invite', 'recovery', 'signup'] as const
type Tipo = (typeof TIPOS)[number]

function leer(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const tokenHash = sp.get('token_hash')
  const type = sp.get('type') as Tipo | null
  if (!tokenHash || !type || !TIPOS.includes(type) || tokenHash.length > 200) return null
  return { tokenHash, type, next: rutaInterna(sp.get('next'), '/dashboard') }
}

const aLogin = (req: NextRequest, motivo: string) =>
  NextResponse.redirect(new URL(`/login?error=auth&motivo=${motivo}`, req.nextUrl.origin), 303)

export async function GET(req: NextRequest) {
  if (!leer(req)) return aLogin(req, 'enlace_invalido')
  return puertaConfirmacion(req, 'Entrar a Compaz', 'Pulsa el botón para iniciar sesión de forma segura.', 'Entrar')
}

export async function POST(req: NextRequest) {
  const p = leer(req)
  if (!p) return aLogin(req, 'enlace_invalido')

  const cookies: CookieASetear[] = []
  const supabase = createRouteSupabase(req, cookies)
  const { data, error } = await supabase.auth.verifyOtp({ type: p.type, token_hash: p.tokenHash })
  if (error || !data.user) {
    console.error('[auth/confirm] verifyOtp falló:', error?.status, error?.code, error?.message)
    return aLogin(req, 'verificacion')
  }

  const destino = await destinoTrasLogin(data.user.id, data.user.email, p.next)
  if (!destino) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=no-invitado', req.nextUrl.origin), 303)
  }

  const res = NextResponse.redirect(new URL(destino, req.nextUrl.origin), 303)
  cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]))
  return res
}
