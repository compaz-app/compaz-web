// Eliminar mi cuenta (decidido 2026-11-10; ver docs/prototipo-cambios.md y project-eliminar-cuenta).
//   1. solicitarEliminacion  → genera un enlace de UN solo uso (vence en 1 hora; en la base solo queda su huella).
//   2. confirmarEliminacion  → la cuenta queda DESACTIVADA ya y se borra a los 7 días. Cancela lo abierto sin costo.
//   3. reactivarCuenta       → si entra antes de los 7 días, todo sigue como estaba.
//   4. borrarCuentasVencidas → (limpieza diaria) vacía los datos personales y conserva el nombre con la marca "(cuenta eliminada)" y el historial.
// El saldo no se reembolsa solo (las visitas caducan a los 60 días): los reembolsos se tratan con el equipo.
import { createHash, randomBytes } from 'node:crypto'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendEmail, SITE_URL } from '@/lib/email'
import { sendTelegramMessage } from '@/lib/telegram'
import { borrarFotosDeUsuario, programarBorradoVisita } from '@/lib/fotos-privadas'
import { registrarCancelacion } from '@/lib/cancelaciones'
import { registrarEvento, type ActorEvento } from '@/lib/eventos'
import { alertaAdmin } from '@/lib/alertas-admin'
import { explicarEspera, type Espera } from '@/lib/esperas'

export const PLAZO_BORRADO_DIAS = 7
export const VIGENCIA_ENLACE_MIN = 60
export const ESPERA_ENLACE_MIN = 10
const DIA = 86_400_000

const huella = (token: string) => createHash('sha256').update(token).digest('hex')
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

interface Fila {
  id: string; nombre: string | null; email: string | null
  eliminar_enlace_hash: string | null; eliminar_enlace_vence: string | null; eliminar_enlace_pedido: string | null
  eliminacion_programada_en: string | null; eliminada_en: string | null
}
const COLS = 'id, nombre, email, eliminar_enlace_hash, eliminar_enlace_vence, eliminar_enlace_pedido, eliminacion_programada_en, eliminada_en'

async function usuario(id: string): Promise<Fila | null> {
  const { data } = await createAdminSupabase().from('usuarios').select(COLS).eq('id', id).maybeSingle()
  return (data as Fila | null) ?? null
}

/** Una visita que ya empezó (llegó el compita, o está en curso) no se puede dejar a medias: hay que esperar a que termine. */
async function visitaEnVivo(usuarioId: string): Promise<boolean> {
  const { data } = await createAdminSupabase().from('visitas').select('id').eq('usuario_id', usuarioId).in('estado', ['confirmando_inicio', 'en_curso']).limit(1)
  return ((data ?? []) as unknown[]).length > 0
}

export type ResultadoSolicitud =
  | { ok: true }
  | { ok: false; motivo: 'no_existe' | 'ya_programada' | 'visita_en_vivo' }
  | { ok: false; motivo: 'espera'; espera: Espera }

