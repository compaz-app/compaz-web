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
import {
  crearRegistroAirtable, buscarPorContacto, listarCreadosDesde, obtenerRegistro, mismaFecha,
  type CamposAirtable, type RegistroAirtable,
} from '@/lib/airtable'
import { avisarAdmin } from '@/lib/telegram'
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
const ID_AIRTABLE = /^rec[A-Za-z0-9]{14}$/

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

type EstadoMarca = 'enviada' | 'error' | 'conflicto'

async function marcarEnvio(id: string, estado: EstadoMarca, airtableId: string | null, error: string | null): Promise<string | null> {
  const { data, error: e } = await rpc<string>('marcar_envio_airtable', {
    p_id: id, p_estado: estado, p_airtable_id: airtableId, p_error: error,
  })
  if (e) {
    // Sin riesgo de duplicado: la fila sigue pendiente y el siguiente intento buscará la huella.
    console.error('[captacion] marcar_envio_airtable falló:', id, e.message)
    return null
  }
  return data
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
  | { ok: true; postulacionId: string; resultado: 'registrada' | 'repetida' | 'reintento_tecnico'; airtable: 'enviada' | 'pendiente' | 'no_aplica' }
  | { ok: false; error: string }

/**
 * Guarda la postulación en Supabase y hace el primer intento de copia a Airtable.
 * Si la copia falla o no se confirma, la fila queda pendiente y el cron la retoma
 * buscando antes su huella: nunca se crea un segundo registro de la misma postulación.
 */
export async function registrarPostulacion(d: DatosPostulacion): Promise<ResultadoRegistro> {
  const tipo = tipoDesdeContacto(d.contacto)
  const { ciudad, region } = separarUbicacion(d.ubicacion)
  const { data, error } = await rpc<Array<{ postulacion_id: string; resultado: string; enviar_a_airtable: boolean; recibida_en: string }>>(
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

  const postulacionId = String(fila.postulacion_id)
  const resultado = fila.resultado as 'registrada' | 'repetida' | 'reintento_tecnico'
  if (!fila.enviar_a_airtable) return { ok: true, postulacionId, resultado, airtable: 'no_aplica' }

  const envio = await crearRegistroAirtable({
    nombre: d.nombre, contacto: contactoCanonico(d.whatsapp, d.email, tipo), ciudad: d.ubicacion,
    fecha: new Date(fila.recibida_en).toISOString(),
    utmSource: d.utm.source, utmMedium: d.utm.medium, utmCampaign: d.utm.campaign,
  })
  if (!envio.ok) {
    await marcarEnvio(postulacionId, 'error', null, `${envio.incierto ? '[incierto] ' : ''}${envio.error}`)
    return { ok: true, postulacionId, resultado, airtable: 'pendiente' }
  }
  const marcado = await marcarEnvio(postulacionId, 'enviada', envio.id, null)
  return { ok: true, postulacionId, resultado, airtable: marcado === 'enviada' ? 'enviada' : 'pendiente' }
}

// ── Reintentos (cron) ─────────────────────────────────────────────────────────

export interface FilaPostulacion {
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

export function camposAirtableDesdeFila(f: FilaPostulacion): CamposAirtable {
  return {
    nombre: f.nombre_declarado,
    contacto: contactoCanonico(f.telefono_declarado, f.email_declarado, f.tipo),
    ciudad: f.ubicacion_declarada,
    fecha: new Date(f.recibida_en).toISOString(),
    utmSource: f.utm_source ?? '',
    utmMedium: f.utm_medium ?? '',
    utmCampaign: f.utm_campaign ?? '',
  }
}

export type DesenlaceReintento = 'creada' | 'vinculada' | 'conflicto' | 'error' | 'agotada' | 'sin_marcar'

/**
 * Un reintento: 1) buscar la huella en Airtable; 2) si existe una, vincularla;
 * si hay varias, conflicto; 3) si no existe, crear. Si la búsqueda falla, no crea.
 */
export async function reintentarFila(f: FilaPostulacion): Promise<DesenlaceReintento> {
  const campos = camposAirtableDesdeFila(f)
  const busqueda = await buscarPorContacto(campos.contacto)
  if (!busqueda.ok) {
    const e = await marcarEnvio(f.id, 'error', null, `búsqueda previa falló: ${busqueda.error}`)
    return e === 'agotada' ? 'agotada' : e ? 'error' : 'sin_marcar'
  }
  const mismas = busqueda.registros.filter((r) => mismaFecha(r.fecha, campos.fecha))
  if (mismas.length === 1) {
    return (await marcarEnvio(f.id, 'enviada', mismas[0].id, null)) === 'enviada' ? 'vinculada' : 'sin_marcar'
  }
  if (mismas.length > 1) {
    await marcarEnvio(f.id, 'conflicto', null, `huella repetida en Airtable: ${mismas.map((m) => m.id).join(', ')}`)
    return 'conflicto'
  }
  const envio = await crearRegistroAirtable(campos)
  if (!envio.ok) {
    const e = await marcarEnvio(f.id, 'error', null, `${envio.incierto ? '[incierto] ' : ''}${envio.error}`)
    return e === 'agotada' ? 'agotada' : e ? 'error' : 'sin_marcar'
  }
  return (await marcarEnvio(f.id, 'enviada', envio.id, null)) === 'enviada' ? 'creada' : 'sin_marcar'
}

export type ResumenReintentos = Record<DesenlaceReintento, number> & { reclamadas: number }

/** Procesa pendientes dentro de un presupuesto de tiempo (la función de Netlify corta a los 30 s). */
export async function reintentarEnviosAirtable(limite = 10, presupuestoMs = 18_000): Promise<ResumenReintentos> {
  const inicio = Date.now()
  const { data, error } = await rpc<FilaPostulacion[]>('reclamar_envios_airtable', { p_limite: limite })
  if (error) throw new Error(`reclamar_envios_airtable: ${error.message}`)
  const filas = data ?? []
  const r: ResumenReintentos = { reclamadas: filas.length, creada: 0, vinculada: 0, conflicto: 0, error: 0, agotada: 0, sin_marcar: 0 }
  for (const f of filas) {
    // Las filas no procesadas quedan reservadas 5 min y vuelven en la siguiente ejecución.
    if (Date.now() - inicio > presupuestoMs) break
    r[await reintentarFila(f)]++
  }
  return r
}

// ── Conciliación con Airtable (ruta de respaldo y confirmaciones perdidas) ────

export type DesenlaceConciliacion = 'ya_vinculada' | 'adoptada' | 'importada' | 'ambigua' | 'ilegible' | 'error'
export type ResumenConciliacion = Record<DesenlaceConciliacion, number> & { revisados: number; ilegibles: string[] }

export async function conciliarRegistro(reg: RegistroAirtable): Promise<DesenlaceConciliacion> {
  const c = leerContacto(reg.contacto)
  const fecha = reg.fecha ?? reg.creado
  if (!c || !fecha || !reg.nombre) return 'ilegible'
  const { ciudad, region } = separarUbicacion(reg.ciudad)
  const { data, error } = await rpc<string>('conciliar_registro_airtable', {
    p_airtable_id: reg.id, p_fecha: fecha, p_tipo: c.tipo, p_nombre: reg.nombre.slice(0, 100),
    p_telefono_decl: c.telefono.slice(0, 30), p_email_decl: c.email.slice(0, 100), p_ubicacion_decl: reg.ciudad.slice(0, 100),
    p_telefono_e164: normalizarTelefono(c.telefono), p_email_norm: normalizarEmail(c.email),
    p_ciudad: ciudad, p_region: region,
    p_utm: { source: reg.utmSource, medium: reg.utmMedium, campaign: reg.utmCampaign },
  })
  if (error) {
    console.error('[captacion] conciliar_registro_airtable', reg.id, error.message)
    return /sin teléfono ni correo/.test(error.message) ? 'ilegible' : 'error'
  }
  return (data ?? 'error') as DesenlaceConciliacion
}

/**
 * Revisa los registros creados en Airtable desde la activación (CAPTACION_DESDE) y
 * concilia los que Supabase no tiene vinculados. No toca el histórico anterior.
 */
export async function conciliarAirtable(desdeIso: string, presupuestoMs = 20_000): Promise<ResumenConciliacion> {
  const inicio = Date.now()
  const lista = await listarCreadosDesde(desdeIso)
  if (!lista.ok) throw new Error(`listar Airtable: ${lista.error}`)
  const { data: vinculados, error } = await rpc<string[]>('airtable_ids_vinculados', { p_desde: desdeIso })
  if (error) throw new Error(`airtable_ids_vinculados: ${error.message}`)
  const ya = new Set((vinculados ?? []).map(String))
  const r: ResumenConciliacion = { revisados: lista.registros.length, ya_vinculada: 0, adoptada: 0, importada: 0, ambigua: 0, ilegible: 0, error: 0, ilegibles: [] }
  for (const reg of lista.registros) {
    if (ya.has(reg.id)) { r.ya_vinculada++; continue }
    if (Date.now() - inicio > presupuestoMs) break
    const d = await conciliarRegistro(reg)
    r[d]++
    if (d === 'ilegible') r.ilegibles.push(reg.id)
  }
  return r
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

export type Resolucion = 'vinculada_airtable' | 'registrada_en_cmc' | 'no_procede'

export type ResultadoResolucion = { ok: true } | { ok: false; error: string }

/**
 * Resuelve una postulación de la bandeja. Para vincularla a Airtable se comprueba
 * antes que el registro existe y que su Contacto corresponde a esta persona.
 */
export async function resolverPostulacion(
  id: string, resolucion: Resolucion, actor: string, nota: string, airtableId: string,
): Promise<ResultadoResolucion> {
  if (!UUID.test(id)) return { ok: false, error: 'Postulación no válida' }
  if (!['vinculada_airtable', 'registrada_en_cmc', 'no_procede'].includes(resolucion)) return { ok: false, error: 'Resolución no válida' }
  const notaLimpia = nota.trim().slice(0, 500)
  if (resolucion !== 'vinculada_airtable' && !notaLimpia) return { ok: false, error: 'Escribe una nota (por ejemplo el ID COM- o el motivo)' }

  if (resolucion === 'vinculada_airtable') {
    if (!ID_AIRTABLE.test(airtableId)) return { ok: false, error: 'El ID de Airtable debe empezar por "rec" y tener 17 caracteres' }
    const pendiente = (await postulacionesPorResolver(500)).find((p) => p.id === id)
    if (!pendiente) return { ok: false, error: 'La postulación ya no está pendiente' }
    const reg = await obtenerRegistro(airtableId)
    if (!reg) return { ok: false, error: 'No se encontró ese registro en Airtable' }
    const c = leerContacto(reg.contacto)
    const coincide = !!c && (
      (!!normalizarTelefono(c.telefono) && normalizarTelefono(c.telefono) === normalizarTelefono(pendiente.telefono))
      || (!!normalizarEmail(c.email) && normalizarEmail(c.email) === normalizarEmail(pendiente.email)))
    if (!coincide) return { ok: false, error: 'Ese registro de Airtable no tiene el teléfono ni el correo de esta postulación' }
  }

  const { data, error } = await rpc<boolean>('resolver_postulacion', {
    p_id: id, p_resolucion: resolucion, p_actor: actor, p_nota: notaLimpia || null,
    p_airtable_id: resolucion === 'vinculada_airtable' ? airtableId : null,
  })
  if (error) return { ok: false, error: /duplicate key|unique/i.test(error.message) ? 'Ese registro de Airtable ya está vinculado a otra postulación' : 'No se pudo guardar la resolución' }
  if (!data) return { ok: false, error: 'La postulación ya no está pendiente' }
  return { ok: true }
}

// ── Avisos con seguimiento hasta la resolución ───────────────────────────────

/**
 * Avisa por Telegram de cada postulación nueva en la bandeja (una vez por
 * postulación) y recuerda cada día cuántas siguen sin resolver, hasta que no quede
 * ninguna. Devuelve cuántas hay pendientes.
 */
export async function avisarBandeja(): Promise<number> {
  const pendientes = await postulacionesPorResolver(500)
  if (pendientes.length === 0) return 0
  const enlace = `${SITE_URL}/admin/postulaciones`

  const nuevas: PostulacionPorResolver[] = []
  for (const p of pendientes) if (await reclamarUnaVez(`alerta_post:${p.id}`)) nuevas.push(p)
  if (nuevas.length > 0) {
    await avisarAdmin(
      `⚠️ <b>${nuevas.length} postulación(es) no llegaron a Airtable</b>\n\n` +
      `Están guardadas en Supabase pero el CMC no las ve. Resuélvelas en la bandeja:\n${enlace}`,
    )
  } else if (await reclamarUnaVez(`alerta_bandeja:${hoyVE()}`)) {
    await avisarAdmin(`🔔 <b>Bandeja de postulaciones</b>\n\nSiguen ${pendientes.length} sin resolver.\n${enlace}`)
  }
  return pendientes.length
}
