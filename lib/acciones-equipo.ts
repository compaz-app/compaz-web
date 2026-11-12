// Acciones del equipo sobre cuentas, visitas, tareas y reseñas (A-02 de la auditoría). Antes cada ruta de /api/admin tenía sus consultas dentro; ahora
// viven aquí y las rutas solo autentican, validan el cuerpo y responden. Cada función devuelve un resultado, nunca una respuesta HTTP.
import { randomBytes } from 'node:crypto'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, TECLADO_SIN_VISITA } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { sendBienvenidaCliente, sendBienvenidaCompita } from '@/lib/resend'
import { alertaAdmin } from '@/lib/alertas-admin'
import { esc } from '@/lib/html'
import { emailValido, validarPerfil } from '@/lib/validar'
import { normalizarTelefono } from '@/lib/captacion'
import { recortarTexto } from '@/lib/panel-datos'
import { asignarCompita } from '@/lib/usuarios'
import type { Actor } from '@/lib/permisos'
import type { Visita, Compita, Usuario } from '@/types'

export type Res<T = null> = { ok: true; data: T } | { ok: false; status: number; error: string }
const bien = <T,>(data: T): Res<T> => ({ ok: true, data })
const mal = (status: number, error: string): Res<never> => ({ ok: false, status, error })

/** Deja anotado en Actividad QUIÉN hizo qué (O-02): toda acción del equipo sobre una cuenta o una visita pasa por aquí. */
export async function anotarAccion(actorCorreo: string, texto: string, entidad?: { tipo: 'visita' | 'compita' | 'cliente'; id: string; nombre?: string }): Promise<void> {
  await alertaAdmin('actividad', `${esc(actorCorreo)} ${texto}`, { categoria: 'accion_equipo', ...(entidad ? { entidad } : {}) })
}

// ── Tareas (flags) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function listarFlags(actor: Actor, resueltos: boolean): Promise<Res<Record<string, unknown>[]>> {
  const { data, error } = await createAdminSupabase().from('admin_flags').select('*').eq('resuelto', resueltos).order('created_at', { ascending: false })
  if (error) return mal(500, 'No se pudieron leer las tareas')
  // Sin el permiso de teléfonos, las notas llegan sin teléfonos ni correos (se recorta en el servidor).
  return bien((data ?? []).map((f) => ({ ...f, nota: recortarTexto(actor, String(f.nota ?? '')), entidad_nombre: recortarTexto(actor, String(f.entidad_nombre ?? '')) })))
}

export async function crearFlag(correo: string, b: { entidad_tipo: string; entidad_id: string; entidad_nombre?: string; nota: string }): Promise<Res<Record<string, unknown>>> {
  const { data, error } = await createAdminSupabase().from('admin_flags').insert({
    entidad_tipo: b.entidad_tipo, entidad_id: b.entidad_id, entidad_nombre: b.entidad_nombre ?? '', nota: b.nota.trim(),
    reportado_por: correo, // identidad de la sesión, no del cuerpo
    resuelto: false,
  }).select().single()
  if (error) { console.error('[flags] crear:', error.message); return mal(500, 'No se pudo crear la tarea') }
  return bien(data as Record<string, unknown>)
}

export async function resolverFlag(flagId: string, correo: string): Promise<Res> {
  const admin = createAdminSupabase()
  const { data: previa } = await admin.from('admin_flags').select('entidad_nombre, resuelto').eq('id', flagId).maybeSingle()
  const { error } = await admin.from('admin_flags').update({ resuelto: true, resuelto_at: new Date().toISOString() }).eq('id', flagId)
  if (error) return mal(500, 'No se pudo resolver la tarea')
  // Queda anotado QUIÉN resolvió qué (el equipo se reparte la bandeja y esto evita duplicar trabajo).
  if (previa && !(previa as { resuelto: boolean }).resuelto) await alertaAdmin('actividad', `Tarea resuelta por ${correo}: ${String((previa as { entidad_nombre: string }).entidad_nombre ?? '')}`)
  return bien(null)
}

// ── Reseñas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function publicarResena(id: string, publicada: boolean, actorCorreo: string): Promise<Res<Record<string, unknown> | null>> {
  const { data, error } = await createAdminSupabase().from('resenas').update({ publicada }).eq('id', id).select().maybeSingle()
  if (error) return mal(500, 'Error al actualizar la reseña')
  await anotarAccion(actorCorreo, `${publicada ? 'publicó' : 'ocultó'} una reseña`)
  return bien((data ?? null) as Record<string, unknown> | null)
}

