import { personaPausada } from '@/lib/pausas'
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getClienteActivo } from '@/lib/auth'
import { ok, err, unauthorized, notFound } from '@/lib/api'
import { esc } from '@/lib/html'
import { hoyVE, horaVE } from '@/lib/format'
import { alertaAdmin } from '@/lib/alertas-admin'
import { proponerCita } from '@/lib/citas'

// PUT /api/visita/fecha
// El cliente elige fecha y horario: queda PROPUESTA hasta que el compita la confirme (pre_visita → programada). Nunca se programa sin que el
// compita se entere: Telegram es requisito para trabajar en Compaz.
// Valida que el compita no tenga otra visita programada que se solape con el horario.
export async function PUT(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const body = await req.json().catch(() => null) as { visita_id?: string; fecha_programada?: string; hora_inicio?: string; hora_fin?: string } | null
  if (!body) return err('Solicitud inválida')
  const { visita_id, fecha_programada, hora_inicio, hora_fin } = body as { visita_id: string; fecha_programada: string; hora_inicio: string; hora_fin: string }

  if (!visita_id || !fecha_programada || !hora_inicio || !hora_fin) return err('Faltan parámetros')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_programada)) return err('Fecha inválida')
  const horaInicioN = hora_inicio.slice(0, 5)
  const horaFinN = hora_fin.slice(0, 5)
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horaInicioN) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaFinN)) return err('Hora inválida')
  if (horaFinN <= horaInicioN) return err('La hora de fin debe ser después de la hora de inicio')
  if (Number.isNaN(new Date(`${fecha_programada}T12:00:00Z`).getTime()) || new Date(`${fecha_programada}T12:00:00Z`).toISOString().slice(0, 10) !== fecha_programada) return err('Fecha inválida')
  const hoy = hoyVE() // día de Venezuela, no UTC
  if (fecha_programada < hoy) return err('La fecha debe ser hoy o en el futuro')
  if (fecha_programada === hoy && horaInicioN <= horaVE()) return err('La hora de inicio ya pasó')
  if (fecha_programada > hoyVE(180)) return err('La fecha es demasiado lejana')

  const admin = createAdminSupabase()

  const { data: visita } = await admin
    .from('visitas')
    .select('id, usuario_id, compita_id, estado')
    .eq('id', visita_id)
    .single()

  if (!visita) return notFound()
  if (visita.usuario_id !== user.id) return err('Sin acceso', 403)
  if (await personaPausada('cliente', user.id)) return err('Tu cuenta está en pausa: por ahora no puedes agendar visitas. El equipo se comunica contigo por correo.', 403)
  if (!['pre_visita', 'programada'].includes(visita.estado)) return err('Estado de visita inválido')

  // Verificar solapamiento: buscar visitas del mismo compita en la misma fecha
  // con horario que se cruce con el nuevo bloque solicitado.
  // Overlap: inicio_existente < hora_fin_nueva AND fin_existente > hora_inicio_nueva
  const { data: solapadas } = await admin
    .from('visitas')
    .select('id, hora_inicio_programada, hora_fin_programada')
    .eq('compita_id', visita.compita_id)
    .eq('fecha_programada', fecha_programada)
    .in('estado', ['programada', 'en_curso'])
    .neq('id', visita_id) // excluir la visita actual (reagendado)

  const hayConflicto = (solapadas ?? []).some((v) => {
    const ini = v.hora_inicio_programada
    const fin = v.hora_fin_programada
    if (!ini || !fin) return false
    return ini < horaFinN && fin > horaInicioN
  })

  if (hayConflicto) {
    return err(`El compita ya tiene otra visita programada en ese horario. Por favor coordinen un horario diferente.`)
  }

  // Confirmación del compita (siempre): el cliente PROPONE y la visita no queda programada hasta que el compita confirme (ver lib/citas.ts).
  const r = await proponerCita({ visitaId: visita_id, usuarioId: visita.usuario_id, compitaId: visita.compita_id, fecha: fecha_programada, inicio: horaInicioN, fin: horaFinN })
  if (r === 'pendiente') return ok({ estado: 'pendiente_confirmacion', fecha_programada, hora_inicio_programada: horaInicioN, hora_fin_programada: horaFinN })
  // Telegram es requisito para trabajar en Compaz: si no se pudo avisarle (bot bloqueado, vínculo perdido), la visita NO se agenda a ciegas.
  // El cliente puede reintentar y el equipo recibe la tarea para arreglar el vínculo del compita.
  await alertaAdmin('tarea', `📅 <b>No se pudo avisar al compita de una cita</b>\n\nEl cliente eligió ${esc(fecha_programada)}, ${esc(horaInicioN)}, pero Telegram no entregó el aviso al compita (bot bloqueado o vínculo perdido). La visita NO se agendó. Revisa y arregla el vínculo de Telegram de este compita.`, { categoria: 'cita_sin_telegram', clave: `cita_sin_telegram:${visita.compita_id}`, entidad: { tipo: 'compita', id: visita.compita_id } })
  return err('No pudimos avisarle a tu compita. Intenta de nuevo en unos minutos; el equipo ya fue avisado para ayudarte.', 502)
}

