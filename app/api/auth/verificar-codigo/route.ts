// POST /api/auth/verificar-codigo — { email, codigo, returnTo? }
// Entrada con el código numérico del correo de acceso: sirve cuando el enlace se abrió en otra app o en otro
// teléfono (el navegador interno de Gmail no comparte la sesión) y cuando el enlace venció.
// Es el mismo código que trae el enlace: se genera junto con él, así que un enlace nuevo invalida el código anterior.
// Frena adivinar: máximo 5 intentos fallidos por correo y 30 por IP en 15 minutos.
import { NextRequest } from 'next/server'
import { createRouteSupabase, createAdminSupabase, type CookieASetear } from '@/lib/supabase-server'
import { destinoTrasLogin, BLOQUEADO } from '@/lib/login-destino'
import { emailValido } from '@/lib/validar'
import { rutaInterna } from '@/lib/html'
import { intentosActuales, sumarIntento, reiniciarIntentos } from '@/lib/limite'
import { ok, err } from '@/lib/api'

const MAX_FALLOS_CORREO = 5
const MAX_INTENTOS_IP = 30
const VENTANA_MIN = 15
const MENSAJE_INVALIDO = 'Ese código no es válido o ya venció. Pide uno nuevo y usa el del correo más reciente.'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { email?: unknown; codigo?: unknown; returnTo?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const codigo = typeof body?.codigo === 'string' ? body.codigo.replace(/\s+/g, '') : ''
  if (!emailValido(email) || !/^\d{6,10}$/.test(codigo)) return err(MENSAJE_INVALIDO, 400)

  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'desconocida'
  if ((await sumarIntento(`cod_ip:${ip}`, VENTANA_MIN)) > MAX_INTENTOS_IP) return err('Demasiados intentos. Espera unos minutos.', 429)
  const claveCorreo = `cod_fallos:${email}`
  if ((await intentosActuales(claveCorreo)) >= MAX_FALLOS_CORREO) {
    return err('Demasiados intentos con este código. Pide uno nuevo por correo.', 429)
  }

  const cookies: CookieASetear[] = []
  const supabase = createRouteSupabase(req, cookies)
  const { data, error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'email' })
  if (error || !data.user) {
    await sumarIntento(claveCorreo, VENTANA_MIN)
    return err(MENSAJE_INVALIDO, 400)
  }
  await reiniciarIntentos(claveCorreo)

  // Igual que /auth/confirm: marca activado y decide el destino (admin, cliente, bloqueado o no invitado)
  await createAdminSupabase().from('usuarios').update({ activado: true }).eq('id', data.user.id).eq('activado', false)
  const next = rutaInterna(typeof body?.returnTo === 'string' ? body.returnTo : null, '/dashboard')
  const destino = await destinoTrasLogin(data.user.id, data.user.email, next)
  if (destino === BLOQUEADO) {
    await supabase.auth.signOut()
    return err('Tu cuenta está suspendida. Escríbenos a hola@micompaz.com.', 403)
  }
  if (!destino) {
    await supabase.auth.signOut()
    return err('Esta cuenta aún no tiene acceso. Escríbenos a hola@micompaz.com.', 403)
  }

  const res = ok({ destino })
  cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]))
  return res
}
