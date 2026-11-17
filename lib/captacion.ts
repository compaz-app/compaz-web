// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Captación: postulaciones de familias y aspirantes a Compita
//
// Supabase es la fuente principal: cada postulación se guarda primero aquí
// (supabase/migrations/20261022_captacion.sql) y después se copia a Airtable
// mientras el CMC dependa de Airtable.
//
// Garantías:
//   · Sin pérdidas: la persona solo recibe "ok" cuando la postulación está guardada.
//   · Sin duplicados en Airtable: cada postulación tiene una huella fija
//     (Contacto + Fecha con milisegundos). Todo reintento busca esa huella antes de
//     crear; si ya existe, la vincula. Si la búsqueda falla, no crea nada.
//   · Sin postulaciones invisibles: lo que no llega a Airtable queda en la bandeja
//     /admin/postulaciones, con aviso por Telegram hasta que alguien lo resuelve.
//   · Ruta de respaldo conciliada: lo que la web guarde directamente en Airtable
//     porque Supabase falló se importa después (conciliarAirtable).
// ══════════════════════════════════════════════════════════════════════════════
import { createAdminSupabase } from '@/lib/supabase-server'
import { avisarAdmin } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { reclamarUnaVez } from '@/lib/cron'
import { hoyVE } from '@/lib/format'
import { SITE_URL } from '@/lib/email'

export type TipoPostulacion = 'familia' | 'compita' | 'desconocido'

export type FuentePostulacion = 'home' | 'se_compita' | 'otra'

// ── Normalización (funciones puras) ────────────────────────────────────────────

/**
 * Teléfono a E.164 (+584121234567), o null si no se puede normalizar con seguridad.
 * Venezuela: acepta "0412…", "412…", "+58412…", "58412…" y el error frecuente
 * "+580412…" (cero de más tras el código de país, visto en la hoja 03).
 */
export function normalizarTelefono(valor: string): string | null {
  const limpio = valor.trim()
  if (!limpio) return null
  const conMas = limpio.startsWith('+')
  let digitos = limpio.replace(/\D/g, '')
  if (!digitos) return null

  if (!conMas) {
    if (/^0[24]\d{9}$/.test(digitos)) digitos = '58' + digitos.slice(1)
    else if (/^[24]\d{9}$/.test(digitos)) digitos = '58' + digitos
  }
  if (/^580[24]\d{9}$/.test(digitos)) digitos = '58' + digitos.slice(3)

  if (digitos.startsWith('58') && !/^58[24]\d{9}$/.test(digitos)) return null
  if (!/^[1-9]\d{7,14}$/.test(digitos)) return null
  return '+' + digitos
}

export function normalizarEmail(valor: string): string | null {
  const email = valor.trim().toLowerCase()
  if (!email || email.length > 100) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

/** Lee el rol del texto "… | Rol: compa" que el formulario envía hoy. */
export function tipoDesdeContacto(contacto: string): TipoPostulacion {
  const rol = (contacto.match(/Rol:\s*([^|]*)$/i)?.[1] ?? '').trim().toLowerCase()
  if (rol === 'compa' || rol === 'compita') return 'compita'
  if (rol === 'familia') return 'familia'
  return 'desconocido'
}

/** Valor de "Rol" que esperan las fórmulas de Airtable. */
export function rolParaAirtable(tipo: TipoPostulacion): string {
  return tipo === 'compita' ? 'compa' : tipo === 'familia' ? 'familia' : ''
}

/**
 * Texto "Contacto" canónico. Se construye siempre en el servidor con los datos ya
 * saneados, para que sea idéntico en el primer intento y en cada reintento (huella).
 */
export function contactoCanonico(telefono: string, email: string, tipo: TipoPostulacion): string {
  return `WA: ${telefono} | Email: ${email} | Rol: ${rolParaAirtable(tipo)}`
}

/** "WA: … | Email: … | Rol: …" → partes. null si el texto no tiene ese formato. */
export function leerContacto(contacto: string): { telefono: string; email: string; tipo: TipoPostulacion } | null {
  const m = contacto.match(/^\s*WA:\s*([^|]*?)\s*\|\s*Email:\s*([^|]*?)\s*\|\s*Rol:\s*([^|]*?)\s*$/i)
  if (!m || (!m[1] && !m[2])) return null
  return { telefono: m[1], email: m[2], tipo: tipoDesdeContacto(contacto) }
}

/** "Chacao, Miranda" → { ciudad: "Chacao", region: "Miranda" } */
export function separarUbicacion(ubicacion: string): { ciudad: string | null; region: string | null } {
  const partes = ubicacion.split(',').map((p) => p.trim()).filter(Boolean)
  if (partes.length === 0) return { ciudad: null, region: null }
  if (partes.length === 1) return { ciudad: partes[0], region: null }
  return { ciudad: partes.slice(0, -1).join(', '), region: partes[partes.length - 1] }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Clave por envío generada en el navegador; si falta o es inválida, el servidor crea una. */
export function claveIdempotencia(valor: unknown): string {
  return typeof valor === 'string' && UUID.test(valor) ? valor.toLowerCase() : crypto.randomUUID()
}

export function fuenteValida(valor: unknown): FuentePostulacion {
  return valor === 'home' || valor === 'se_compita' ? valor : 'otra'
}

// ── Acceso a las funciones de Supabase ────────────────────────────────────────

type ErrorRpc = { message: string }

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: ErrorRpc | null }> {
  try {
    const { data, error } = await createAdminSupabase().rpc(fn, args)
    return { data: (data ?? null) as T | null, error: error ? { message: error.message } : null }
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'excepción' } }
  }
}

