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

/** Minutos que debe pasar sin que el cliente lea para que un mensaje nuevo del compita genere otro correo. */
export const ESPERA_OTRO_CORREO_CHAT_MIN = 30

/**
 * ¿Hay que mandar el correo «te escribió»? El primero de la visita sale siempre. Después, otro solo si pasaron más de 30 minutos desde el último correo y el cliente
 * no abrió su chat en ese tiempo (así un mensaje urgente llega, y una conversación larga no llena el buzón). `ultimoCorreo` es la hora del último correo de la visita.
 */
export async function debeCorreoDeMensaje(usuarioId: string, ultimoCorreo: string | null, ahora: Date = new Date(), admin: Admin = createAdminSupabase()): Promise<boolean> {
  if (!ultimoCorreo) return true
  const t = new Date(ultimoCorreo).getTime()
  if (Number.isNaN(t) || ahora.getTime() - t < ESPERA_OTRO_CORREO_CHAT_MIN * 60_000) return false
  try {
    const { data } = await admin.from('usuarios').select('chat_leido_en').eq('id', usuarioId).maybeSingle()
    const leido = (data as { chat_leido_en: string | null } | null)?.chat_leido_en
    return !leido || new Date(leido).getTime() < t
  } catch { return false }
}
