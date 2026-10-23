// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Captación: postulaciones de familias y aspirantes a Compita
//
// Supabase es la fuente principal: cada postulación se guarda primero aquí
// (función registrar_postulacion, ver supabase/migrations/20261022_captacion.sql)
// y después se copia a Airtable mientras el CMC dependa de Airtable.
//
// Reglas clave (decisiones del 22 oct):
//   · El uuid de la persona es su identificador permanente. Teléfono y correo
//     solo sirven para detectar coincidencias; nunca se fusiona en silencio.
//   · Reintento técnico (misma clave o mismos datos en 15 min) ≠ postulación nueva.
//   · Una postulación repetida se guarda, pero no se reenvía a Airtable.
// ══════════════════════════════════════════════════════════════════════════════
import { createAdminSupabase } from '@/lib/supabase-server'
import { crearRegistroAirtable, type CamposAirtable } from '@/lib/airtable'

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

// ── Registro ──────────────────────────────────────────────────────────────────

export interface DatosPostulacion {
  clave: string
  fuente: FuentePostulacion
  nombre: string
  whatsapp: string          // tal como lo escribió la persona (ya saneado)
  email: string             // tal como lo escribió la persona (ya saneado)
  contacto: string          // texto "WA: … | Email: … | Rol: …"
  ubicacion: string         // "ciudad, estado"
  utm: { source: string; medium: string; campaign: string; content: string; term: string }
}

export type ResultadoRegistro =
  | { ok: true; postulacionId: string; resultado: 'registrada' | 'repetida' | 'reintento_tecnico'; airtable: 'enviada' | 'pendiente' | 'no_aplica' }
  | { ok: false; error: string }

/**
 * Guarda la postulación en Supabase y, si corresponde, intenta copiarla a Airtable
 * en el momento. Si Airtable falla, queda pendiente para el cron de reintentos:
 * la postulación ya está a salvo en Supabase.
 */
export async function registrarPostulacion(d: DatosPostulacion): Promise<ResultadoRegistro> {
  const tipo = tipoDesdeContacto(d.contacto)
  const { ciudad, region } = separarUbicacion(d.ubicacion)
  let data: unknown, error: { message: string } | null
  try {
    ;({ data, error } = await createAdminSupabase().rpc('registrar_postulacion', {
    p_clave: d.clave,
    p_tipo: tipo,
    p_fuente: d.fuente,
    p_nombre: d.nombre,
    p_telefono_e164: normalizarTelefono(d.whatsapp),
    p_email_norm: normalizarEmail(d.email),
    p_ciudad: ciudad,
    p_region: region,
    p_telefono_decl: d.whatsapp,
    p_email_decl: d.email,
    p_ubicacion_decl: d.ubicacion,
    p_utm: d.utm,
    }))
  } catch (e) {
    error = { message: e instanceof Error ? e.message : 'excepción' }
  }
  const fila = (Array.isArray(data) ? data[0] : data) as
    { postulacion_id: string; resultado: string; enviar_a_airtable: boolean } | null | undefined
  if (error || !fila) {
    console.error('[captacion] registrar_postulacion falló:', error?.message ?? 'sin fila')
    return { ok: false, error: 'No se pudo guardar la postulación' }
  }

  const postulacionId = String(fila.postulacion_id)
  const resultado = fila.resultado as 'registrada' | 'repetida' | 'reintento_tecnico'
  if (!fila.enviar_a_airtable) return { ok: true, postulacionId, resultado, airtable: 'no_aplica' }

  const envio = await crearRegistroAirtable({
    nombre: d.nombre, contacto: d.contacto, ciudad: d.ubicacion, fecha: new Date().toISOString(),
    utmSource: d.utm.source, utmMedium: d.utm.medium, utmCampaign: d.utm.campaign,
  })
  const marcado = await marcarEnvioAirtable(postulacionId, envio.ok, envio.ok ? envio.id : null, envio.ok ? null : envio.error)
  return { ok: true, postulacionId, resultado, airtable: envio.ok && marcado === 'enviada' ? 'enviada' : 'pendiente' }
}

