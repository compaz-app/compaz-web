import { NextRequest } from 'next/server'
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { ok, err, serverError } from '@/lib/api'
import { sendBienvenidaCompita } from '@/lib/resend'
import { validarPerfil, emailValido } from '@/lib/validar'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return err('Solicitud inválida')
  const { token, email, habilidades } = body as { token?: string; email?: string; habilidades?: string }

  // Si el llamante es admin, se salta el token
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const esAdmin = isAdminEmail(user?.email ?? '')

  const faltantes: string[] = []
  if (!esAdmin && !token) faltantes.push('token de invitación')
  if (!body.nombre) faltantes.push('nombre')
  if (!body.zona) faltantes.push('zona de cobertura')
  if (!body.descripcion) faltantes.push('descripción')
  if (!Array.isArray(body.servicios) || !body.servicios.length) faltantes.push('al menos un servicio')
  if (faltantes.length) return err(`Faltan campos requeridos: ${faltantes.join(', ')}`)
  if (email && !emailValido(email)) return err('Correo inválido')
  const v = validarPerfil(body, { permitirNombre: true })
  if (!v.ok) return err(v.error)
  const { nombre, zona, descripcion, servicios, foto_url, youtube_url, horarios_disponibles } = v.datos
  const habil = typeof habilidades === 'string' ? habilidades.trim().slice(0, 500) : ''

  const admin = createAdminSupabase()

  if (!esAdmin) {
    const { data: tkn } = await admin
      .from('onboarding_tokens')
      .select('id, expires_at, usado')
      .eq('token', token!)
      .single()

    if (!tkn || tkn.usado || new Date(tkn.expires_at) < new Date()) {
      return err('Token inválido o expirado')
    }

    // Marcar como usado atómicamente antes de insertar (evita TOCTOU race condition)
    const { data: claimed } = await admin
      .from('onboarding_tokens')
      .update({ usado: true })
      .eq('id', tkn.id)
      .eq('usado', false)
      .select('id')
      .single()

    if (!claimed) return err('Token inválido o expirado')
  }

  const { error } = await admin.from('compitas').insert({
    nombre,
    email: email || null,
    zona,
    descripcion: habil ? `${descripcion}\n\nHabilidades especiales: ${habil}` : descripcion,
    servicios,
    foto_url: foto_url ?? null,
    youtube_url: youtube_url ?? null,
    horarios_disponibles: horarios_disponibles ?? [],
    estado: 'activo',
    verificado: false,
    visitas_realizadas: 0,
  })

  if (error) {
    // Liberar el token: la compita no debe quedarse sin invitación por un fallo nuestro
    if (!esAdmin && token) await admin.from('onboarding_tokens').update({ usado: false }).eq('token', token)
    return serverError(error)
  }

  // Email de bienvenida con instrucciones de Telegram
  if (email) {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? ''
    try {
      await sendBienvenidaCompita(email, nombre ?? '', botUsername)
    } catch (e) { console.error('Error enviando email bienvenida compita:', e) }
  }

  return ok(null)
}