/** El cliente pide eliminar su cuenta: se le envía el enlace de confirmación (nada se borra todavía). */
export async function solicitarEliminacion(usuarioId: string, ahora: Date = new Date()): Promise<ResultadoSolicitud> {
  const u = await usuario(usuarioId)
  if (!u || u.eliminada_en) return { ok: false, motivo: 'no_existe' }
  if (u.eliminacion_programada_en) return { ok: false, motivo: 'ya_programada' }
  if (await visitaEnVivo(usuarioId)) return { ok: false, motivo: 'visita_en_vivo' }
  const ventana = ESPERA_ENLACE_MIN * 60_000
  if (u.eliminar_enlace_pedido && ahora.getTime() - new Date(u.eliminar_enlace_pedido).getTime() < ventana) {
    return { ok: false, motivo: 'espera', espera: explicarEspera('eliminar_cuenta_enlace', { desde: u.eliminar_enlace_pedido, duracionMs: ventana, ahora }) }
  }
  const token = randomBytes(32).toString('hex')
  await createAdminSupabase().from('usuarios').update({
    eliminar_enlace_hash: huella(token), eliminar_enlace_pedido: ahora.toISOString(),
    eliminar_enlace_vence: new Date(ahora.getTime() + VIGENCIA_ENLACE_MIN * 60_000).toISOString(),
  }).eq('id', usuarioId)
  await sendEmail({
    to: u.email ?? '', subject: 'Confirma que quieres eliminar tu cuenta de Compaz',
    html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#FDFAF6">
      <h2 style="color:#2D1464;font-size:24px">Hola, ${esc((u.nombre ?? '').split(' ')[0] || 'bienvenido')}</h2>
      <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Pediste eliminar tu cuenta. Si fuiste tú, confírmalo con este botón. Tu cuenta se desactiva en ese momento y se borra por completo a los ${PLAZO_BORRADO_DIAS} días. Si entras antes, puedes reactivarla.</p>
      <a href="${SITE_URL}/cuenta/eliminar?t=${token}" style="display:inline-block;background:#FF6B2B;color:white;padding:16px 32px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:17px">Sí, eliminar mi cuenta</a>
      <p style="color:#6B5C90;font-size:13px;line-height:1.6;margin-top:16px">El enlace funciona una sola vez y vence en ${VIGENCIA_ENLACE_MIN} minutos. Si no lo pediste tú, ignora este correo: no pasa nada.</p>
    </div>`,
  })
  await registrarEvento({ entidad: 'cliente', entidadId: usuarioId, tipo: 'eliminacion_solicitada', actor: `cliente:${usuarioId}` })
  return { ok: true }
}

export type ResultadoConfirmacion = { ok: true; borraEl: string; visitasCanceladas: number } | { ok: false; motivo: 'enlace_invalido' | 'enlace_vencido' | 'visita_en_vivo' }

/** Cancela lo abierto del cliente SIN costo: la visita desaparece (se devuelve el crédito) y al compita se le avisa sin decirle por qué. */
async function cancelarAbiertas(usuarioId: string, ahora: Date): Promise<number> {
  const admin = createAdminSupabase()
  const { data: vs } = await admin.from('visitas').select('id, compita_id, created_at, fecha_programada, hora_inicio_programada, llegada_en, compitas(nombre, telegram_chat_id)')
    .eq('usuario_id', usuarioId).in('estado', ['pre_visita', 'programada'])
  let n = 0
  for (const v of (vs ?? []) as unknown as { id: string; compita_id: string; created_at: string; fecha_programada: string | null; hora_inicio_programada: string | null; llegada_en: string | null; compitas: { nombre: string; telegram_chat_id: string | null } | null }[]) {
    const id = await registrarCancelacion({ visitaId: v.id, compitaId: v.compita_id, usuarioId, canceladoPor: 'cliente', fechaProgramada: v.fecha_programada, horaInicioProgramada: v.hora_inicio_programada, motivo: null, visitaCreadaEn: v.created_at, ahora })
    // Cancelar por cierre de cuenta no cuenta contra nadie: queda justificada y el compita no se ve afectado.
    if (id) await admin.from('cancelaciones').update({ justificada: true, justificada_por: 'sistema: cuenta eliminada', justificada_en: ahora.toISOString() }).eq('id', id)
    if (v.llegada_en) await programarBorradoVisita(v.id, ahora)
    await admin.from('visitas').delete().eq('id', v.id)
    if (v.compitas?.telegram_chat_id) {
      try { await sendTelegramMessage(v.compitas.telegram_chat_id, '👋 Se canceló tu próxima visita. No tienes que hacer nada: esta cancelación no cuenta en tu contra.') } catch (e) { console.error('[cuenta-eliminar] Telegram compita:', e) }
    }
    n++
  }
  await admin.from('solicitudes').update({ estado: 'rechazada', respondido_at: ahora.toISOString() }).eq('cliente_id', usuarioId).in('estado', ['pendiente', 'aceptada'])
  await admin.from('reservas_horario').update({ estado: 'liberada', resuelta_en: ahora.toISOString() }).eq('cliente_id', usuarioId).in('estado', ['reservada', 'confirmada'])
  return n
}

/** El cliente abrió el enlace del correo: la cuenta queda desactivada y con fecha de borrado. */
export async function confirmarEliminacion(token: string, ahora: Date = new Date()): Promise<ResultadoConfirmacion> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false, motivo: 'enlace_invalido' }
  const admin = createAdminSupabase()
  const { data } = await admin.from('usuarios').select(COLS).eq('eliminar_enlace_hash', huella(token)).maybeSingle()
  const u = data as Fila | null
  if (!u || u.eliminada_en) return { ok: false, motivo: 'enlace_invalido' }
  if (!u.eliminar_enlace_vence || new Date(u.eliminar_enlace_vence).getTime() < ahora.getTime()) return { ok: false, motivo: 'enlace_vencido' }
  if (await visitaEnVivo(u.id)) return { ok: false, motivo: 'visita_en_vivo' }
  const borraEl = new Date(ahora.getTime() + PLAZO_BORRADO_DIAS * DIA).toISOString()
  // El enlace se gasta en el mismo paso: no se puede usar dos veces.
  const { data: ok } = await admin.from('usuarios').update({ eliminacion_programada_en: borraEl, eliminar_enlace_hash: null, eliminar_enlace_vence: null })
    .eq('id', u.id).eq('eliminar_enlace_hash', huella(token)).select('id').maybeSingle()
  if (!ok) return { ok: false, motivo: 'enlace_invalido' }
  const visitasCanceladas = await cancelarAbiertas(u.id, ahora)
  await registrarEvento({ entidad: 'cliente', entidadId: u.id, tipo: 'eliminacion_confirmada', actor: `cliente:${u.id}`, datos: { borra_el: borraEl, visitas_canceladas: visitasCanceladas } })
  await alertaAdmin('actividad', `🗑️ <b>${esc(u.nombre ?? 'Un cliente')}</b> pidió eliminar su cuenta. Se borra el ${borraEl.slice(0, 10)}${visitasCanceladas ? ` y se cancelaron ${visitasCanceladas} visita(s) abiertas sin costo` : ''}. Si tenía saldo, los reembolsos se tratan con el equipo.`, { categoria: 'cuenta_eliminada', entidad: { tipo: 'cliente', id: u.id, nombre: u.nombre ?? 'cliente' } })
  try {
    await sendEmail({
      to: u.email ?? '', subject: 'Tu cuenta de Compaz se borrará en 7 días',
      html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#FDFAF6"><p style="color:#4A3B6B;font-size:16px;line-height:1.6">Tu cuenta quedó desactivada y se borrará por completo el ${borraEl.slice(0, 10)}. Si cambias de idea, entra con tu correo antes de esa fecha y la reactivas.</p></div>`,
    })
  } catch (e) { console.error('[cuenta-eliminar] correo de confirmación:', e) }
  return { ok: true, borraEl, visitasCanceladas }
}

