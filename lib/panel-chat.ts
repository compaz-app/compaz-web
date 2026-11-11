// Chat entre un cliente y un compita, para el equipo (servidor). Es una conversación privada: hace falta el permiso 'chats',
// un colaborador debe dar motivo, y la consulta se ANOTA en Actividad antes de entregar nada (si no se puede anotar, no se entrega).
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Actor } from '@/lib/permisos'
import { puede } from '@/lib/permisos'
import { recortarTexto } from '@/lib/panel-datos'
import { alertaAdmin } from '@/lib/alertas-admin'
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

  const anotado = await alertaAdmin('actividad', `${actor.correo} abrió el chat entre ${cliente} y ${compita}. Motivo: ${motivo}`, { categoria: 'acceso_chat', entidad: { tipo: 'cliente', id: p.clienteId, nombre: cliente } })
  if (!anotado) return { ok: false, error: 'No se pudo anotar el acceso, así que no se muestra el chat. Inténtalo otra vez.', status: 503 }

  let mensajes: MensajePanel[] = []
  if (ids.length) {
    const { data, error } = await db.from('mensajes').select('origen, tipo, contenido, created_at').in('visit_id', ids).order('created_at', { ascending: true }).limit(500)
    if (error) return { ok: false, error: 'No se pudo leer el chat', status: 503 }
    mensajes = (data ?? []).map((m) => ({ de: DE[String(m.origen)] ?? 'Compaz', texto: m.tipo === 'foto' ? '' : recortarTexto(actor, String(m.contenido ?? '')), cuando: String(m.created_at), esFoto: m.tipo === 'foto' }))
  }
  return { ok: true, cliente, compita, mensajes }
}
