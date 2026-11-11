import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { requierePermiso } from '@/lib/permisos'
import { ok, err, serverError } from '@/lib/api'
import { sendBienvenidaCompita } from '@/lib/resend'
import { validarPerfil, emailValido } from '@/lib/validar'
import { normalizarTelefono } from '@/lib/captacion'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('invitar'); if (!g.ok) return g.res

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const faltantes: string[] = []
  if (!body.nombre) faltantes.push('nombre')
  if (!body.zona) faltantes.push('zona')
  if (!body.descripcion) faltantes.push('descripción')
  if (!Array.isArray(body.servicios) || !body.servicios.length) faltantes.push('al menos un servicio')
  if (faltantes.length) return err(`Faltan campos: ${faltantes.join(', ')}`)
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
  if (email && !emailValido(email)) return err('Correo inválido')
  const telefonoCrudo = typeof body.telefono === 'string' ? body.telefono.trim() : ''
  const telefono = telefonoCrudo ? normalizarTelefono(telefonoCrudo) : null
  if (telefonoCrudo && !telefono) return err('Teléfono inválido. Escríbelo con código de país, por ejemplo +58 412 123 4567')
  const v = validarPerfil(body, { permitirNombre: true })
  if (!v.ok) return err(v.error)
  const { nombre, zona, descripcion, servicios, foto_url, youtube_url } = v.datos
  const esDemo = body.es_demo === true
  const apellido = typeof body.apellido === 'string' && body.apellido.trim() ? body.apellido.trim() : null

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('compitas')
    .insert({
      nombre,
      apellido,
      zona,
      descripcion,
      servicios,
      email,
      telefono,
      foto_url: foto_url ?? null,
      youtube_url: youtube_url ?? null,
      horarios_disponibles: [],
      estado: 'inactivo',
      verificado: false,
      visitas_realizadas: 0,
      es_demo: esDemo,
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