// ── Solicitudes y visitas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function completarSolicitud(id: string, actorCorreo: string): Promise<Res> {
  const { data, error } = await createAdminSupabase().from('solicitudes').update({ estado: 'completada' }).eq('id', id).eq('estado', 'aceptada').select('id').maybeSingle()
  if (error) return mal(500, 'No se pudo completar la solicitud')
  if (!data) return mal(409, 'La solicitud no existe o ya no estaba aceptada')
  await anotarAccion(actorCorreo, 'marcó una solicitud como completada')
  return bien(null)
}

export async function forzarCierreVisita(visitaId: string, actorCorreo: string): Promise<Res<{ visita_id: string }>> {
  const { data: visita, error } = await createAdminSupabase().from('visitas')
    .update({ estado: 'terminada', fin: new Date().toISOString(), room_url: null, llamada_solicitada_at: null })
    .eq('id', visitaId).in('estado', ['en_curso', 'confirmando_inicio'])
    .select('*, compita:compitas(id, nombre, telegram_chat_id), usuario:usuarios(nombre, email)')
    .maybeSingle() as { data: (Visita & { compita: Compita; usuario: Usuario }) | null; error: unknown }
  if (error) return mal(500, 'No se pudo cerrar la visita')
  if (!visita) return mal(404, 'Visita no encontrada o ya cerrada')
  // Avisar al compita por Telegram
  if (visita.compita?.telegram_chat_id) {
    sendTelegramMessage(visita.compita.telegram_chat_id, 'ℹ️ El equipo cerró la visita manualmente. Si tienes preguntas, escríbenos a hola@micompaz.com.', TECLADO_SIN_VISITA)
      .catch((e) => console.error('[forzar-cierre] telegram compita:', e))
  }
  await anotarAccion(actorCorreo, `cerró a la fuerza la visita de ${esc(visita.usuario?.nombre ?? '—')} con ${esc(visita.compita?.nombre ?? '—')}`, { tipo: 'visita', id: visitaId, nombre: visita.usuario?.nombre ?? undefined })
  return bien({ visita_id: visitaId })
}

