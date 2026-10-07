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
    sobre_cliente: (row.sobre_cliente as string | null) ?? null,
    estado: row.estado as SolicitudEstado,
    franja_horaria: (row.franja_horaria as string | null) ?? null,
    slots_propuestos: (row.slots_propuestos as string[]) ?? [],
    slot_confirmado: (row.slot_confirmado as string | null) ?? null,
    room_url: (row.room_url as string | null) ?? null,
    recordatorio_enviado: (row.recordatorio_enviado as boolean) ?? false,
    seguimiento_enviado: (row.seguimiento_enviado as boolean) ?? false,
    seguimiento2_enviado: (row.seguimiento2_enviado as boolean) ?? false,
    confirmacion_llamada_enviada: (row.confirmacion_llamada_enviada as boolean) ?? false,
    confirmacion_cliente: row.confirmacion_cliente as boolean | null ?? null,
    confirmacion_compita: row.confirmacion_compita as boolean | null ?? null,
    reagendado_slots: (row.reagendado_slots as string[]) ?? [],
    token_respuesta: row.token_respuesta as string,
    created_at: row.created_at as string,
    respondido_at: (row.respondido_at as string | null) ?? null,
    compita_nombre: c?.nombre,
    compita_foto: c?.foto_url,
    compita_zona: c?.zona,
  }
}

