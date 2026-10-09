import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAdminUser } from '@/lib/auth'
import { ok, err, unauthorized, serverError } from '@/lib/api'
import { sendBienvenidaCompita } from '@/lib/resend'
import { validarPerfil, emailValido } from '@/lib/validar'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const faltantes: string[] = []
  if (!body.nombre) faltantes.push('nombre')
  if (!body.zona) faltantes.push('zona')
  if (!body.descripcion) faltantes.push('descripción')
  if (!Array.isArray(body.servicios) || !body.servicios.length) faltantes.push('al menos un servicio')
  if (faltantes.length) return err(`Faltan campos: ${faltantes.join(', ')}`)
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
  if (email && !emailValido(email)) return err('Correo inválido')
  const v = validarPerfil(body, { permitirNombre: true })
  if (!v.ok) return err(v.error)
  const { nombre, zona, descripcion, servicios, foto_url, youtube_url } = v.datos

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('compitas')
    .insert({
      nombre,
      zona,
      descripcion,
      servicios,
      email,
      foto_url: foto_url ?? null,
      youtube_url: youtube_url ?? null,
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
      await sendBienvenidaCompita(email, nombre ?? '', botUsername)
    } catch (e) {
      console.error('Error enviando email bienvenida compita:', e)
    }
  }

  return ok(data)
}
