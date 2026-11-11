// Datos de Postulaciones y origen (servidor). Nunca trae teléfono ni correo: aquí solo se ve de dónde llegó cada postulación y si calificó.
import { createAdminSupabase } from '@/lib/supabase-server'
import { postulacionesPorResolver, type PostulacionPorResolver } from '@/lib/captacion'
import type { FilaOrigen } from '@/lib/panel-postulaciones-tipos'

const LIMITE = 500

export async function listarPostulaciones(): Promise<FilaOrigen[]> {
  const { data, error } = await createAdminSupabase().from('postulaciones')
    .select('id, tipo, clasificacion, fuente, utm_source, utm_campaign, nombre_declarado, ubicacion_declarada, recibida_en')
    .order('recibida_en', { ascending: false }).limit(LIMITE)
  if (error) throw new Error(`No se pudo leer las postulaciones: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map((r): FilaOrigen => ({
    id: String(r.id), tipo: r.tipo as FilaOrigen['tipo'], clasificacion: r.clasificacion as FilaOrigen['clasificacion'], fuente: String(r.fuente),
    campana: (r.utm_campaign as string | null) || null, origen: (r.utm_source as string | null) || null,
    nombre: String(r.nombre_declarado ?? ''), ubicacion: String(r.ubicacion_declarada ?? ''), recibida: String(r.recibida_en),
  }))
}

/** Las que no llegaron a Airtable. Solo si la captación está activa; si la lectura falla, se dice (no se esconde). */
export async function pendientesDeAirtable(): Promise<{ activa: boolean; error: boolean; filas: PostulacionPorResolver[] }> {
  if (!process.env.CAPTACION_DESDE) return { activa: false, error: false, filas: [] }
  try { return { activa: true, error: false, filas: await postulacionesPorResolver(500) } }
  catch (e) { console.error('[panel/postulaciones]', e); return { activa: true, error: true, filas: [] } }
}
