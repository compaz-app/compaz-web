// Agenda (Lote 3): horas libres de un compita y reservas con restricción única.
// Todo en hora de Venezuela (UTC-4 fijo). Los bloques son de 20 minutos y salen de las franjas semanales que el compita
// carga en su perfil (`horarios_disponibles`). Una hora tomada (reservada o confirmada), una entrevista ya confirmada o
// una visita programada la quitan de las libres. La garantía contra dos clientes en la misma hora es el índice único
// de la base (`reservas_horario_hora_unica`); el código lo usa y lo traduce a un mensaje claro.

import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjuste } from '@/lib/ajustes'
import { registrarEvento } from '@/lib/eventos'
import type { HorarioDisponible } from '@/types'

export const BLOQUE_MIN = 20
const MIN_MS = 60_000
const OFFSET_VE_MS = 4 * 3600_000 // Venezuela = UTC-4
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const

export interface Bloque { inicio: string; fin: string }

/** Función pura: los bloques de 20 min de las franjas semanales para los próximos `dias` días (hora de Venezuela). */
export function generarBloques(horarios: HorarioDisponible[] | null | undefined, ahora: Date, dias = 14): Bloque[] {
  if (!horarios?.length) return []
  const vePared = new Date(ahora.getTime() - OFFSET_VE_MS) // "reloj de pared" de Caracas leído como UTC
  const salida: Bloque[] = []
  for (let d = 0; d < dias; d++) {
    const dia = new Date(Date.UTC(vePared.getUTCFullYear(), vePared.getUTCMonth(), vePared.getUTCDate() + d))
    const nombre = DIAS[dia.getUTCDay()]
    for (const h of horarios.filter((x) => x.dia === nombre)) {
      const [iH, iM] = h.inicio.split(':').map(Number)
      const [fH, fM] = h.fin.split(':').map(Number)
      if ([iH, iM, fH, fM].some((n) => !Number.isFinite(n))) continue
      for (let m = iH * 60 + iM; m + BLOQUE_MIN <= fH * 60 + fM; m += BLOQUE_MIN) {
        const inicio = Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(), 0, m) + OFFSET_VE_MS
        salida.push({ inicio: new Date(inicio).toISOString(), fin: new Date(inicio + BLOQUE_MIN * MIN_MS).toISOString() })
      }
    }
  }
  return salida.sort((a, b) => a.inicio.localeCompare(b.inicio))
}

const solapa = (a: Bloque, ini: number, fin: number) => new Date(a.inicio).getTime() < fin && new Date(a.fin).getTime() > ini

/** Marca como vencidas las reservas sin respuesta cuyo plazo pasó (liberan la hora). Devuelve las que venció. */
export async function liberarVencidas(ahora: Date = new Date(), compitaId?: string): Promise<{ id: string; compita_id: string; cliente_id: string; solicitud_id: string | null; inicio: string }[]> {
  const admin = createAdminSupabase()
  let q = admin.from('reservas_horario').update({ estado: 'vencida', resuelta_en: ahora.toISOString() }).eq('estado', 'reservada').lte('vence_en', ahora.toISOString())
  if (compitaId) q = q.eq('compita_id', compitaId)
  const { data, error } = await q.select('id, compita_id, cliente_id, solicitud_id, inicio')
  if (error) { console.error('[agenda] no se pudieron vencer reservas:', error.message); return [] }
  const filas = (data ?? []) as { id: string; compita_id: string; cliente_id: string; solicitud_id: string | null; inicio: string }[]
  for (const f of filas) await registrarEvento({ entidad: 'solicitud', entidadId: f.solicitud_id ?? f.id, tipo: 'reserva_vencida', datos: { compita_id: f.compita_id, inicio: f.inicio } })
  return filas
}

