// /api/solicitudes/hora — el cliente elige una de las horas libres del compita para la videollamada.
// GET ?solicitud=<id>: las horas libres. POST { solicitud_id, inicio, zona? }: reserva la hora y avisa al compita.
import { NextRequest } from 'next/server'
import { getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { horasLibres, reservarHorario, liberarReserva } from '@/lib/agenda'
import { dosHoras, zonaValida } from '@/lib/zonas'
import { notificar } from '@/lib/avisos'
import { ok, err, unauthorized } from '@/lib/api'

const UUID = /^[0-9a-f-]{36}$/i

/** La solicitud debe ser del cliente, una entrevista ya aceptada y sin hora confirmada. */
async function solicitudElegible(id: string, clienteId: string) {
  if (!UUID.test(id)) return null
  const { data } = await createAdminSupabase().from('solicitudes')
    .select('id, compita_id, cliente_id, estado, tipo, slot_confirmado').eq('id', id).eq('cliente_id', clienteId).maybeSingle()
  const s = data as { id: string; compita_id: string; estado: string; tipo: string; slot_confirmado: string | null } | null
  return s && s.estado === 'aceptada' && s.tipo === 'entrevista' && !s.slot_confirmado ? s : null
}

export async function GET(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const s = await solicitudElegible(req.nextUrl.searchParams.get('solicitud') ?? '', user.id)
  if (!s) return err('Esta solicitud no está esperando que elijas una hora', 404)
  const { data: u } = await createAdminSupabase().from('usuarios').select('zona_horaria').eq('id', user.id).maybeSingle()
  const zona = zonaValida(u?.zona_horaria)
  const libres = await horasLibres(s.compita_id, { dias: 14 })
  return ok({ horas: libres.map((b) => ({ inicio: b.inicio, ...dosHoras(b.inicio, zona) })), zona })
}

export async function POST(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const b = await req.json().catch(() => null) as { solicitud_id?: string; inicio?: string; zona?: string } | null
  if (!b?.solicitud_id || !b.inicio) return err('Faltan datos')
  const s = await solicitudElegible(b.solicitud_id, user.id)
  if (!s) return err('Esta solicitud no está esperando que elijas una hora', 404)

  // Zona del cliente: se guarda para mostrarle sus horas (solo si es una zona válida).
  const zona = zonaValida(b.zona)
  if (zona) await createAdminSupabase().from('usuarios').update({ zona_horaria: zona }).eq('id', user.id)

  // Cambiar de hora: la reserva anterior de esta solicitud se suelta antes de tomar la nueva.
  const { data: previa } = await createAdminSupabase().from('reservas_horario').select('id').eq('solicitud_id', s.id).eq('estado', 'reservada').maybeSingle()
  if (previa) await liberarReserva((previa as { id: string }).id, user.id)

  const r = await reservarHorario({ compitaId: s.compita_id, clienteId: user.id, solicitudId: s.id, inicio: b.inicio })
  if (!r.ok) return err(r.mensaje, r.motivo === 'ocupada' || r.motivo === 'no_disponible' ? 409 : r.motivo === 'error' ? 500 : 400)

  const aviso = await notificar({
    plantilla: 'reserva_pedida', canal: 'telegram', destinatario: { tipo: 'compita', id: s.compita_id },
    variables: { reservaId: r.reserva.id }, entidad: 'solicitud', entidadId: s.id, paso: 7,
    // Una clave por RESERVA: si el cliente cambia de hora, el compita recibe el aviso de la nueva (no se toma por repetido).
    claveUnica: `reserva_pedida:${r.reserva.id}`,
  })
  // Si el aviso no pudo salir, la hora no se queda reservada en vano: se suelta y se le dice al cliente.
  if (!aviso.ok) {
    await liberarReserva(r.reserva.id)
    return err('No pudimos avisarle a tu compita. Intenta de nuevo en unos minutos.', 502)
  }
  return ok({ reserva_id: r.reserva.id, vence_en: r.reserva.vence_en, hora: dosHoras(r.reserva.inicio, zona) })
}
