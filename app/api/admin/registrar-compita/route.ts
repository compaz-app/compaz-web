import { NextRequest } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'
import { sendBienvenidaCompita } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email ?? '')) return unauthorized()

  const { nombre, zona, descripcion, servicios, foto_url, youtube_url, email } = await req.json()

  const faltantes: string[] = []
  if (!nombre) faltantes.push('nombre')
  if (!zona) faltantes.push('zona')
  if (!descripcion) faltantes.push('descripción')
  if (!servicios?.length) faltantes.push('al menos un servicio')
  if (faltantes.length) return err(`Faltan campos: ${faltantes.join(', ')}`)

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('compitas')
    .insert({
      nombre,
      zona,
      descripcion,
      servicios,
      email: email || null,
      foto_url: foto_url || null,
      youtube_url: youtube_url || null,
      horarios_disponibles: [],
      estado: 'inactivo',
      verificado: false,
      visitas_realizadas: 0,
    })
    .select('*')
    .single()

  if (error) return serverError(error)

  // Enviar email de bienvenida si se proporcionó email
  if (email) {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? ''
    try {
      await sendBienvenidaCompita(email, nombre, botUsername)
    } catch (e) {
      console.error('Error enviando email bienvenida compita:', e)
    }
  }

  return ok(data)
}