/** Entró antes de que se cumpliera el plazo: la cuenta sigue como estaba. */
export async function reactivarCuenta(usuarioId: string): Promise<boolean> {
  const { data } = await createAdminSupabase().from('usuarios').update({ eliminacion_programada_en: null })
    .eq('id', usuarioId).not('eliminacion_programada_en', 'is', null).is('eliminada_en', null).select('id').maybeSingle()
  if (!data) return false
  await registrarEvento({ entidad: 'cliente', entidadId: usuarioId, tipo: 'eliminacion_cancelada', actor: `cliente:${usuarioId}` })
  return true
}

/** ¿Está la cuenta desactivada a la espera del borrado? (y cuándo se borra) */
export async function estadoEliminacion(usuarioId: string): Promise<{ desactivada: boolean; borraEl: string | null }> {
  const u = await usuario(usuarioId)
  return { desactivada: !!u && (!!u.eliminacion_programada_en || !!u.eliminada_en), borraEl: u?.eliminacion_programada_en ?? null }
}

/** Marca que acompaña al nombre de una cuenta eliminada por el equipo: en todo registro pasado se lee "Ana Pérez (cuenta eliminada)". */
export const MARCA_ELIMINADA = '(cuenta eliminada)'
export const esCuentaEliminada = (nombre: string | null | undefined) => {
  const n = (nombre ?? '').trim()
  return n.endsWith(MARCA_ELIMINADA) || n === 'Cuenta eliminada'
}
export const nombreDeCuentaEliminada = (nombre: string | null | undefined) => {
  const n = (nombre ?? '').trim()
  if (esCuentaEliminada(n)) return n
  return n ? `${n} ${MARCA_ELIMINADA}` : 'Cuenta eliminada'
}

