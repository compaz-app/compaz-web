// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Lógica de negocio para solicitudes de entrevista
// ══════════════════════════════════════════════════════════════════════════════
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Solicitud, SolicitudEstado } from '@/types'

export type { Solicitud, SolicitudEstado }

const MAX_SOLICITUDES_ACTIVAS = 3
const DIAS_EXPIRACION = 30

// ── Helpers de mapping ────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Solicitud {
  const c = row.compitas as { nombre: string; foto_url: string | null; zona: string } | null
  return {
    id: row.id as string,
    cliente_id: row.cliente_id as string,
    compita_id: row.compita_id as string,
    mensaje: row.mensaje as string,
    estado: row.estado as SolicitudEstado,
    franja_horaria: (row.franja_horaria as string | null) ?? null,
    slots_propuestos: (row.slots_propuestos as string[]) ?? [],
    slot_confirmado: (row.slot_confirmado as string | null) ?? null,
    room_url: (row.room_url as string | null) ?? null,
    recordatorio_enviado: (row.recordatorio_enviado as boolean) ?? false,
    seguimiento_enviado: (row.seguimiento_enviado as boolean) ?? false,
    seguimiento2_enviado: (row.seguimiento2_enviado as boolean) ?? false,
    token_respuesta: row.token_respuesta as string,
    created_at: row.created_at as string,
    respondido_at: (row.respondido_at as string | null) ?? null,
    compita_nombre: c?.nombre,
    compita_foto: c?.foto_url,
    compita_zona: c?.zona,
  }
}

const SELECT_FIELDS = `
  id, cliente_id, compita_id, mensaje, estado, franja_horaria,
  slots_propuestos, slot_confirmado, room_url, recordatorio_enviado, seguimiento_enviado,
  seguimiento2_enviado, token_respuesta, created_at, respondido_at,
  compitas ( nombre, foto_url, zona )
`

// ── Consultas ─────────────────────────────────────────────────────────────────

/**
 * Solicitudes activas de un cliente (últimos 30 días).
 */
