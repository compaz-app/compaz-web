// POST /api/admin/demo/iniciar-visita
// Mueve la visita directamente a en_curso (saltando pre_visita/confirmando_inicio)
// y envía al cliente el correo de inicio de visita.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendVisitaInicio } from '@/lib/resend'
import { ok, err, unauthorized, notFound, serverError } from '@/lib/api'
import type { Visita, Compita, Usuario } from '@/types'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { visita_id } = (await req.json().catch(() => ({}))) as { visita_id?: string }
  if (!visita_id) return err('Falta visita_id')

  const admin = createAdminSupabase()
  const inicio = new Date().toISOString()

  const { data: visita, error } = await admin
    .from('visitas')
    .update({ estado: 'en_curso', inicio })
    .eq('id', visita_id)
    .in('estado', ['pre_visita', 'programada', 'confirmando_inicio'])
    .select('*, compita:compitas(*), usuario:usuarios(*)')
    .maybeSingle() as { data: (Visita & { compita: Compita; usuario: Usuario }) | null; error: unknown }

  if (error) return serverError(error)
  if (!visita) return notFound('Visita no encontrada o ya no está en estado inicializable')

  // Enviar email de inicio al cliente
  if (visita.usuario?.email) {
    try {
      await sendVisitaInicio(visita.usuario, visita.compita, visita)
    } catch (e) {
      console.error('[demo/iniciar-visita] email:', e)
    }
  }

  return ok({ visita_id })
}