/** Un paso de borrado: si la base responde con error se anota y se devuelve false (el cierre NO se da por hecho y se puede reintentar). */
async function paso(nombre: string, q: PromiseLike<{ error: { message: string } | null }>): Promise<boolean> {
  const { error } = await q
  if (error) { console.error(`[cuenta-eliminar] ${nombre}:`, error.message); return false }
  return true
}

/**
 * Al anonimizar (la persona pidió borrar sus datos) el nombre no puede quedar repetido en otras tablas (S-08): se borran sus notas internas y, en los
 * registros de actividad y las tareas, el nombre se cambia por "Cuenta eliminada" (también dentro del texto). Los registros en sí se conservan.
 * Devuelve false si algún paso falló.
 */
async function olvidarNombreEn(tipo: 'cliente' | 'compita', id: string, nombre: string | null | undefined): Promise<boolean> {
  const admin = createAdminSupabase()
  let bien = true
  bien = (await paso('notas', admin.from('notas_persona').delete().eq('persona_tipo', tipo).eq('persona_id', id))) && bien
  bien = (await paso('tareas', admin.from('admin_flags').update({ entidad_nombre: 'Cuenta eliminada' }).eq('entidad_tipo', tipo).eq('entidad_id', id))) && bien
  bien = (await paso('actividad', admin.from('actividad_admin').update({ entidad_nombre: 'Cuenta eliminada' }).eq('entidad_tipo', tipo).eq('entidad_id', id))) && bien
  const limpio = (nombre ?? '').replace(MARCA_ELIMINADA, '').trim()
  if (limpio.length < 2) return bien
  for (const tabla of ['actividad_admin', 'admin_flags'] as const) {
    const col = tabla === 'actividad_admin' ? 'resumen' : 'nota'
    const { data } = await admin.from(tabla).select(`id, ${col}`).eq('entidad_tipo', tipo).eq('entidad_id', id).limit(500)
    for (const f of (data ?? []) as unknown as Record<string, string>[]) {
      if (typeof f[col] === 'string' && f[col].includes(limpio)) bien = (await paso(`texto en ${tabla}`, admin.from(tabla).update({ [col]: f[col].split(limpio).join('Cuenta eliminada') }).eq('id', f.id))) && bien
    }
  }
  return bien
}

/**
 * Cierra una cuenta de cliente. Dos modos (decidido 2026-11-11):
 *  - anonimizar = true (la persona PIDIÓ que se borren sus datos): se vacían nombre, correo, teléfono, ficha del familiar, dirección, notas, fotos
 *    (con su archivo), mensajes, el texto de sus reportes de visita y de sus reseñas. Quedan, sin datos que la identifiquen, los pagos y los registros
 *    de visitas (contabilidad y seguridad).
 *  - anonimizar = false (la cierra el equipo sin que lo haya pedido): se CONSERVA la información (nombre con la marca "(cuenta eliminada)", ficha,
 *    visitas, mensajes, fotos y pagos). Solo se cierra el acceso y se libera el correo; el correo anterior queda en el registro de eventos.
 * Todo paso se comprueba: si uno falla devuelve false y la cuenta NO se marca como cerrada, para poder reintentar (el cron diario lo reintenta solo).
 * El acceso se cierra de dos maneras: la marca eliminada_en (la comprueba getClienteActivo) y el bloqueo de la cuenta de acceso.
 */
