// Corregir el registro de un compita justo después de crearlo (antes de conectar Telegram). Caso típico: escribió mal el correo, y como el bot le manda un
// código a ese correo, se quedaría sin poder entrar. Se autoriza con un enlace de edición de un solo uso que recibe la propia pantalla de registro, y solo
// mientras el compita NO haya conectado Telegram: una vez conectado, su correo ya es su identidad y no se cambia por aquí.
import { createAdminSupabase } from '@/lib/supabase-server'
import { generarTokenPerfil, validarTokenPerfil } from '@/lib/compita-tokens'
import { validarPerfil, revisarCorreo } from '@/lib/validar'
import { normalizarTelefono } from '@/lib/captacion'
import { sendBienvenidaCompita } from '@/lib/resend'

export type ResultadoCorreccion = { ok: true; editToken: string } | { ok: false; status: number; error: string }

export async function corregirRegistroCompita(editToken: string, body: Record<string, unknown>): Promise<ResultadoCorreccion> {
  const compitaId = await validarTokenPerfil(editToken)
  if (!compitaId) return { ok: false, status: 410, error: 'Este enlace para corregir tus datos ya no sirve. Escríbenos a hola@micompaz.com.' }
  const admin = createAdminSupabase()
  const { data: actual } = await admin.from('compitas').select('email, telegram_chat_id').eq('id', compitaId).maybeSingle()
  if (!actual) return { ok: false, status: 404, error: 'No encontramos tu perfil' }
  if (actual.telegram_chat_id) return { ok: false, status: 409, error: 'Ya conectaste Telegram, así que tus datos de acceso no se pueden cambiar desde aquí. Escríbenos a hola@micompaz.com.' }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const rev = revisarCorreo(email)
  if (!rev.ok) return { ok: false, status: 400, error: rev.error }
  const telefono = typeof body.telefono === 'string' ? normalizarTelefono(body.telefono) : null
  if (!telefono) return { ok: false, status: 400, error: 'Teléfono inválido. Escríbelo con código de país, por ejemplo +58 412 123 4567' }
  const v = validarPerfil(body, { permitirNombre: true })
  if (!v.ok) return { ok: false, status: 400, error: v.error }
  const { nombre, zona, descripcion, servicios, foto_url, youtube_url, horarios_disponibles } = v.datos
  const habil = typeof body.habilidades === 'string' ? body.habilidades.trim().slice(0, 500) : ''

  const { error } = await admin.from('compitas').update({
    nombre, email, telefono, zona, descripcion: habil ? `${descripcion}\n\nHabilidades especiales: ${habil}` : descripcion, servicios,
    ...(foto_url ? { foto_url } : {}), youtube_url: youtube_url ?? null, horarios_disponibles: horarios_disponibles ?? [],
  }).eq('id', compitaId).is('telegram_chat_id', null)
  if (error) return { ok: false, status: 500, error: 'No se pudieron guardar los cambios' }

  // Si cambió el correo, la bienvenida (con los pasos de Telegram) va al correo NUEVO.
  if (email.toLowerCase() !== String(actual.email ?? '').toLowerCase()) {
    try { await sendBienvenidaCompita(email, nombre ?? '', process.env.TELEGRAM_BOT_USERNAME ?? '') } catch (e) { console.error('[onboarding] bienvenida tras corregir:', e) }
  }
  return { ok: true, editToken: await generarTokenPerfil(compitaId) }
}