const SELECT_FIELDS = `
  id, cliente_id, compita_id, mensaje, sobre_cliente, estado, franja_horaria,
  slots_propuestos, slot_confirmado, room_url, recordatorio_enviado, seguimiento_enviado,
  seguimiento2_enviado, confirmacion_llamada_enviada, confirmacion_cliente, confirmacion_compita,
  reagendado_slots, token_respuesta, created_at, respondido_at,
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
  const hace30min = new Date(ahora.getTime() - 30 * 60 * 1000).toISOString()
  const en65min = new Date(ahora.getTime() + 65 * 60 * 1000).toISOString()

  // Ventana: slot entre -30 min y +65 min desde ahora, sin recordatorio enviado.
  // El límite inferior cubre retrasos del cron (Netlify latency, cold starts).
  // El flag recordatorio_enviado=false previene duplicados si el cron corre varias veces.
  const { data, error } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .eq('estado', 'aceptada')
    .eq('recordatorio_enviado', false)
    .gte('slot_confirmado', hace30min)
    .lte('slot_confirmado', en65min)

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

// ── Mutaciones ────────────────────────────────────────────────────────────────

export interface CrearSolicitudInput {
  cliente_id: string
  compita_id: string
  mensaje: string
  sobre_cliente?: string | null
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
      sobre_cliente: input.sobre_cliente ?? null,
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
    .eq('estado', 'pendiente')
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
 * Solicitudes listas para "¿quieres contratar?":
 * - Ambas partes confirmaron YES, o
 * - Han pasado 4h desde el slot y ninguna dijo NO (timeout: asumimos que ocurrió)
 */
export async function getSolicitudesParaSeguimiento(): Promise<Solicitud[]> {
  const supabase = createAdminSupabase()
  const hace4h = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

  // Caso A: ambas confirmaron
  const { data: ambas, error: e1 } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .eq('estado', 'aceptada')
    .eq('seguimiento_enviado', false)
    .eq('confirmacion_cliente', true)
    .eq('confirmacion_compita', true)

  if (e1) throw new Error(e1.message)

  // Caso B: timeout 4h — confirmación enviada, nadie dijo NO, slot ya pasó
  const { data: timeout, error: e2 } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .eq('estado', 'aceptada')
    .eq('seguimiento_enviado', false)
    .eq('confirmacion_llamada_enviada', true)
    .neq('confirmacion_cliente', false)
    .neq('confirmacion_compita', false)
    .lte('slot_confirmado', hace4h)

  if (e2) throw new Error(e2.message)

  // Deduplicar por id (Caso A puede solaparse con Caso B después de 4h)
  const vistos = new Set<string>()
  const resultado: Solicitud[] = []
  for (const row of [...(ambas ?? []), ...(timeout ?? [])]) {
    const s = mapRow(row as Record<string, unknown>)
    if (!vistos.has(s.id)) { vistos.add(s.id); resultado.push(s) }
  }
  return resultado
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

// ── Confirmación post-llamada ─────────────────────────────────────────────────

/**
 * Solicitudes cuya llamada terminó hace 25+ minutos y aún no se envió la confirmación.
 */
export async function getSolicitudesParaConfirmacion(): Promise<Solicitud[]> {
  const supabase = createAdminSupabase()
  const hace25min = new Date(Date.now() - 25 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .eq('estado', 'aceptada')
    .eq('confirmacion_llamada_enviada', false)
    .lte('slot_confirmado', hace25min)

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

/**
 * Marca que se enviaron los mensajes de "¿ocurrió la llamada?".
 */
export async function marcarConfirmacionEnviada(solicitudId: string): Promise<void> {
  const supabase = createAdminSupabase()
  await supabase
    .from('solicitudes')
    .update({ confirmacion_llamada_enviada: true })
    .eq('id', solicitudId)
}

/**
 * Registra la respuesta de cliente o compita sobre si ocurrió la llamada.
 * Idempotente: si ya hay una respuesta registrada, devuelve la solicitud sin cambiarla.
 */
export async function registrarConfirmacion(
  solicitudId: string,
  quien: 'cliente' | 'compita',
  ocurrio: boolean,
): Promise<Solicitud | null> {
  const supabase = createAdminSupabase()
  const campo = quien === 'cliente' ? 'confirmacion_cliente' : 'confirmacion_compita'

  // Solo actualiza si el campo aún es null — previene que un segundo clic sobreescriba la respuesta original
  const { data, error } = await supabase
    .from('solicitudes')
    .update({ [campo]: ocurrio })
    .eq('id', solicitudId)
    .is(campo, null)
    .select(SELECT_FIELDS)
    .single()

  if (error || !data) {
    // El campo ya tenía valor — devolver la solicitud sin modificar
    const { data: existing } = await supabase
      .from('solicitudes')
      .select(SELECT_FIELDS)
      .eq('id', solicitudId)
      .single()
    return existing ? mapRow(existing as Record<string, unknown>) : null
  }
  return mapRow(data as Record<string, unknown>)
}

/**
 * Inicia reagendado desde el compita: resetea la solicitud aceptada a pendiente
 * para que el compita pueda sugerir nuevos horarios por Telegram.
 * Acepta solicitudes en estado 'aceptada'.
 */
export async function iniciarReagendadoPorCompita(
  token: string,
): Promise<Solicitud | null> {
  const supabase = createAdminSupabase()
  const { data: row } = await supabase
    .from('solicitudes')
    .select(SELECT_FIELDS)
    .eq('token_respuesta', token)
    .in('estado', ['aceptada', 'pendiente'])
    .single()

  if (!row) return null

  const { data: updated } = await supabase
    .from('solicitudes')
    .update({
      estado: 'rechazada',
      slot_confirmado: null,
      room_url: null,
      recordatorio_enviado: false,
      seguimiento_enviado: false,
      seguimiento2_enviado: false,
      confirmacion_llamada_enviada: false,
      confirmacion_cliente: null,
      confirmacion_compita: null,
    })
    .eq('token_respuesta', token)
    .select(SELECT_FIELDS)
    .single()

  return updated ? mapRow(updated as Record<string, unknown>) : null
}

/**
 * Guarda los slots propuestos por el cliente en el reagendado.
 * Resetea el estado a 'pendiente' para reiniciar el ciclo.
 */
export async function guardarSlotsReagendado(
  solicitudId: string,
  slots: string[],
): Promise<void> {
  const supabase = createAdminSupabase()
  await supabase
    .from('solicitudes')
    .update({
      reagendado_slots: slots,
      slots_propuestos: slots,
      estado: 'pendiente',
      slot_confirmado: null,
      room_url: null,
      recordatorio_enviado: false,
      seguimiento_enviado: false,
      seguimiento2_enviado: false,
      confirmacion_llamada_enviada: false,
      confirmacion_cliente: null,
      confirmacion_compita: null,
    })
    .eq('id', solicitudId)
}