async function cerrarCuentaCliente(id: string, ahora: Date, actor: ActorEvento, anonimizar: boolean): Promise<boolean> {
  const admin = createAdminSupabase()
  const { data: actual } = await admin.from('usuarios').select('nombre, email, eliminada_en').eq('id', id).maybeSingle()
  const antes = actual as { nombre?: string | null; email?: string | null; eliminada_en?: string | null } | null
  const correoNuevo = `eliminada-${id}@compaz.invalid`
  if (anonimizar) {
    if ((await borrarFotosDeUsuario(id)) > 0) return false // si una foto no se pudo borrar no se sigue: se reintenta
    const { data: vs } = await admin.from('visitas').select('id').eq('usuario_id', id)
    const visitaIds = ((vs ?? []) as { id: string }[]).map((v) => v.id)
    let bien = true
    if (visitaIds.length) {
      bien = (await paso('mensajes', admin.from('mensajes').delete().in('visit_id', visitaIds))) && bien
      bien = (await paso('reportes de visita', admin.from('reportes_visita').update({ novedad: null, resumen_ia: null }).in('visita_id', visitaIds))) && bien
      bien = (await paso('visitas', admin.from('visitas').update({ direccion: null, ficha_personas: null }).eq('usuario_id', id))) && bien
    }
    bien = (await paso('reseñas', admin.from('resenas').update({ texto: '(texto eliminado)' }).eq('cliente_id', id))) && bien
    bien = (await paso('solicitudes', admin.from('solicitudes').update({ mensaje: '' }).eq('cliente_id', id))) && bien
    bien = (await olvidarNombreEn('cliente', id, antes?.nombre)) && bien
    // La cuenta solo se marca como cerrada si TODO lo anterior salió bien: si no, queda como estaba y se puede reintentar.
    if (!bien) return false
    bien = (await paso('cuenta', admin.from('usuarios').update({
      nombre: 'Cuenta eliminada', email: correoNuevo, telefono: null, zona: null, pais: null, parentesco: null,
      familiar_nombre: null, familiar_edad: null, familiar_condicion: null, familiar_notas: null, ficha_personas: null,
      eliminada_en: antes?.eliminada_en ?? ahora.toISOString(), eliminacion_programada_en: null, eliminar_enlace_hash: null, eliminar_enlace_vence: null,
    }).eq('id', id))) && bien
    if (!bien) return false
  } else {
    if (!(await paso('cuenta', admin.from('usuarios').update({
      nombre: nombreDeCuentaEliminada(antes?.nombre), email: correoNuevo,
      eliminada_en: ahora.toISOString(), eliminacion_programada_en: null, eliminar_enlace_hash: null, eliminar_enlace_vence: null,
    }).eq('id', id)))) return false
  }
  // Se cierra el acceso para siempre (el registro sigue por contabilidad e historial). Si esto falla el acceso queda cerrado igual por eliminada_en,
  // pero se anota para revisarlo.
  const { error: eBan } = await admin.auth.admin.updateUserById(id, { email: correoNuevo, ban_duration: '876000h' })
  if (eBan) {
    console.error('[cuenta-eliminar] no se pudo bloquear la cuenta de acceso:', eBan.message)
    await alertaAdmin('tarea', `⚠️ La cuenta de ${anonimizar ? 'un cliente' : esc(antes?.nombre ?? 'un cliente')} quedó cerrada pero NO se pudo bloquear su acceso en el sistema de cuentas. Revísalo en Supabase, Authentication, Users.`, { categoria: 'cuenta_eliminada', entidad: { tipo: 'cliente', id, nombre: 'Cuenta eliminada' } })
  }
  await registrarEvento({ entidad: 'cliente', entidadId: id, tipo: 'cuenta_eliminada', actor, datos: { anonimizada: anonimizar, ...(anonimizar ? {} : { correo_anterior: antes?.email ?? null }) } })
  return true
}

/** Limpieza diaria: borra las cuentas que pidieron eliminarse y cuyo plazo de 7 días se cumplió (siempre anonimiza: lo pidió la persona). */
export async function borrarCuentasVencidas(ahora: Date = new Date()): Promise<{ borradas: number; fallos: number }> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('usuarios').select('id').lte('eliminacion_programada_en', ahora.toISOString()).is('eliminada_en', null)
  let borradas = 0; let fallos = 0
  for (const { id } of (data ?? []) as { id: string }[]) {
    try { if (await cerrarCuentaCliente(id, ahora, 'sistema', true)) borradas++; else fallos++ } catch (e) { console.error('[cuenta-eliminar] no se pudo borrar', id, e); fallos++ }
  }
  return { borradas, fallos }
}

export type ResultadoEliminacionEquipo = { ok: true; visitasCanceladas?: number } | { ok: false; motivo: 'no_existe' | 'ya_eliminada' | 'visita_en_vivo' | 'visitas_abiertas' | 'error' }

/**
 * El equipo (solo administrador raíz) elimina a un cliente YA: cancela lo abierto sin costo y cierra la cuenta. Con borrarDatos (la persona lo pidió)
 * se anonimiza; sin él se conserva la información. Si la cuenta ya estaba cerrada SIN anonimizar y ahora la persona pide que se borren sus datos, con
 * borrarDatos se anonimiza ahora (no hay que "des-eliminarla").
 */
