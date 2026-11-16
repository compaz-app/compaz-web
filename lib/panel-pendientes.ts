// Cuántas cosas esperan al equipo, para el punto rojo del menú del panel. Solo cuentan (no traen datos), así que cuestan muy poco.
import { createAdminSupabase } from '@/lib/supabase-server'

/**
 * Tareas de la Bandeja: cuántas hay abiertas y cuántas son NUEVAS desde `desde` (la última vez que esta persona vio la Bandeja). El punto rojo
 * cuenta las nuevas, como los mensajes sin leer: se quita al abrir la Bandeja. Sin `desde`, todas las abiertas cuentan como nuevas.
 */
export async function contarTareas(desde?: string | null): Promise<{ n: number; nuevas: number }> {
  const db = createAdminSupabase()
  const abiertas = () => db.from('admin_flags').select('id', { count: 'exact', head: true }).eq('resuelto', false)
  const [total, nuevas] = await Promise.all([abiertas(), desde ? abiertas().gt('created_at', desde) : abiertas()])
  if (total.error || nuevas.error) throw new Error(`No se pudo contar la bandeja: ${(total.error ?? nuevas.error)?.message}`)
  return { n: total.count ?? 0, nuevas: nuevas.count ?? 0 }
}

/** Pagos que el cliente dice haber hecho y que nadie ha confirmado. Este número NO se quita al verlo: se va cuando se confirma (es dinero esperando). */
export async function contarPagosPorConfirmar(): Promise<number> {
  const { count, error } = await createAdminSupabase().from('solicitudes_pago').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
  if (error) throw new Error(`No se pudo contar los pagos por confirmar: ${error.message}`)
  return count ?? 0
}