// ── Registro desde el formulario ──────────────────────────────────────────────

export interface DatosPostulacion {
  clave: string
  fuente: FuentePostulacion
  nombre: string
  whatsapp: string          // tal como lo escribió la persona (ya saneado)
  email: string             // tal como lo escribió la persona (ya saneado)
  contacto: string          // texto del formulario; solo se usa para leer el rol
  ubicacion: string         // "ciudad, estado"
  utm: { source: string; medium: string; campaign: string; content: string; term: string }
}

export type ResultadoRegistro =
  | { ok: true; postulacionId: string; resultado: 'registrada' | 'repetida' | 'reintento_tecnico' }
  | { ok: false; error: string }

/**
 * Guarda la postulación en Supabase (identidad, repetidas y huella las resuelve la función SQL `registrar_postulacion`). El CMC la lee de ahí
 * (/api/cmc/postulaciones). Ya no se copia a ningún otro sistema.
 */
export async function registrarPostulacion(d: DatosPostulacion): Promise<ResultadoRegistro> {
  const tipo = tipoDesdeContacto(d.contacto)
  const { ciudad, region } = separarUbicacion(d.ubicacion)
  const { data, error } = await rpc<Array<{ postulacion_id: string; resultado: string; recibida_en: string }>>(
    'registrar_postulacion', {
      p_clave: d.clave, p_tipo: tipo, p_fuente: d.fuente, p_nombre: d.nombre,
      p_telefono_e164: normalizarTelefono(d.whatsapp), p_email_norm: normalizarEmail(d.email),
      p_ciudad: ciudad, p_region: region,
      p_telefono_decl: d.whatsapp, p_email_decl: d.email, p_ubicacion_decl: d.ubicacion,
      p_utm: d.utm,
    })
  const fila = Array.isArray(data) ? data[0] : null
  if (error || !fila) {
    console.error('[captacion] registrar_postulacion falló:', error?.message ?? 'sin fila')
    return { ok: false, error: 'No se pudo guardar la postulación' }
  }
  return { ok: true, postulacionId: String(fila.postulacion_id), resultado: fila.resultado as 'registrada' | 'repetida' | 'reintento_tecnico' }
}

// ── Bandeja de postulaciones que no llegaron a Airtable ──────────────────────

export interface PostulacionPorResolver {
  id: string; recibida_en: string; tipo: TipoPostulacion; nombre: string; telefono: string; email: string
  ubicacion: string; airtable_estado: 'agotada' | 'conflicto'; airtable_intentos: number
  airtable_ultimo_error: string | null; coincidencia: string
}

export async function postulacionesPorResolver(limite = 200): Promise<PostulacionPorResolver[]> {
  const { data, error } = await rpc<PostulacionPorResolver[]>('postulaciones_por_resolver', { p_limite: limite })
  if (error) throw new Error(`postulaciones_por_resolver: ${error.message}`)
  return data ?? []
}

export type Resolucion = 'registrada_en_cmc' | 'no_procede'

export type ResultadoResolucion = { ok: true } | { ok: false; error: string }

/** Resuelve una postulación de la bandeja: o se registró directo en el CMC (la nota lleva el ID COM-) o no procede (la nota lleva el motivo). */
export async function resolverPostulacion(id: string, resolucion: Resolucion, actor: string, nota: string): Promise<ResultadoResolucion> {
  if (!UUID.test(id)) return { ok: false, error: 'Postulación no válida' }
  if (!['registrada_en_cmc', 'no_procede'].includes(resolucion)) return { ok: false, error: 'Resolución no válida' }
  const notaLimpia = nota.trim().slice(0, 500)
  if (!notaLimpia) return { ok: false, error: 'Escribe una nota (por ejemplo el ID COM- o el motivo)' }
  const { data, error } = await rpc<boolean>('resolver_postulacion', { p_id: id, p_resolucion: resolucion, p_actor: actor, p_nota: notaLimpia, p_airtable_id: null })
  if (error) return { ok: false, error: 'No se pudo guardar la resolución' }
  if (!data) return { ok: false, error: 'La postulación ya no está pendiente' }
  return { ok: true }
}