export async function eliminarClientePorEquipo(usuarioId: string, actorCorreo: string, opts: { borrarDatos?: boolean } = {}, ahora: Date = new Date()): Promise<ResultadoEliminacionEquipo> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('usuarios').select('id, nombre, eliminada_en').eq('id', usuarioId).maybeSingle()
  const u = data as { id: string; nombre: string | null; eliminada_en: string | null } | null
  if (!u) return { ok: false, motivo: 'no_existe' }
  if (u.eliminada_en) {
    // Ya cerrada: solo tiene sentido si ahora piden anonimizarla y todavía conserva su nombre.
    if (!opts.borrarDatos || u.nombre === 'Cuenta eliminada') return { ok: false, motivo: 'ya_eliminada' }
    if (!(await cerrarCuentaCliente(u.id, ahora, `admin:${actorCorreo}`, true))) return { ok: false, motivo: 'error' }
    await alertaAdmin('actividad', `🗑️ ${esc(actorCorreo)} anonimizó una cuenta que ya estaba eliminada (la persona pidió que se borren sus datos).`, { categoria: 'cuenta_eliminada', entidad: { tipo: 'cliente', id: u.id, nombre: 'Cuenta eliminada' } })
    return { ok: true }
  }
  if (await visitaEnVivo(u.id)) return { ok: false, motivo: 'visita_en_vivo' }
  const visitasCanceladas = await cancelarAbiertas(u.id, ahora)
  // Una visita pudo pasar a "en vivo" entre la comprobación y la cancelación: se vuelve a mirar antes de cerrar la cuenta (M7).
  if (await visitaEnVivo(u.id)) return { ok: false, motivo: 'visita_en_vivo' }
  if (!(await cerrarCuentaCliente(u.id, ahora, `admin:${actorCorreo}`, opts.borrarDatos === true))) return { ok: false, motivo: 'error' }
  await alertaAdmin('actividad', `🗑️ ${esc(actorCorreo)} eliminó la cuenta de <b>${opts.borrarDatos ? 'un cliente' : esc(u.nombre ?? 'un cliente')}</b>${opts.borrarDatos ? ' (datos borrados a pedido de la persona)' : ' (información conservada)'}${visitasCanceladas ? ` y se cancelaron ${visitasCanceladas} visita(s) abiertas sin costo` : ''}.`, { categoria: 'cuenta_eliminada', entidad: { tipo: 'cliente', id: u.id, nombre: opts.borrarDatos ? 'Cuenta eliminada' : nombreDeCuentaEliminada(u.nombre) } })
  return { ok: true, visitasCanceladas }
}

/** Cancela, sin costo y avisando a cada familia, las solicitudes y reservas que quedaban abiertas con un compita que ya no existe (M3). */
async function cerrarSolicitudesDeCompita(compitaId: string, ahora: Date): Promise<boolean> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('solicitudes').select('id, cliente_id').eq('compita_id', compitaId).in('estado', ['pendiente', 'aceptada'])
  const filas = (data ?? []) as { id: string; cliente_id: string }[]
  if (filas.length === 0) return true
  const ids = filas.map((f) => f.id)
  let bien = await paso('solicitudes del compita', admin.from('solicitudes').update({ estado: 'rechazada', respondido_at: ahora.toISOString() }).in('id', ids))
  bien = (await paso('reservas del compita', admin.from('reservas_horario').update({ estado: 'liberada', resuelta_en: ahora.toISOString() }).in('solicitud_id', ids).in('estado', ['reservada', 'confirmada']))) && bien
  if (!bien) return false
  const { data: cs } = await admin.from('usuarios').select('id, email, nombre').in('id', [...new Set(filas.map((f) => f.cliente_id))])
  for (const c of (cs ?? []) as { id: string; email: string | null; nombre: string | null }[]) {
    if (!c.email) continue
    try {
      await sendEmail({
        to: c.email, subject: 'Tu solicitud en Compaz ya no está disponible',
        html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#FDFAF6"><p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola, ${esc((c.nombre ?? '').split(' ')[0] || 'bienvenido')}. El compita con el que tenías una solicitud ya no está disponible, así que la cerramos sin costo para ti. Entra a tu portal y elige a otro compita cuando quieras: te acompañamos en el proceso.</p><a href="${SITE_URL}/portal" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px">Ir a mi portal →</a></div>`,
      })
    } catch (e) { console.error('[cuenta-eliminar] aviso a la familia:', e) }
  }
  return true
}

