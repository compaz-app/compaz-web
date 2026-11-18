// Deja un aviso de estado en el chat de la visita para que cliente y equipo vean en qué etapa va la conversación. NUNCA lanza: un fallo aquí no debe cortar el
// flujo que lo origina. Cada aviso lleva una clave por visita y etapa, así un reintento no lo duplica.
import { createAdminSupabase } from '@/lib/supabase-server'
import { PREFIJO_EVENTO_CHAT } from '@/lib/chat-eventos-texto'

export async function anotarEventoChat(visitaId: string, texto: string, admin: ReturnType<typeof createAdminSupabase> = createAdminSupabase()): Promise<void> {
  try {
    const contenido = `${PREFIJO_EVENTO_CHAT}${texto}`.slice(0, 300)
    const { data: previo } = await admin.from('mensajes').select('id').eq('visit_id', visitaId).eq('origen', 'admin').eq('contenido', contenido).limit(1)
    if (((previo ?? []) as unknown[]).length > 0) return
    const { error } = await admin.from('mensajes').insert({ visit_id: visitaId, origen: 'admin', tipo: 'texto', contenido })
    if (error) console.error('[chat-eventos] no se pudo anotar:', error.message)
  } catch (e) { console.error('[chat-eventos] error inesperado:', e) }
}