async function marcarEnvioAirtable(id: string, ok: boolean, airtableId: string | null, error: string | null): Promise<string | null> {
  const { data, error: e } = await createAdminSupabase().rpc('marcar_envio_airtable', {
    p_id: id, p_ok: ok, p_airtable_id: airtableId, p_error: error,
  })
  if (e) {
    // Si esto falla tras un envío correcto, el cron podría reenviarla: queda en el log para revisarlo.
    console.error('[captacion] marcar_envio_airtable falló:', id, e.message)
    return null
  }
  return (data as string | null) ?? null
}

// ── Reintentos (cron) ─────────────────────────────────────────────────────────

interface FilaPendiente {
  id: string
  tipo: TipoPostulacion
  nombre_declarado: string
  telefono_declarado: string
  email_declarado: string
  ubicacion_declarada: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  recibida_en: string
}

export function camposAirtableDesdeFila(f: FilaPendiente): CamposAirtable {
  return {
    nombre: f.nombre_declarado,
    contacto: `WA: ${f.telefono_declarado} | Email: ${f.email_declarado} | Rol: ${rolParaAirtable(f.tipo)}`,
    ciudad: f.ubicacion_declarada,
    fecha: f.recibida_en,
    utmSource: f.utm_source ?? '',
    utmMedium: f.utm_medium ?? '',
    utmCampaign: f.utm_campaign ?? '',
  }
}

export interface ResumenReintentos { reclamadas: number; enviadas: number; fallidas: number; agotadas: number }

export async function reintentarEnviosAirtable(limite = 20): Promise<ResumenReintentos> {
  const { data, error } = await createAdminSupabase().rpc('reclamar_envios_airtable', { p_limite: limite })
  if (error) throw new Error(`reclamar_envios_airtable: ${error.message}`)
  const filas = (data ?? []) as FilaPendiente[]
  const r: ResumenReintentos = { reclamadas: filas.length, enviadas: 0, fallidas: 0, agotadas: 0 }
  for (const f of filas) {
    const envio = await crearRegistroAirtable(camposAirtableDesdeFila(f))
    const estado = await marcarEnvioAirtable(f.id, envio.ok, envio.ok ? envio.id : null, envio.ok ? null : envio.error)
    if (estado === 'enviada') r.enviadas++
    else if (estado === 'agotada') r.agotadas++
    else r.fallidas++
  }
  return r
}

// ── Entrega directa al CMC (solo si Airtable no aceptó la postulación) ───────

export interface PostulacionParaCmc {
  id: string; recibida_en: string; tipo: TipoPostulacion; nombre: string; telefono: string; email: string
  ubicacion: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null
  utm_content: string | null; utm_term: string | null; coincidencia: string
}

export async function postulacionesParaCmc(limite = 100): Promise<PostulacionParaCmc[]> {
  const { data, error } = await createAdminSupabase().rpc('postulaciones_para_cmc', { p_limite: limite })
  if (error) throw new Error(`postulaciones_para_cmc: ${error.message}`)
  return (data ?? []) as PostulacionParaCmc[]
}

export async function confirmarEntregaCmc(ids: string[]): Promise<number> {
  const validos = ids.filter((i) => UUID.test(i)).slice(0, 500)
  if (validos.length === 0) return 0
  const { data, error } = await createAdminSupabase().rpc('confirmar_entrega_cmc', { p_ids: validos, p_actor: 'cmc' })
  if (error) throw new Error(`confirmar_entrega_cmc: ${error.message}`)
  return Number(data ?? 0)
}

/**
 * Formato equivalente al de la API de Airtable, para que el CMC pueda leer estas
 * postulaciones con el mismo código con que lee "Lista de Espera". El id lleva el
 * prefijo "sup" para no confundirse nunca con un id de Airtable ("rec…").
 */
export function comoRegistroAirtable(p: PostulacionParaCmc) {
  return {
    id: `sup${p.id.replace(/-/g, '')}`,
    postulacionId: p.id,
    createdTime: p.recibida_en,
    fields: {
      Nombre: p.nombre,
      Contacto: `WA: ${p.telefono} | Email: ${p.email} | Rol: ${rolParaAirtable(p.tipo)}`,
      Ciudad: p.ubicacion,
      Fecha: p.recibida_en,
      'UTM Source': p.utm_source ?? '', 'UTM Medium': p.utm_medium ?? '', 'UTM Campaign': p.utm_campaign ?? '',
      'UTM Content': p.utm_content ?? '', 'UTM Term': p.utm_term ?? '',
      Coincidencia: p.coincidencia,
    },
  }
}
