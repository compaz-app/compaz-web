// ══════════════════════════════════════════════════════════════════════════════
// Compaz Platform — Tipos TypeScript
// ══════════════════════════════════════════════════════════════════════════════

export type ZonaEstado = 'activo' | 'inactivo'
export type VisitaEstado = 'programada' | 'en_curso' | 'terminada'
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
  created_at: string
}

export interface Usuario {
  id: string
  nombre: string
  email: string
  zona: string | null
  plan: string | null
  compita_id: string | null
  created_at: string
  compita?: Compita
}

export interface Visita {
  id: string
  compita_id: string
  usuario_id: string
  estado: VisitaEstado
  inicio: string | null
  fin: string | null
  room_url: string | null
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
}

export interface TelegramMessage {
  message_id: number
  from: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  photo?: TelegramPhotoSize[]
  caption?: string
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

// ── API responses ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
  status: number
}

export interface CreateCallResponse {
  url: string
  room_name: string
}