/**
 * El equipo (solo administrador raíz) elimina a un compita: deja de existir para el sistema (sin acceso, sin Telegram, sin clientes asignados) y su
 * nombre queda con la marca "(cuenta eliminada)" junto a todas sus visitas y reportes. Se cierran sin costo sus solicitudes abiertas (avisando a las
 * familias). Con borrarDatos (la persona lo pidió) además se borran su perfil, contacto y foto (también el archivo); sin él se conserva la información.
 * No se puede mientras tenga visitas abiertas: primero se cancelan o se pasan a otro compita. Si ya estaba eliminada sin borrar datos, con borrarDatos
 * se anonimiza ahora.
 */
export async function eliminarCompitaPorEquipo(compitaId: string, actorCorreo: string, opts: { borrarDatos?: boolean } = {}, ahora: Date = new Date()): Promise<ResultadoEliminacionEquipo> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('compitas').select('id, nombre, apellido, telegram_chat_id, foto_url').eq('id', compitaId).maybeSingle()
  const c = data as { id: string; nombre: string | null; apellido: string | null; telegram_chat_id: string | null; foto_url: string | null } | null
  if (!c) return { ok: false, motivo: 'no_existe' }
  const completo = [c.nombre, c.apellido].filter(Boolean).join(' ')
  const yaEliminada = esCuentaEliminada(completo)
  if (yaEliminada && (!opts.borrarDatos || completo === 'Cuenta eliminada')) return { ok: false, motivo: 'ya_eliminada' }
  if (!yaEliminada) {
    const { data: abiertas } = await admin.from('visitas').select('id').eq('compita_id', compitaId).in('estado', ['pre_visita', 'programada', 'confirmando_inicio', 'en_curso']).limit(1)
    if (((abiertas ?? []) as unknown[]).length > 0) return { ok: false, motivo: 'visitas_abiertas' }
    if (!(await cerrarSolicitudesDeCompita(compitaId, ahora))) return { ok: false, motivo: 'error' }
    await admin.from('usuarios').update({ compita_id: null }).eq('compita_id', compitaId)
    await admin.from('compita_edit_tokens').delete().eq('compita_id', compitaId)
    if (c.telegram_chat_id) await admin.from('telegram_estados').delete().eq('chat_id', c.telegram_chat_id)
  }
  if (opts.borrarDatos) {
    // La foto de un compita es pública: además de quitar el enlace se borra el archivo del almacenamiento.
    const archivo = c.foto_url?.split('/fotos/')[1]
    if (archivo && (await admin.storage.from('fotos').remove([decodeURIComponent(archivo.split('?')[0])])).error) return { ok: false, motivo: 'error' }
    if (!(await olvidarNombreEn('compita', compitaId, completo))) return { ok: false, motivo: 'error' }
  }
  const cierre = opts.borrarDatos
    ? { nombre: yaEliminada ? 'Cuenta eliminada' : nombreDeCuentaEliminada(completo), apellido: null, email: `eliminada-${compitaId}@compaz.invalid`, telefono: null, telegram_chat_id: null, foto_url: null, descripcion: null, youtube_url: null, zona: null, servicios: [], horarios_disponibles: [], estado: 'bloqueado', verificado: false }
    : { nombre: nombreDeCuentaEliminada(completo), apellido: null, telegram_chat_id: null, estado: 'bloqueado', verificado: false }
  if (!(await paso('compita', admin.from('compitas').update(cierre).eq('id', compitaId)))) return { ok: false, motivo: 'error' }
  await registrarEvento({ entidad: 'compita', entidadId: compitaId, tipo: 'cuenta_eliminada', actor: `admin:${actorCorreo}`, datos: { anonimizada: opts.borrarDatos === true } })
  await alertaAdmin('actividad', `🗑️ ${esc(actorCorreo)} eliminó la cuenta del compita <b>${opts.borrarDatos ? 'sin nombre' : esc(completo || 'sin nombre')}</b>.`, { categoria: 'cuenta_eliminada', entidad: { tipo: 'compita', id: compitaId, nombre: opts.borrarDatos ? 'Cuenta eliminada' : nombreDeCuentaEliminada(completo) } })
  return { ok: true }
}
