// Chat entre un cliente y un compita, para el equipo (servidor). Es una conversación privada: hace falta el permiso 'chats',
// un colaborador debe dar motivo, y la consulta se ANOTA en Actividad antes de entregar nada (si no se puede anotar, no se entrega).
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Actor } from '@/lib/permisos'
import { puede } from '@/lib/permisos'
import { recortarTexto } from '@/lib/panel-datos'
import { registrarAcceso } from '@/lib/alertas-admin'
import { SIN_MOTIVO_ADMIN, motivoValido, type MensajePanel } from '@/lib/panel-personas-tipos'

export type ResultadoChat = { ok: true; cliente: string; compita: string; mensajes: MensajePanel[] } | { ok: false; error: string; status: number }

const DE: Record<string, MensajePanel['de']> = { cliente: 'Cliente', compita: 'Compita', admin: 'Compaz' }

export async function verChat(actor: Actor, p: { clienteId: string; compitaId: string; motivo: unknown }): Promise<ResultadoChat> {
  if (!puede(actor, 'chats')) return { ok: false, error: 'Acceso denegado', status: 403 }
  const motivo = actor.rol === 'admin' ? (motivoValido(p.motivo) ?? SIN_MOTIVO_ADMIN) : motivoValido(p.motivo)
  if (!motivo) return { ok: false, error: 'Indica el motivo para ver este chat', status: 400 }

  const db = createAdminSupabase()
  const [cli, cmp, vis] = await Promise.all([
    db.from('usuarios').select('nombre').eq('id', p.clienteId).maybeSingle(),
    db.from('compitas').select('nombre, apellido').eq('id', p.compitaId).maybeSingle(),
    db.from('visitas').select('id').eq('usuario_id', p.clienteId).eq('compita_id', p.compitaId).limit(200),
  ])
  if (!cli.data || !cmp.data) return { ok: false, error: 'Persona no encontrada', status: 404 }
  const cliente = String(cli.data.nombre ?? ''), compita = [cmp.data.nombre, cmp.data.apellido].filter(Boolean).join(' ')
  const ids = (vis.data ?? []).map((v) => String(v.id))

  const anotado = await registrarAcceso(`${actor.correo} abrió el chat entre ${cliente} y ${compita}. Motivo: ${motivo}`, { categoria: 'acceso_chat', entidad: { tipo: 'cliente', id: p.clienteId, nombre: cliente } })
  if (!anotado) return { ok: false, error: 'No se pudo anotar el acceso, así que no se muestra el chat. Inténtalo otra vez.', status: 503 }

  let mensajes: MensajePanel[] = []
  if (ids.length) {
    const r = await leerMensajes(actor, ids)
    if (!r.ok) return { ok: false, error: 'No se pudo leer el chat', status: 503 }
    mensajes = r.mensajes
  }
  return { ok: true, cliente, compita, mensajes }
}

async function leerMensajes(actor: Actor, ids: string[], desde?: string): Promise<{ ok: true; mensajes: MensajePanel[] } | { ok: false }> {
  let q = createAdminSupabase().from('mensajes').select('origen, tipo, contenido, created_at').in('visit_id', ids)
  if (desde) q = q.gt('created_at', desde)
  const { data, error } = await q.order('created_at', { ascending: true }).limit(500)
  if (error) return { ok: false }
  return { ok: true, mensajes: (data ?? []).map((m) => ({ de: DE[String(m.origen)] ?? 'Compaz', texto: m.tipo === 'foto' ? '' : recortarTexto(actor, String(m.contenido ?? '')), cuando: String(m.created_at), esFoto: m.tipo === 'foto' })) }
}

/** Cuánto tiempo después de abrir un chat se puede seguir actualizando sin volver a anotar el acceso. Pasado ese plazo hay que abrirlo de nuevo (y queda anotado otra vez). */
export const VENTANA_CHAT_MIN = 30

export type ResultadoRefrescoChat = { ok: true; mensajes: MensajePanel[] } | { ok: false; error: string; status: number; caducado?: boolean }

/**
 * Mensajes nuevos de un chat que el equipo ya tiene abierto, para que se actualice solo. NO anota un acceso nuevo (sería una línea por cada
 * actualización), pero tampoco regala nada: solo responde si ESTA persona abrió ESTE chat (con su motivo, anotado) en los últimos 30 minutos.
 * Así un colaborador no puede saltarse el motivo llamando a la actualización directamente.
 */
export async function refrescarChat(actor: Actor, p: { clienteId: string; compitaId: string; desde: unknown }): Promise<ResultadoRefrescoChat> {
  if (!puede(actor, 'chats')) return { ok: false, error: 'Acceso denegado', status: 403 }
  const db = createAdminSupabase()
  const [cli, cmp, vis] = await Promise.all([
    db.from('usuarios').select('nombre').eq('id', p.clienteId).maybeSingle(),
    db.from('compitas').select('nombre, apellido').eq('id', p.compitaId).maybeSingle(),
    db.from('visitas').select('id').eq('usuario_id', p.clienteId).eq('compita_id', p.compitaId).limit(200),
  ])
  if (!cli.data || !cmp.data) return { ok: false, error: 'Persona no encontrada', status: 404 }
  const cliente = String(cli.data.nombre ?? ''), compita = [cmp.data.nombre, cmp.data.apellido].filter(Boolean).join(' ')
  const desdeAcceso = new Date(Date.now() - VENTANA_CHAT_MIN * 60_000).toISOString()
  const { data: accesos } = await db.from('actividad_admin').select('resumen').eq('categoria', 'acceso_chat').eq('entidad_id', p.clienteId).gte('creado_en', desdeAcceso).limit(200)
  const abrio = (accesos ?? []).some((a) => String(a.resumen ?? '').startsWith(`${actor.correo} abrió el chat entre ${cliente} y ${compita}.`))
  if (!abrio) return { ok: false, error: `Pasaron más de ${VENTANA_CHAT_MIN} minutos desde que abriste este chat. Ábrelo de nuevo para seguir viéndolo.`, status: 403, caducado: true }
  const ids = (vis.data ?? []).map((v) => String(v.id))
  if (!ids.length) return { ok: true, mensajes: [] }
  const desde = typeof p.desde === 'string' && !Number.isNaN(Date.parse(p.desde)) ? p.desde : undefined
  const r = await leerMensajes(actor, ids, desde)
  return r.ok ? { ok: true, mensajes: r.mensajes } : { ok: false, error: 'No se pudo leer el chat', status: 503 }
}
