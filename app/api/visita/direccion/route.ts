// /api/visita/direccion — la dirección de la próxima cita (por cita, no una sola para siempre).
// GET: lo registrado y la dirección de la visita anterior (para reutilizarla). PUT: la guarda; si la cita ya está dentro de
// la ventana de las 3 horas, se entrega al compita en ese momento.
import { NextRequest } from 'next/server'
import { getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { visitaProximaDelCliente, direccionAnterior, validarDireccion, guardarDireccion, entregarDireccionDeVisita } from '@/lib/direccion'
import { registrarEvento } from '@/lib/eventos'
import { ok, err, unauthorized } from '@/lib/api'

export async function GET() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const v = await visitaProximaDelCliente(user.id)
  if (!v) return err('No tienes una visita próxima', 404)
  const { data } = await createAdminSupabase().from('visitas').select('direccion, indicaciones, quien_abre, contacto_nombre, contacto_tel').eq('id', v.id).maybeSingle()
  const actual = data as { direccion: string | null; indicaciones: string | null; quien_abre: string | null; contacto_nombre: string | null; contacto_tel: string | null } | null
  return ok({
    registrada: !!actual?.direccion,
    actual: actual?.direccion ? actual : null, // es lo que el propio cliente escribió
    anterior: await direccionAnterior(user.id, v.id),
    programada: v.estado === 'programada',
  })
}

export async function PUT(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const val = validarDireccion(await req.json().catch(() => null))
  if (!val.ok) return err(val.error)
  const v = await visitaProximaDelCliente(user.id)
  if (!v) return err('No tienes una visita próxima', 404)
  if (!(await guardarDireccion(v.id, val.datos))) return err('No pudimos guardar la dirección. Intenta de nuevo.', 500)
  // El evento NO lleva la dirección ni el teléfono: solo que se registró.
  await registrarEvento({ entidad: 'visita', entidadId: v.id, tipo: 'direccion_registrada', actor: `cliente:${user.id}` })
  // La tarea "Falta la dirección" (si se había abierto) deja de hacer falta.
  await createAdminSupabase().from('admin_flags').update({ resuelto: true, resuelto_at: new Date().toISOString() }).eq('tipo', 'direccion_faltante').eq('entidad_id', v.id).eq('resuelto', false)
  // Si la cita ya está dentro de la ventana (o ya se había avisado que faltaba), se entrega ahora mismo.
  const entrega = await entregarDireccionDeVisita(v.id)
  return ok({ guardada: true, entregada: entrega === 'enviada' })
}