/** Horas libres del compita: sus bloques menos lo ocupado, respetando la anticipación mínima de Ajustes. */
export async function horasLibres(compitaId: string, opc: { ahora?: Date; dias?: number } = {}): Promise<Bloque[]> {
  const ahora = opc.ahora ?? new Date()
  const admin = createAdminSupabase()
  const { data: c } = await admin.from('compitas').select('horarios_disponibles').eq('id', compitaId).maybeSingle()
  const anticipacionH = Number(await getAjuste('entrevista_anticipacion_horas'))
  const desde = ahora.getTime() + anticipacionH * 3600_000
  const bloques = generarBloques((c?.horarios_disponibles as HorarioDisponible[] | null) ?? null, ahora, opc.dias ?? 14).filter((b) => new Date(b.inicio).getTime() > desde)
  if (bloques.length === 0) return []

  const [{ data: reservas }, { data: entrevistas }, { data: visitas }] = await Promise.all([
    admin.from('reservas_horario').select('inicio, fin, estado, vence_en').eq('compita_id', compitaId).in('estado', ['reservada', 'confirmada']),
    admin.from('solicitudes').select('slot_confirmado').eq('compita_id', compitaId).eq('estado', 'aceptada').not('slot_confirmado', 'is', null),
    admin.from('visitas').select('fecha_programada, hora_inicio_programada, hora_fin_programada').eq('compita_id', compitaId)
      .in('estado', ['pre_visita', 'programada', 'confirmando_inicio', 'en_curso']).not('fecha_programada', 'is', null),
  ])

  const ocupados: [number, number][] = []
  for (const r of (reservas ?? []) as { inicio: string; fin: string; estado: string; vence_en: string }[]) {
    if (r.estado === 'reservada' && new Date(r.vence_en).getTime() <= ahora.getTime()) continue // ya venció: no cuenta
    ocupados.push([new Date(r.inicio).getTime(), new Date(r.fin).getTime()])
  }
  for (const e of (entrevistas ?? []) as { slot_confirmado: string }[]) {
    const t = new Date(e.slot_confirmado).getTime()
    ocupados.push([t, t + BLOQUE_MIN * MIN_MS]) // la llamada dura 20 min (un bloque); las 23 de la sala son solo margen de cierre
  }
  for (const v of (visitas ?? []) as { fecha_programada: string; hora_inicio_programada: string | null; hora_fin_programada: string | null }[]) {
    if (!v.hora_inicio_programada) continue
    const ini = new Date(`${v.fecha_programada}T${v.hora_inicio_programada}:00-04:00`).getTime()
    const fin = v.hora_fin_programada ? new Date(`${v.fecha_programada}T${v.hora_fin_programada}:00-04:00`).getTime() : ini + 2 * 3600_000
    if (Number.isFinite(ini) && Number.isFinite(fin)) ocupados.push([ini, fin])
  }
  return bloques.filter((b) => !ocupados.some(([i, f]) => solapa(b, i, f)))
}

export interface Reserva {
  id: string; compita_id: string; cliente_id: string; solicitud_id: string | null
  inicio: string; fin: string; estado: 'reservada' | 'confirmada' | 'rechazada' | 'liberada' | 'vencida'
  vence_en: string; creada_en: string; resuelta_en: string | null
}

export type ResultadoReserva =
  | { ok: true; reserva: Reserva }
  | { ok: false; motivo: 'hora_invalida' | 'no_disponible' | 'ocupada' | 'solicitud_con_reserva' | 'error'; mensaje: string }

const falla = (motivo: Exclude<ResultadoReserva, { ok: true }>['motivo'], mensaje: string): ResultadoReserva => ({ ok: false, motivo, mensaje })

/**
 * Reserva una hora libre para una solicitud. La reserva dura `reserva_horario_horas` (Ajustes) pero NUNCA más allá de la
 * hora de la cita. Si dos personas la piden a la vez, solo una gana: la otra recibe "ocupada" y puede elegir otra.
 */