export async function getSolicitudesCliente(clienteId: string): Promise<Solicitud[]> {
  const supabase = createAdminSupabase()
  const hace30dias = new Date(Date.now() - DIAS_EXPIRACION * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .eq('cliente_id', clienteId)
    .gte('created_at', hace30dias)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

/**
 * Todas las solicitudes para el panel admin.
 */
export async function getSolicitudesAdmin(): Promise<Solicitud[]> {
  const supabase = createAdminSupabase()

  const { data, error } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

/**
 * Solicitudes con slot confirmado en los próximos 55-65 minutos sin recordatorio enviado.
 * Usado por el cron de recordatorios (se ejecuta cada 5 min).
 */
export async function getSolicitudesParaRecordatorio(): Promise<Solicitud[]> {
  const supabase = createAdminSupabase()
  const ahora = new Date()
  const en55min = new Date(ahora.getTime() + 55 * 60 * 1000).toISOString()
  const en65min = new Date(ahora.getTime() + 65 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .eq('estado', 'aceptada')
    .eq('recordatorio_enviado', false)
    .gte('slot_confirmado', en55min)
    .lte('slot_confirmado', en65min)

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

// ── Mutaciones ────────────────────────────────────────────────────────────────

export interface CrearSolicitudInput {
  cliente_id: string
  compita_id: string
  mensaje: string
  slots_propuestos: string[]  // hasta 3 ISO datetimes
  franja_horaria?: string
}

/**
 * Crea una nueva solicitud de entrevista.
 * Valida el límite de 3 solicitudes pendientes y que no haya duplicado.
 */
export async function crearSolicitud(input: CrearSolicitudInput): Promise<Solicitud> {
  const supabase = createAdminSupabase()

  const activas = await getSolicitudesCliente(input.cliente_id)
  const pendientes = activas.filter((s) => s.estado === 'pendiente')

  if (pendientes.length >= MAX_SOLICITUDES_ACTIVAS) {
    throw new Error(`Límite de ${MAX_SOLICITUDES_ACTIVAS} solicitudes activas alcanzado`)
  }
  if (pendientes.some((s) => s.compita_id === input.compita_id)) {
    throw new Error('Ya tienes una solicitud pendiente con este compita')
  }

  const { data, error } = await supabase
    .from('solicitudes')
    .insert({
      cliente_id: input.cliente_id,
      compita_id: input.compita_id,
      mensaje: input.mensaje,
      slots_propuestos: input.slots_propuestos,
      franja_horaria: input.franja_horaria ?? null,
      estado: 'pendiente',
      recordatorio_enviado: false,
    })
    .select(SELECT_FIELDS)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as Record<string, unknown>)
}

/**
 * El compita confirma un slot específico (índice 0-2) o rechaza (-1).
 */
export async function confirmarSlot(
  token: string,
  slotIndex: number,
): Promise<Solicitud | null> {
  const supabase = createAdminSupabase()

  const { data: row } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .eq('token_respuesta', token)
    .eq('estado', 'pendiente')
    .single()

  if (!row) return null

  const solicitud = mapRow(row as Record<string, unknown>)

  if (slotIndex === -1) {
    // Rechazo
    const { data: updated } = await supabase
      .from('solicitudes')
      .update({ estado: 'rechazada', respondido_at: new Date().toISOString() })
      .eq('token_respuesta', token)
      .select(SELECT_FIELDS)
      .single()
    return updated ? mapRow(updated as Record<string, unknown>) : null
  }

  const slot = solicitud.slots_propuestos[slotIndex]
  if (!slot) return null

  const { data: updated } = await supabase
    .from('solicitudes')
    .update({
      estado: 'aceptada',
      slot_confirmado: slot,
      respondido_at: new Date().toISOString(),
    })
    .eq('token_respuesta', token)
    .select(SELECT_FIELDS)
    .single()

  return updated ? mapRow(updated as Record<string, unknown>) : null
}

/**
 * Guarda la URL de la sala Daily.co una vez creada.
 */
export async function guardarRoomUrl(solicitudId: string, roomUrl: string): Promise<void> {
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('solicitudes')
    .update({ room_url: roomUrl })
    .eq('id', solicitudId)
  if (error) throw new Error(error.message)
}

/**
 * Solicitudes aceptadas cuya llamada ya terminó (slot + 23 min) sin seguimiento enviado.
 */
export async function getSolicitudesParaSeguimiento(): Promise<Solicitud[]> {
  const supabase = createAdminSupabase()
  const hace23min = new Date(Date.now() - 23 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .eq('estado', 'aceptada')
    .eq('seguimiento_enviado', false)
    .lte('slot_confirmado', hace23min)

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

/**
 * Marca el seguimiento post-llamada como enviado.
 */
export async function marcarSeguimientoEnviado(solicitudId: string): Promise<void> {
  const supabase = createAdminSupabase()
  await supabase.from('solicitudes').update({ seguimiento_enviado: true }).eq('id', solicitudId)
}

/**
 * Solicitudes con seguimiento enviado, sin respuesta, 24h después del slot.
 * Usado para el reenvío del email de seguimiento.
 */
export async function getSolicitudesParaSegundoSeguimiento(): Promise<Solicitud[]> {
  const supabase = createAdminSupabase()
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const hace48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .eq('estado', 'aceptada')
    .eq('seguimiento_enviado', true)
    .eq('seguimiento2_enviado', false)
    .is('respondido_at', null)
    .lte('slot_confirmado', hace24h)
    .gte('slot_confirmado', hace48h)

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

/**
 * Marca el segundo seguimiento como enviado.
 */
export async function marcarSeguimiento2Enviado(solicitudId: string): Promise<void> {
  const supabase = createAdminSupabase()
  await supabase.from('solicitudes').update({ seguimiento2_enviado: true }).eq('id', solicitudId)
}

/**
 * Busca una solicitud por token (sin filtro de estado).
 */
export async function getSolicitudPorToken(token: string): Promise<Solicitud | null> {
  const supabase = createAdminSupabase()
  const { data } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .eq('token_respuesta', token)
    .single()
  return data ? mapRow(data as Record<string, unknown>) : null
}

/**
 * Marca el recordatorio como enviado para evitar duplicados.
 */
export async function marcarRecordatorioEnviado(solicitudId: string): Promise<void> {
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('solicitudes')
    .update({ recordatorio_enviado: true })
    .eq('id', solicitudId)
  if (error) throw new Error(error.message)
}
