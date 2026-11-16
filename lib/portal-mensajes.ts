// Mensajes sin leer del chat del cliente (el círculo rojo de Visitas). Un mensaje del compita o del equipo es «sin leer» si es posterior a la última vez que el
// cliente tuvo su chat a la vista (usuarios.chat_leido_en). NUNCA lanza: un fallo aquí solo deja el círculo en cero.
import { createAdminSupabase } from '@/lib/supabase-server'

type Admin = ReturnType<typeof createAdminSupabase>
// Las visitas con chat vivo: el mismo criterio que usa el portal para mostrar la conversación.
const ESTADOS_CON_CHAT = ['pre_visita', 'programada', 'confirmando_inicio', 'en_curso']

export async function contarMensajesSinLeer(usuarioId: string, admin: Admin = createAdminSupabase()): Promise<number> {
  try {
    const { data: u, error: eu } = await admin.from('usuarios').select('chat_leido_en').eq('id', usuarioId).maybeSingle()
    if (eu) return 0 // la columna aún no existe en la base: sin migración no se cuenta (el círculo no se podría quitar)
    const leido = (u as { chat_leido_en: string | null } | null)?.chat_leido_en ?? null
    const { data: visitas } = await admin.from('visitas').select('id').eq('usuario_id', usuarioId).in('estado', ESTADOS_CON_CHAT)
    const ids = ((visitas ?? []) as { id: string }[]).map((v) => v.id)
    if (ids.length === 0) return 0
    let q = admin.from('mensajes').select('id', { count: 'exact', head: true }).in('visit_id', ids).in('origen', ['compita', 'admin'])
    if (leido) q = q.gt('created_at', leido)
    const { count, error } = await q
    if (error) { console.error('[portal] mensajes sin leer:', error.message); return 0 }
    return count ?? 0
  } catch (e) { console.error('[portal] error al contar mensajes sin leer:', e); return 0 }
}

/** El cliente tiene su chat a la vista: todo lo anterior queda leído. */
export async function marcarChatLeido(usuarioId: string, admin: Admin = createAdminSupabase()): Promise<boolean> {
  try {
    const { error } = await admin.from('usuarios').update({ chat_leido_en: new Date().toISOString() }).eq('id', usuarioId)
    if (error) { console.error('[portal] marcar chat leído:', error.message); return false }
    return true
  } catch (e) { console.error('[portal] error al marcar el chat leído:', e); return false }
}
