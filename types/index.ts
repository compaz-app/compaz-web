// ══════════════════════════════════════════════════════════════════════════════
// Compaz Platform — Tipos TypeScript
// ══════════════════════════════════════════════════════════════════════════════

export type ZonaEstado = 'activo' | 'inactivo' | 'bloqueado'
export type DiaSemana = 'lunes' | 'martes' | 'miércoles' | 'jueves' | 'viernes' | 'sábado' | 'domingo'

export interface HorarioDisponible {
  dia: DiaSemana
  inicio: string // "09:00" en hora Venezuela (UTC-4)
  fin: string    // "17:00" — bloques de 20 min, máximo 20:00
}
export type VisitaEstado = 'pre_visita' | 'programada' | 'en_curso' | 'terminada'
export type MensajeOrigen = 'compita' | 'cliente' | 'admin'
export type MensajeTipo = 'texto' | 'foto'

export interface Zona {
  id: string
  nombre: string
  activa: boolean
  created_at: string
}

export interface Compita {
  id: string
  nombre: string
  email: string | null
  telegram_chat_id: string | null
  zona: string
  estado: ZonaEstado
  verificado: boolean
  fecha_ingreso: string
  visitas_realizadas: number
  foto_url: string | null
  descripcion: string | null
  servicios: string[] | null
  youtube_url: string | null
  codigo: string | null
  horarios_disponibles: HorarioDisponible[] | null
  created_at: string
  // Rating público (promedio 1-5 de visitas calificadas)
  rating_promedio: number | null
  total_ratings: number
  // Stats calculados en runtime (no en BD)
  tasa_aceptacion?: number | null
  total_solicitudes?: number
}

export interface Usuario {
  id: string
  nombre: string
  email: string
  zona: string | null
  plan: string | null
  compita_id: string | null
  familiar_nombre: string | null
  familiar_edad: number | null
  familiar_condicion: string | null
  familiar_notas: string | null
  created_at: string
  compita?: Compita
}

export interface Visita {
  id: string
  compita_id: string
  usuario_id: string
  estado: VisitaEstado
  fecha_programada: string | null
  hora_inicio_programada: string | null  // 'HH:MM'
  hora_fin_programada: string | null     // 'HH:MM'
  inicio: string | null
  fin: string | null
  room_url: string | null
  rating_cliente: number | null  // 1-5
  created_at: string
  compita?: Compita
  usuario?: Usuario
  mensajes?: Mensaje[]
}

export interface Mensaje {
  id: string
  visit_id: string
  origen: MensajeOrigen
  tipo: MensajeTipo
  contenido: string | null
  created_at: string
}

// ── Telegram Bot API ──────────────────────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

export interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

export interface TelegramMessage {
  message_id: number
  from: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  photo?: TelegramPhotoSize[]
  caption?: string
  reply_to_message?: { message_id: number }
}

export interface TelegramUser {
  id: number
  first_name: string
  username?: string
}

export interface TelegramChat {
  id: number
  type: string
}

export interface TelegramPhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

// ── Daily.co ──────────────────────────────────────────────────────────────────

export interface DailyRoom {
  id: string
  name: string
  url: string
  created_at: string
}

// ── Solicitudes de entrevista ─────────────────────────────────────────────────

export type SolicitudEstado = 'pendiente' | 'aceptada' | 'rechazada' | 'completada' | 'contratada'

export interface Solicitud {
  id: string
  cliente_id: string
  compita_id: string
  compita_nombre?: string
  compita_foto?: string | null
  compita_zona?: string
  mensaje: string
  sobre_cliente?: string | null
  estado: SolicitudEstado
  franja_horaria?: string | null
  token_respuesta: string
  slots_propuestos: string[]      // ISO datetimes propuestos por el cliente (hasta 3)
  slot_confirmado?: string | null // ISO datetime confirmado por el compita
  room_url?: string | null        // URL Daily.co (se crea al confirmar el slot)
  recordatorio_enviado: boolean
  seguimiento_enviado: boolean
  seguimiento2_enviado: boolean
  // Confirmación post-llamada (¿ocurrió la llamada?)
  confirmacion_llamada_enviada: boolean
  confirmacion_cliente: boolean | null   // null=sin respuesta, true=✅, false=❌
  confirmacion_compita: boolean | null   // null=sin respuesta, true=✅, false=❌
  reagendado_slots: string[]             // slots propuestos en reagendado
  created_at: string
  respondido_at?: string | null
}

// ── Reportes de visita ────────────────────────────────────────────────────────

export interface ReporteVisita {
  id: string
  visita_id: string
  animo: number | null           // 1-5 o null (N/A)
  fisico: number | null
  participacion: number | null
  entorno: number | null
  novedad: string | null
  resumen_ia: string | null
  created_at: string
  visita?: Visita
}

// ── API responses ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
  status: number
}

export interface CreateCallResponse {
  url: string
  room_name: string
}
