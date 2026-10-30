// GET /api/admin/demo/estado
// Devuelve el estado actual de la demo: compitas demo, solicitud activa, visita activa y cliente.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, unauthorized } from '@/lib/api'

export async function GET(_req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const admin = createAdminSupabase()

  const { data: compitasDemo } = await admin
    .from('compitas')
    .select('id, nombre, zona, estado, verificado, foto_url, es_demo')
    .eq('es_demo', true)
    .order('created_at', { ascending: false })

  const demos = compitasDemo ?? []
  if (demos.length === 0) return ok({ stage: 'sin_compita_demo', compitasDemo: [], solicitud: null, visita: null, cliente: null })

  // Solicitud activa más reciente de cualquier compita demo
  const demoIds = demos.map((c) => c.id)
  const { data: solicitudes } = await admin
    .from('solicitudes')
    .select('id, compita_id, cliente_id, estado, slot_confirmado, room_url, token_respuesta')
    .in('compita_id', demoIds)
    .not('estado', 'in', '("rechazada")')
    .order('created_at', { ascending: false })
    .limit(20)

  // Visita activa más reciente de cualquier compita demo (no terminada)
  const { data: visitas } = await admin
    .from('visitas')
    .select('id, compita_id, usuario_id, estado, inicio, fin, room_url')
    .in('compita_id', demoIds)
    .not('estado', 'eq', 'terminada')
    .order('created_at', { ascending: false })
    .limit(5)

  // Determinar etapa: la visita activa tiene prioridad sobre la solicitud
  const visitaActiva = visitas?.[0] ?? null
  let solicitudActiva = null
  if (!visitaActiva) {
    // Buscar solicitud no-completada-ni-contratada-sin-visita
    solicitudActiva = solicitudes?.find((s) => ['pendiente', 'aceptada'].includes(s.estado))
      ?? solicitudes?.find((s) => s.estado === 'completada')
      ?? null
  }

  let cliente = null
  const clienteId = visitaActiva?.usuario_id ?? solicitudActiva?.cliente_id
  if (clienteId) {
    const { data } = await admin.from('usuarios').select('id, nombre, email').eq('id', clienteId).single()
    cliente = data
  }

  // Calcular etapa
  let stage: string
  if (visitaActiva) {
    if (['pre_visita', 'programada', 'confirmando_inicio'].includes(visitaActiva.estado)) stage = 'visita_programada'
    else if (visitaActiva.estado === 'en_curso') stage = 'visita_en_curso'
    else stage = 'demo_completado'
  } else if (solicitudActiva) {
    if (solicitudActiva.estado === 'pendiente') stage = 'entrevista_pendiente'
    else if (solicitudActiva.estado === 'aceptada') stage = 'entrevista_en_curso'
    else if (solicitudActiva.estado === 'completada') stage = 'crear_visita'
    else stage = 'esperando_solicitud'
  } else if (solicitudes?.some((s) => s.estado === 'contratada') && !visitaActiva) {
    // Solicitud contratada pero no hay visita activa — raro pero posible
    stage = 'esperando_solicitud'
  } else {
    stage = 'esperando_solicitud'
  }

  return ok({ stage, compitasDemo: demos, solicitud: solicitudActiva, visita: visitaActiva, cliente })
}
