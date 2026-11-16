// «Ya vio el reporte»: cuando el cliente abre su pestaña de Visitas y el reporte de una visita terminada ya está listo, se anota. Desde ahí el portal deja de
// preguntar «¿cómo te fue?» y pasa a invitarlo a agendar la siguiente. Si el reporte todavía no está, no se anota (seguiría viendo el aviso hasta que llegue).
// NUNCA lanza: un fallo aquí solo deja el aviso un poco más.
import { createAdminSupabase } from '@/lib/supabase-server'

type Admin = ReturnType<typeof createAdminSupabase>

/** Marca como vistos los reportes ya listos de las visitas terminadas de este cliente. Devuelve cuántas visitas marcó. */
export async function marcarReporteVisto(usuarioId: string, admin: Admin = createAdminSupabase()): Promise<number> {
  try {
    const { data: visitas, error } = await admin.from('visitas').select('id').eq('usuario_id', usuarioId).eq('estado', 'terminada').is('reporte_visto_en', null)
    if (error) { console.error('[portal] reporte visto:', error.message); return 0 }
    const ids = ((visitas ?? []) as { id: string }[]).map((v) => v.id)
    if (ids.length === 0) return 0
    const { data: reportes } = await admin.from('reportes_visita').select('visita_id').in('visita_id', ids)
    const listos = [...new Set(((reportes ?? []) as { visita_id: string }[]).map((r) => r.visita_id))]
    if (listos.length === 0) return 0
    const { data: marcadas } = await admin.from('visitas').update({ reporte_visto_en: new Date().toISOString() }).in('id', listos).eq('usuario_id', usuarioId).select('id')
    return (marcadas ?? []).length
  } catch (e) { console.error('[portal] error al marcar el reporte visto:', e); return 0 }
}