// ── Cuentas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function generarInvitacionCompita(actorCorreo: string): Promise<Res<{ url: string; token: string }>> {
  const token = randomBytes(20).toString('hex')
  const { error } = await createAdminSupabase().from('onboarding_tokens').insert({ token, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), usado: false })
  if (error) return mal(500, 'No se pudo generar el enlace')
  await anotarAccion(actorCorreo, 'generó un enlace de registro de compita')
  return bien({ url: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding?token=${token}`, token })
}

export async function subirFotoCompita(buffer: Buffer, contentType: string, ext: string, nombre: string): Promise<Res<{ url: string }>> {
  const admin = createAdminSupabase()
  const slug = nombre.slice(0, 40).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const path = `compitas/${slug}-${Date.now()}.${ext}`
  const { error } = await admin.storage.from('fotos').upload(path, buffer, { contentType, upsert: false })
  if (error) return mal(500, 'Error al subir la imagen')
  return bien({ url: admin.storage.from('fotos').getPublicUrl(path).data.publicUrl })
}

export async function invitarCliente(nombre: string, email: string, actorCorreo: string): Promise<Res<{ email: string; nombre: string }>> {
  const admin = createAdminSupabase()
  const YA = 'Este cliente ya está registrado y no se le puede enviar otra invitación. Si no puede entrar, dile que pida un enlace nuevo en micompaz.com/login.'
  const { data: existente } = await admin.from('usuarios').select('id').eq('email', email).maybeSingle()
  if (existente) return mal(409, YA)
  // Crear la cuenta y obtener el enlace de activación (sin que Supabase envíe correo)
  const link = await admin.auth.admin.generateLink({ type: 'invite', email, options: { data: { nombre } } })
  if (link.error && (link.error.code === 'email_exists' || /already|registered|exists/i.test(link.error.message))) return mal(409, YA)
  if (link.error || !link.data?.user || !link.data.properties?.hashed_token) {
    console.error('[invitar-cliente] generateLink falló:', link.error?.code, link.error?.message)
    return mal(500, 'No se pudo generar el enlace')
  }
  const { user, properties } = link.data
  const { error: eU } = await admin.from('usuarios').upsert({ id: user.id, email, nombre }, { onConflict: 'id', ignoreDuplicates: true })
  if (eU) console.error('[invitar-cliente] upsert usuarios falló:', eU.message)
  const tipo = properties.verification_type ?? 'invite'
  const enlace = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(properties.hashed_token)}&type=${tipo}`
  try { await sendBienvenidaCliente(email, nombre, enlace) } catch (e) {
    console.error('[invitar-cliente] correo falló:', e)
    // Deshacer la cuenta recién creada: si no, quedaría "ya registrada" sin que la persona haya recibido nada
    const { error: eDel } = await admin.auth.admin.deleteUser(user.id)
    if (eDel) console.error('[invitar-cliente] no se pudo deshacer la cuenta:', eDel.message)
    return mal(502, 'No se pudo enviar el correo de invitación. No se creó la cuenta: vuelve a pulsar Invitar para reintentar.')
  }
  await anotarAccion(actorCorreo, `invitó a un cliente (${esc(nombre)})`, { tipo: 'cliente', id: user.id, nombre })
  return bien({ email, nombre })
}

export async function registrarCompitaManual(body: Record<string, unknown>, actorCorreo: string): Promise<Res<Record<string, unknown>>> {
  const faltantes: string[] = []
  if (!body.nombre) faltantes.push('nombre')
  if (!body.zona) faltantes.push('zona')
  if (!body.descripcion) faltantes.push('descripción')
  if (!Array.isArray(body.servicios) || !body.servicios.length) faltantes.push('al menos un servicio')
  if (faltantes.length) return mal(400, `Faltan campos: ${faltantes.join(', ')}`)
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
  if (email && !emailValido(email)) return mal(400, 'Correo inválido')
  const telefonoCrudo = typeof body.telefono === 'string' ? body.telefono.trim() : ''
  const telefono = telefonoCrudo ? normalizarTelefono(telefonoCrudo) : null
  if (telefonoCrudo && !telefono) return mal(400, 'Teléfono inválido. Escríbelo con código de país, por ejemplo +58 412 123 4567')
  const v = validarPerfil(body, { permitirNombre: true })
  if (!v.ok) return mal(400, v.error)
  const { nombre, zona, descripcion, servicios, foto_url, youtube_url } = v.datos
  const apellido = typeof body.apellido === 'string' && body.apellido.trim() ? body.apellido.trim() : null
  const { data, error } = await createAdminSupabase().from('compitas').insert({
    nombre, apellido, zona, descripcion, servicios, email, telefono, foto_url: foto_url ?? null, youtube_url: youtube_url ?? null,
    horarios_disponibles: [], estado: 'inactivo', verificado: false, visitas_realizadas: 0, es_demo: body.es_demo === true,
  }).select('*').single()
  if (error) return mal(500, 'No se pudo registrar al compita')
  if (email) {
    try { await sendBienvenidaCompita(email, nombre ?? '', process.env.TELEGRAM_BOT_USERNAME ?? '') } catch (e) { console.error('Error enviando email bienvenida compita:', e) }
  }
  await anotarAccion(actorCorreo, `registró a un compita (${esc(nombre ?? '')})`, { tipo: 'compita', id: String((data as { id: string }).id), nombre: nombre ?? undefined })
  return bien(data as Record<string, unknown>)
}

/** Al verificar a un compita hay que avisarle (el bot le dijo que "le avisaríamos cuando estuviera verificada"). */
export async function avisarCompitaVerificada(compitaId: string): Promise<'telegram' | 'correo' | null> {
  const { data: c } = await createAdminSupabase().from('compitas').select('nombre, email, telegram_chat_id, estado, verificado').eq('id', compitaId).maybeSingle()
  if (!c || c.estado !== 'activo' || !c.verificado) return null
  if (c.telegram_chat_id) {
    try {
      await sendTelegramMessage(c.telegram_chat_id,
        `✅ <b>¡Tu cuenta fue verificada, ${esc(c.nombre)}!</b>\n\nYa apareces ante las familias. Cuando una quiera conocerte, te llegará aquí un mensaje con los horarios para elegir.`, TECLADO_SIN_VISITA)
      return 'telegram'
    } catch (e) { console.error('[verificar] Telegram a la compita falló:', e) }
  }
  if (c.email) {
    const bot = process.env.TELEGRAM_BOT_USERNAME
    try {
      await sendEmail({
        to: c.email, subject: 'Tu perfil en Compaz fue verificado',
        html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h2 style="color:#2D1464;font-size:22px">¡Tu perfil fue verificado, ${esc(c.nombre.split(' ')[0])}!</h2>
          <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Para aparecer ante las familias y recibir solicitudes, falta que conectes Telegram: abre el bot y pulsa <strong>Iniciar</strong>.</p>
          ${bot ? `<a href="https://t.me/${encodeURIComponent(bot)}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px">Abrir el bot de Telegram →</a>` : ''}
          <p style="color:#9990A8;font-size:13px;margin-top:28px">Compaz, <em>Cerca aunque estés lejos</em></p></div>`,
      })
      return 'correo'
    } catch (e) { console.error('[verificar] correo a la compita falló:', e) }
  }
  return null
}

export async function nombreDelCliente(id: string): Promise<string | null> {
  const { data } = await createAdminSupabase().from('usuarios').select('nombre').eq('id', id).maybeSingle()
  return (data as { nombre?: string } | null)?.nombre ?? null
}

/** Asignación por enlace de un solo uso (el que recibe el administrador por correo o Telegram). */
export type ResultadoAsignacion = { ok: true } | { ok: false; titulo: string; texto: string; status: number }
export async function asignarPorEnlace(token: string): Promise<ResultadoAsignacion> {
  const admin = createAdminSupabase()
  const { data: actionToken } = await admin.from('action_tokens').select('*').eq('token', token).maybeSingle()
  if (!actionToken) return { ok: false, titulo: 'Token inválido', texto: 'El enlace no es válido.', status: 401 }
  if (new Date(actionToken.expires_at) < new Date()) return { ok: false, titulo: 'Enlace expirado', texto: 'Este enlace venció.', status: 410 }
  // Reclamo atómico (WHERE usado = false)
  const { data: claimed } = await admin.from('action_tokens').update({ usado: true }).eq('id', actionToken.id).eq('usado', false).select('id').maybeSingle()
  if (!claimed) return { ok: false, titulo: 'Enlace usado', texto: 'Este enlace ya fue usado.', status: 410 }
  try { await asignarCompita(actionToken.cliente_id, actionToken.compita_id) } catch (e) {
    // Liberar el token: el administrador puede reintentar si falló nuestra parte
    await admin.from('action_tokens').update({ usado: false }).eq('id', actionToken.id)
    console.error('[asignar-rapido] error:', e)
    return { ok: false, titulo: 'No se pudo asignar', texto: e instanceof Error ? e.message : 'Error interno', status: 409 }
  }
  const [{ data: cliente }, { data: compita }] = await Promise.all([
    admin.from('usuarios').select('nombre, email, familiar_nombre, familiar_edad, familiar_condicion, familiar_notas').eq('id', actionToken.cliente_id).single(),
    admin.from('compitas').select('nombre, zona, descripcion, telegram_chat_id').eq('id', actionToken.compita_id).single(),
  ])
  if (cliente && compita) {
    if (compita.telegram_chat_id) {
      const perfil: string[] = []
      if (cliente.familiar_nombre) perfil.push(`<b>Nombre:</b> ${esc(cliente.familiar_nombre)}`)
      if (cliente.familiar_edad) perfil.push(`<b>Edad:</b> ${esc(cliente.familiar_edad)} años`)
      if (cliente.familiar_condicion) perfil.push(`<b>Condición:</b> ${esc(cliente.familiar_condicion)}`)
      if (cliente.familiar_notas) perfil.push(`<b>Notas:</b> ${esc(cliente.familiar_notas)}`)
      try {
        await sendTelegramMessage(compita.telegram_chat_id, [
          `🎉 <b>¡Tienes un nuevo cliente!</b>`, ``, `<b>${esc(cliente.nombre)}</b> fue asignado a tu cuenta.`,
          ...(perfil.length ? [``, `🧓 <b>Sobre el familiar que vas a atender:</b>`, ...perfil] : []), ``,
          `👋 <b>Saluda a ${esc(cliente.nombre.split(' ')[0])}</b> desde este chat para arrancar la coordinación. Ellos lo verán en su portal.`, ``,
          `💙 Toda la comunicación debe mantenerse dentro de Compaz.`,
        ].join('\n'))
      } catch (e) { console.error('Telegram asignar-rapido compita:', e) }
    }
    try {
      await sendEmail({
        to: cliente.email, subject: `Tu Compita está lista: ${compita.nombre}`,
        html: `<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #2D1464; font-size: 24px; margin-bottom: 16px;">¡Hola, ${esc(cliente.nombre)}!</h2>
          <p style="color: #4A3B6B; font-size: 16px; line-height: 1.6;">Te asignamos a <strong>${esc(compita.nombre)}</strong> como tu Compita. ${compita.zona ? `Cubre la zona de <strong>${esc(compita.zona)}</strong>.` : ''}</p>
          ${compita.descripcion ? `<p style="color: #6B5C90; font-size: 15px; line-height: 1.7;">${esc(compita.descripcion)}</p>` : ''}
          <a href="${SITE_URL}/dashboard" style="display:inline-block; background:#FF6B2B; color:white; border-radius:9999px; padding:14px 28px; font-weight:800; font-size:16px; text-decoration:none;">Ir a mi portal →</a></div>`,
      })
    } catch (e) { console.error('Error email asignación:', e) }
  }
  return { ok: true }
}