export async function reservarHorario(i: { compitaId: string; clienteId: string; solicitudId: string | null; inicio: string; ahora?: Date }): Promise<ResultadoReserva> {
  const ahora = i.ahora ?? new Date()
  const t = new Date(i.inicio).getTime()
  if (!Number.isFinite(t) || new Date(i.inicio).toISOString() !== new Date(t).toISOString() || t % (BLOQUE_MIN * MIN_MS) !== 0) {
    return falla('hora_invalida', 'Esa hora no es válida.')
  }
  // Primero liberar lo vencido de este compita: una reserva olvidada no debe bloquear la hora para siempre.
  await liberarVencidas(ahora, i.compitaId)
  const libres = await horasLibres(i.compitaId, { ahora })
  if (!libres.some((b) => b.inicio === new Date(t).toISOString())) return falla('no_disponible', 'Esa hora ya no está disponible. Elige otra.')

  const reservaH = Number(await getAjuste('reserva_horario_horas'))
  const vence = Math.min(ahora.getTime() + reservaH * 3600_000, t) // nunca después de la cita
  const { data, error } = await createAdminSupabase().from('reservas_horario').insert({
    compita_id: i.compitaId, cliente_id: i.clienteId, solicitud_id: i.solicitudId,
    inicio: new Date(t).toISOString(), fin: new Date(t + BLOQUE_MIN * MIN_MS).toISOString(),
    estado: 'reservada', vence_en: new Date(vence).toISOString(),
  }).select('*').single()
  if (error || !data) {
    const msg = error?.message ?? ''
    if (/una_por_solicitud/.test(msg)) return falla('solicitud_con_reserva', 'Esta solicitud ya tiene una hora reservada.')
    if (error?.code === '23505' || /duplicate|unique/i.test(msg)) return falla('ocupada', 'Alguien acaba de tomar esa hora. Elige otra.')
    console.error('[agenda] no se pudo reservar:', msg)
    return falla('error', 'No pudimos reservar la hora. Intenta de nuevo.')
  }
  const reserva = data as Reserva
  await registrarEvento({ entidad: 'solicitud', entidadId: i.solicitudId ?? reserva.id, tipo: 'horario_reservado', actor: `cliente:${i.clienteId}`, datos: { compita_id: i.compitaId, inicio: reserva.inicio } })
  return { ok: true, reserva }
}

export type ResultadoRespuestaReserva = { ok: true; reserva: Reserva } | { ok: false; motivo: 'no_encontrada' | 'vencida' | 'ya_resuelta' }

async function resolver(id: string, compitaId: string, nuevo: 'confirmada' | 'rechazada', ahora: Date): Promise<ResultadoRespuestaReserva> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('reservas_horario').select('*').eq('id', id).eq('compita_id', compitaId).maybeSingle()
  const r = data as Reserva | null
  if (!r) return { ok: false, motivo: 'no_encontrada' }
  if (r.estado !== 'reservada') return { ok: false, motivo: 'ya_resuelta' }
  if (new Date(r.vence_en).getTime() <= ahora.getTime()) { await liberarVencidas(ahora, compitaId); return { ok: false, motivo: 'vencida' } }
  // Cambio atómico: solo una respuesta puede pasar de 'reservada' a su estado final.
  const { data: act } = await admin.from('reservas_horario')
    .update({ estado: nuevo, resuelta_en: ahora.toISOString() }).eq('id', id).eq('compita_id', compitaId).eq('estado', 'reservada').select('*').maybeSingle()
  if (!act) return { ok: false, motivo: 'ya_resuelta' }
  const reserva = act as Reserva
  await registrarEvento({ entidad: 'solicitud', entidadId: reserva.solicitud_id ?? reserva.id, tipo: nuevo === 'confirmada' ? 'reserva_confirmada' : 'reserva_rechazada', actor: `compita:${compitaId}`, datos: { inicio: reserva.inicio } })
  return { ok: true, reserva }
}

/** El compita confirma la hora reservada. */
export const confirmarReserva = (id: string, compitaId: string, ahora: Date = new Date()) => resolver(id, compitaId, 'confirmada', ahora)
/** El compita dice "No puedo a esa hora": la hora vuelve a estar libre para otros. */
export const rechazarReserva = (id: string, compitaId: string, ahora: Date = new Date()) => resolver(id, compitaId, 'rechazada', ahora)

/** El cliente (o el equipo) suelta la hora: vuelve a estar libre. */
export async function liberarReserva(id: string, clienteId?: string): Promise<boolean> {
  let q = createAdminSupabase().from('reservas_horario').update({ estado: 'liberada', resuelta_en: new Date().toISOString() }).eq('id', id).in('estado', ['reservada', 'confirmada'])
  if (clienteId) q = q.eq('cliente_id', clienteId)
  const { data } = await q.select('id').maybeSingle()
  return !!data
}
