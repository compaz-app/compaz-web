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

/**
 * Cierra una cuenta de cliente. Dos modos (decidido 2026-11-11):
 *  - anonimizar = true (la persona PIDIÓ que se borren sus datos): se vacían nombre, correo, teléfono, ficha del familiar, dirección, notas, fotos
 *    (con su archivo) y mensajes. Quedan, sin datos que la identifiquen, los pagos y los registros de visitas (contabilidad y seguridad).
 *  - anonimizar = false (la cierra el equipo sin que lo haya pedido): se CONSERVA la información (nombre con la marca "(cuenta eliminada)", ficha,
 *    visitas, mensajes, fotos y pagos). Solo se cierra el acceso y se libera el correo; el correo anterior queda en el registro de eventos.
 * En ambos modos el acceso se cierra para siempre.
 */
async function cerrarCuentaCliente(id: string, ahora: Date, actor: ActorEvento, anonimizar: boolean): Promise<boolean> {
  const admin = createAdminSupabase()
  const { data: actual } = await admin.from('usuarios').select('nombre, email').eq('id', id).maybeSingle()
  const antes = actual as { nombre?: string | null; email?: string | null } | null
  const correoNuevo = `eliminada-${id}@compaz.invalid`
  if (anonimizar) {
    if ((await borrarFotosDeUsuario(id)) > 0) return false // si una foto no se pudo borrar no se sigue: se reintenta
    const { data: vs } = await admin.from('visitas').select('id').eq('usuario_id', id)
    const visitaIds = ((vs ?? []) as { id: string }[]).map((v) => v.id)
    if (visitaIds.length) {
      await admin.from('mensajes').delete().in('visita_id', visitaIds)
      await admin.from('visitas').update({ direccion: null, ficha_personas: null }).eq('usuario_id', id)
    }
    await admin.from('solicitudes').update({ mensaje: '' }).eq('cliente_id', id)
    await admin.from('usuarios').update({
      nombre: 'Cuenta eliminada', email: correoNuevo, telefono: null, zona: null, pais: null, parentesco: null,
      familiar_nombre: null, familiar_edad: null, familiar_condicion: null, familiar_notas: null, ficha_personas: null,
      eliminada_en: ahora.toISOString(), eliminacion_programada_en: null, eliminar_enlace_hash: null, eliminar_enlace_vence: null,
    }).eq('id', id)
  } else {
    await admin.from('usuarios').update({
      nombre: nombreDeCuentaEliminada(antes?.nombre), email: correoNuevo,
      eliminada_en: ahora.toISOString(), eliminacion_programada_en: null, eliminar_enlace_hash: null, eliminar_enlace_vence: null,
    }).eq('id', id)
  }
  // Se cierra el acceso para siempre (el registro sigue por contabilidad e historial).
  await admin.auth.admin.updateUserById(id, { email: correoNuevo, ban_duration: '876000h' })
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

/** El equipo (solo administrador raíz) elimina a un cliente YA: cancela lo abierto sin costo y cierra la cuenta. Con borrarDatos (la persona lo pidió) se anonimiza; sin él se conserva la información. */
export async function eliminarClientePorEquipo(usuarioId: string, actorCorreo: string, opts: { borrarDatos?: boolean } = {}, ahora: Date = new Date()): Promise<ResultadoEliminacionEquipo> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('usuarios').select('id, nombre, eliminada_en').eq('id', usuarioId).maybeSingle()
  const u = data as { id: string; nombre: string | null; eliminada_en: string | null } | null
  if (!u) return { ok: false, motivo: 'no_existe' }
  if (u.eliminada_en) return { ok: false, motivo: 'ya_eliminada' }
  if (await visitaEnVivo(u.id)) return { ok: false, motivo: 'visita_en_vivo' }
  const visitasCanceladas = await cancelarAbiertas(u.id, ahora)
  if (!(await cerrarCuentaCliente(u.id, ahora, `admin:${actorCorreo}`, opts.borrarDatos === true))) return { ok: false, motivo: 'error' }
  await alertaAdmin('actividad', `🗑️ ${esc(actorCorreo)} eliminó la cuenta de <b>${esc(u.nombre ?? 'un cliente')}</b>${opts.borrarDatos ? ' (datos borrados a pedido de la persona)' : ' (información conservada)'}${visitasCanceladas ? ` y se cancelaron ${visitasCanceladas} visita(s) abiertas sin costo` : ''}.`, { categoria: 'cuenta_eliminada', entidad: { tipo: 'cliente', id: u.id, nombre: nombreDeCuentaEliminada(u.nombre) } })
  return { ok: true, visitasCanceladas }
}

/**
 * El equipo (solo administrador raíz) elimina a un compita: deja de existir para el sistema (sin acceso, sin Telegram, sin clientes asignados) y su
 * nombre queda con la marca "(cuenta eliminada)" junto a todas sus visitas y reportes. Con borrarDatos (la persona lo pidió) además se borran su
 * perfil y su contacto; sin él se conserva la información. No se puede mientras tenga visitas abiertas: primero se cancelan o se pasan a otro compita.
 */
export async function eliminarCompitaPorEquipo(compitaId: string, actorCorreo: string, opts: { borrarDatos?: boolean } = {}): Promise<ResultadoEliminacionEquipo> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('compitas').select('id, nombre, apellido, telegram_chat_id').eq('id', compitaId).maybeSingle()
  const c = data as { id: string; nombre: string | null; apellido: string | null; telegram_chat_id: string | null } | null
  if (!c) return { ok: false, motivo: 'no_existe' }
  const completo = [c.nombre, c.apellido].filter(Boolean).join(' ')
  if (esCuentaEliminada(completo)) return { ok: false, motivo: 'ya_eliminada' }
  const { data: abiertas } = await admin.from('visitas').select('id').eq('compita_id', compitaId).in('estado', ['pre_visita', 'programada', 'confirmando_inicio', 'en_curso']).limit(1)
  if (((abiertas ?? []) as unknown[]).length > 0) return { ok: false, motivo: 'visitas_abiertas' }
  await admin.from('usuarios').update({ compita_id: null }).eq('compita_id', compitaId)
  await admin.from('compita_edit_tokens').delete().eq('compita_id', compitaId)
  if (c.telegram_chat_id) await admin.from('telegram_estados').delete().eq('chat_id', c.telegram_chat_id)
  const cierre = opts.borrarDatos
    ? { nombre: nombreDeCuentaEliminada(completo), apellido: null, email: `eliminada-${compitaId}@compaz.invalid`, telefono: null, telegram_chat_id: null, foto_url: null, descripcion: null, youtube_url: null, estado: 'bloqueado', verificado: false }
    : { nombre: nombreDeCuentaEliminada(completo), apellido: null, telegram_chat_id: null, estado: 'bloqueado', verificado: false }
  const { error } = await admin.from('compitas').update(cierre).eq('id', compitaId)
  if (error) return { ok: false, motivo: 'error' }
  await registrarEvento({ entidad: 'compita', entidadId: compitaId, tipo: 'cuenta_eliminada', actor: `admin:${actorCorreo}`, datos: { anonimizada: opts.borrarDatos === true } })
  await alertaAdmin('actividad', `🗑️ ${esc(actorCorreo)} eliminó la cuenta del compita <b>${esc(completo || 'sin nombre')}</b>.`, { categoria: 'cuenta_eliminada', entidad: { tipo: 'compita', id: compitaId, nombre: nombreDeCuentaEliminada(completo) } })
  return { ok: true }
}
