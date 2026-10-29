// POST /api/admin/demo/cerrar-visita
// Cierra la visita demo: crea reporte prefijado, termina la visita, envía resumen al cliente.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendVisitaResumen } from '@/lib/resend'
import { ok, err, unauthorized, notFound, serverError } from '@/lib/api'
import type { Visita, Compita, Usuario } from '@/types'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { visita_id } = (await req.json().catch(() => ({}))) as { visita_id?: string }
  if (!visita_id) return err('Falta visita_id')

  const admin = createAdminSupabase()
  const fin = new Date().toISOString()

  const { data: visita, error } = await admin
    .from('visitas')
    .update({ estado: 'terminada', fin, room_url: null, llamada_solicitada_at: null })
    .eq('id', visita_id)
    .eq('estado', 'en_curso')
    .select('*, compita:compitas(*), usuario:usuarios(*)')
    .maybeSingle() as { data: (Visita & { compita: Compita; usuario: Usuario }) | null; error: unknown }

  if (error) return serverError(error)
  if (!visita) return notFound('Visita no encontrada o no está en_curso')

  // Crear reporte demo con valores neutros
  const { error: eReporte } = await admin.from('reportes_visita').insert({
    visita_id: visita.id,
    animo: 3,
    fisico: 3,
    participacion: 3,
    entorno: 3,
    novedad: 'Visita de demostración completada exitosamente.',
    resumen_ia: null,
  })
  if (eReporte) console.error('[demo/cerrar-visita] reporte:', eReporte)

  // Enviar resumen al cliente con esRecurrente=true para mostrar botones de seguimiento
  if (visita.usuario?.email) {
    try {
      await sendVisitaResumen(visita.usuario, visita.compita, visita, [], true)
    } catch (e) {
      console.error('[demo/cerrar-visita] email resumen:', e)
    }
  }

  return ok({ visita_id })
}
