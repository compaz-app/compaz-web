// POST /api/admin/invitar-cliente — { nombre, email }
// Crea la cuenta del cliente y le envía UN solo correo (el de bienvenida) con un botón que activa la cuenta
// y entra directo al portal (/auth/confirm). Si el cliente ya está registrado NO se reinvita (409): para volver
// a entrar usa /login, que envía un acceso nuevo sin intervención de nadie.
// No usa el correo de invitación de Supabase: así no hay dos correos ni dependemos de su plantilla.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAdminUser } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'
import { sendBienvenidaCliente } from '@/lib/resend'
import { emailValido } from '@/lib/validar'
import { SITE_URL } from '@/lib/email'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { nombre, email: emailRaw } = (await req.json().catch(() => ({}))) as { nombre?: string; email?: string }
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : ''
  if (!nombre || !email) return err('Faltan datos')
  if (!emailValido(email) || typeof nombre !== 'string' || nombre.length > 100) return err('Datos inválidos')

  const admin = createAdminSupabase()

  // 0. Si ya está registrado no se vuelve a invitar: si no puede entrar, pide un enlace nuevo en /login.
  const YA_REGISTRADO = 'Este cliente ya está registrado y no se le puede enviar otra invitación. Si no puede entrar, dile que pida un enlace nuevo en micompaz.com/login.'
  const { data: existente } = await admin.from('usuarios').select('id').eq('email', email).maybeSingle()
  if (existente) return err(YA_REGISTRADO, 409)

  // 1. Crear la cuenta y obtener el enlace de activación (sin que Supabase envíe correo)
  const link = await admin.auth.admin.generateLink({ type: 'invite', email, options: { data: { nombre } } })
  if (link.error && (link.error.code === 'email_exists' || /already|registered|exists/i.test(link.error.message))) {
    return err(YA_REGISTRADO, 409) // existe una cuenta con ese correo (p. ej. admin): tampoco se reinvita
  }
  if (link.error || !link.data?.user || !link.data.properties?.hashed_token) {
    console.error('[invitar-cliente] generateLink falló:', link.error?.code, link.error?.message)
    return serverError(link.error ?? new Error('No se pudo generar el enlace'))
  }
  const { user, properties } = link.data

  // 2. Fila del cliente en la plataforma
  const { error: eU } = await admin
    .from('usuarios')
    .upsert({ id: user.id, email, nombre }, { onConflict: 'id', ignoreDuplicates: true })
  if (eU) console.error('[invitar-cliente] upsert usuarios falló:', eU.message)

  // 3. Un solo correo con el botón de activación
  // Usar el tipo que devuelve Supabase (una cuenta sin activar puede pedir 'signup' en vez de 'magiclink')
  const tipo = properties.verification_type ?? 'invite'
  const enlace = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(properties.hashed_token)}&type=${tipo}`
  try {
    await sendBienvenidaCliente(email, nombre, enlace)
  } catch (e) {
    console.error('[invitar-cliente] correo falló:', e)
    // Deshacer la cuenta recién creada: si no, quedaría "ya registrada" sin que la persona haya recibido nada
    const { error: eDel } = await admin.auth.admin.deleteUser(user.id)
    if (eDel) console.error('[invitar-cliente] no se pudo deshacer la cuenta:', eDel.message)
    return err('No se pudo enviar el correo de invitación. No se creó la cuenta: vuelve a pulsar Invitar para reintentar.', 502)
  }

  return ok({ email, nombre })
}
