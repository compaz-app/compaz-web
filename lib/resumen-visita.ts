// El resumen de la visita llega en UN solo correo. Normalmente sale cuando el compita termina el cuestionario de bienestar (resumen con IA, lo que anotó el compita,
// indicadores y calificación: aviso `visita_reporte`). Si el compita NO lo completa, a los 35 minutos de terminada la visita sale el resumen básico (aviso `visita_resumen`)
// para que la familia no se quede sin nada. Antes llegaban DOS correos casi iguales, los dos pidiendo calificar. Lo corre el cron `recordatorio-cuestionario` (cada 10 min).
// NUNCA lanza: un fallo en una visita no frena las demás.
import { createAdminSupabase } from '@/lib/supabase-server'
import { reclamarUnaVez } from '@/lib/cron'
import { notificar } from '@/lib/avisos'

/** Minutos desde que terminó la visita para dar por perdido el cuestionario (el compita tiene 30 para completarlo). */
export const ESPERA_CUESTIONARIO_MIN = 35
/** No se revisan visitas más viejas que esto (evita mandar un resumen tardío de algo ya olvidado). */
const VENTANA_MAX_H = 48

export async function enviarResumenesSinReporte(ahora: Date = new Date()): Promise<number> {
  let enviados = 0
  try {
    const admin = createAdminSupabase()
    const hasta = new Date(ahora.getTime() - ESPERA_CUESTIONARIO_MIN * 60_000).toISOString()
    const desde = new Date(ahora.getTime() - VENTANA_MAX_H * 3_600_000).toISOString()
    const { data } = await admin.from('visitas').select('id, usuario_id').eq('estado', 'terminada').not('inicio', 'is', null).gte('fin', desde).lte('fin', hasta).limit(100)
    const candidatas = (data ?? []) as { id: string; usuario_id: string }[]
    if (candidatas.length === 0) return 0
    const { data: reportes } = await admin.from('reportes_visita').select('visita_id').in('visita_id', candidatas.map((v) => v.id))
    const conReporte = new Set(((reportes ?? []) as { visita_id: string }[]).map((r) => String(r.visita_id)))
    for (const v of candidatas) {
      if (conReporte.has(String(v.id))) continue
      try {
        if (!(await reclamarUnaVez(`resumen_basico:${v.id}`))) continue
        const r = await notificar({ plantilla: 'visita_resumen', canal: 'correo', destinatario: { tipo: 'cliente', id: v.usuario_id }, variables: { visitaId: v.id }, entidad: 'visita', entidadId: v.id, paso: 14 })
        if (r.ok) enviados++
      } catch (e) { console.error(`[resumen-visita] falló ${v.id}:`, e) }
    }
  } catch (e) { console.error('[resumen-visita] error general:', e) }
  return enviados
}
