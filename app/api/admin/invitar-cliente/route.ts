import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAdminUser } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'
import { sendBienvenidaCliente } from '@/lib/resend'
import { emailValido } from '@/lib/validar'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { nombre, email } = (await req.json().catch(() => ({})) as { nombre: string; email: string })
  if (!nombre || !email) return err('Faltan datos')
  if (!emailValido(email) || typeof nombre !== 'string' || nombre.length > 100) return err('Datos inválidos')

  const admin = createAdminSupabase()

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
  })

  if (error) return serverError(error)

  await admin
    .from('usuarios')
    .upsert({ id: data.user.id, email, nombre }, { onConflict: 'id', ignoreDuplicates: true })

  try {
    await sendBienvenidaCliente(email, nombre)
  } catch (e) {
    console.error('Error enviando email bienvenida cliente:', e)
  }

  return ok({ email, nombre })
}
