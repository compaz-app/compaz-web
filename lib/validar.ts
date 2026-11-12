// Validación de entradas de perfil de compita (self-service, onboarding y admin).
import { esc } from '@/lib/html'

const HOSTS_YOUTUBE = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
/** Las horas libres son bloques de 20 minutos: una franja debe empezar y terminar en :00, :20 o :40. */
const en20 = (hhmm: string) => Number(hhmm.slice(3)) % 20 === 0

export function esUrlYoutube(url: string | null | undefined): boolean {
  if (!url) return true
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && HOSTS_YOUTUBE.includes(u.hostname)
  } catch { return false }
}

/** La foto de perfil solo puede vivir en nuestro bucket público (no URLs externas / de tracking). */
export function esUrlFotoPropia(url: string | null | undefined): boolean {
  if (!url) return true
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !!base && url.startsWith(`${base}/storage/v1/object/public/fotos/`)
}

export type PerfilEntrada = {
  nombre?: unknown; zona?: unknown; descripcion?: unknown; servicios?: unknown
  youtube_url?: unknown; foto_url?: unknown; horarios_disponibles?: unknown
}
export type PerfilLimpio = {
  nombre?: string; zona?: string; descripcion?: string; servicios?: string[]
  youtube_url?: string | null; foto_url?: string | null
  horarios_disponibles?: { dia: string; inicio: string; fin: string }[]
}

const texto = (v: unknown, max: number): string | null =>
  typeof v === 'string' ? v.trim().slice(0, max) : null

/** Devuelve el perfil saneado o un mensaje de error. Solo incluye los campos presentes. */
export function validarPerfil(e: PerfilEntrada | Record<string, unknown>, opts: { permitirNombre?: boolean } = {}): { ok: true; datos: PerfilLimpio } | { ok: false; error: string } {
  const out: PerfilLimpio = {}
  e = e as PerfilEntrada

  if (e.nombre !== undefined && opts.permitirNombre) {
    const n = texto(e.nombre, 80)
    if (!n || n.length < 2) return { ok: false, error: 'Nombre inválido' }
    out.nombre = n.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }
  if (e.zona !== undefined) {
    const z = texto(e.zona, 100)
    if (!z) return { ok: false, error: 'Zona inválida' }
    out.zona = z
  }
  if (e.descripcion !== undefined) {
    const d = texto(e.descripcion, 2000)
    if (!d) return { ok: false, error: 'La descripción es obligatoria' }
    out.descripcion = d
  }
  if (e.servicios !== undefined) {
    if (!Array.isArray(e.servicios) || e.servicios.length > 20 || e.servicios.some((x) => typeof x !== 'string' || x.length > 60)) {
      return { ok: false, error: 'Servicios inválidos' }
    }
    out.servicios = (e.servicios as string[]).map((x) => x.trim()).filter(Boolean)
  }
  if (e.youtube_url !== undefined) {
    const y = e.youtube_url === null || e.youtube_url === '' ? null : texto(e.youtube_url, 300)
    if (y && !esUrlYoutube(y)) return { ok: false, error: 'La URL del video debe ser de YouTube (https://youtube.com o https://youtu.be)' }
    out.youtube_url = y
  }
  if (e.foto_url !== undefined) {
    const f = e.foto_url === null || e.foto_url === '' ? null : texto(e.foto_url, 500)
    if (f && !esUrlFotoPropia(f)) return { ok: false, error: 'La foto debe subirse desde el formulario' }
    out.foto_url = f
  }
  if (e.horarios_disponibles !== undefined) {
    if (!Array.isArray(e.horarios_disponibles) || e.horarios_disponibles.length > 50) return { ok: false, error: 'Horarios inválidos' }
    const hs: { dia: string; inicio: string; fin: string }[] = []
    for (const h of e.horarios_disponibles as Record<string, unknown>[]) {
      if (!h || typeof h.dia !== 'string' || typeof h.inicio !== 'string' || typeof h.fin !== 'string'
        || !DIAS.includes(h.dia) || !HHMM.test(h.inicio) || !HHMM.test(h.fin) || h.fin <= h.inicio) {
        return { ok: false, error: 'Horarios inválidos' }
      }
      if (!en20(h.inicio) || !en20(h.fin)) return { ok: false, error: 'Los horarios van en bloques de 20 minutos (por ejemplo 09:00, 09:20 o 09:40)' }
      hs.push({ dia: h.dia, inicio: h.inicio, fin: h.fin })
    }
    out.horarios_disponibles = hs
  }
  return { ok: true, datos: out }
}

// ── Correos ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Un correo bien formado puede estar mal escrito: "ana@gmail.coin" tiene forma válida pero no existe, y la invitación se perdería sin que nadie lo notara.
// Por eso, además de la forma, se revisa el final (el dominio de primer nivel) y se sugiere la corrección de las equivocaciones más comunes.

/** Finales de dos letras (los de cada país: .ve, .es, .co, .us, .mx…) valen siempre; estos son los genéricos aceptados. */
const TLD_GENERICOS = new Set([
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro', 'mobi', 'asia', 'tel', 'travel', 'museum', 'coop', 'aero', 'jobs', 'cat',
  'app', 'dev', 'io', 'online', 'site', 'website', 'xyz', 'club', 'shop', 'store', 'tech', 'cloud', 'live', 'email', 'blog', 'news', 'life', 'world',
  'today', 'space', 'top', 'link', 'page', 'digital', 'agency', 'studio', 'design', 'media', 'group', 'center', 'network', 'solutions', 'services',
  'company', 'team', 'works', 'zone', 'plus', 'one', 'care', 'health', 'clinic', 'doctor', 'family', 'community', 'foundation', 'ong', 'church',
])
/** Finales reservados para pruebas: solo se aceptan fuera de producción. */
const TLD_DE_PRUEBA = new Set(['test', 'example', 'invalid', 'localhost'])

const DOMINIOS_CONOCIDOS: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com', 'gmaill.com': 'gmail.com', 'gimail.com': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com',
  'hotnail.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com', 'yhoo.com': 'yahoo.com', 'outlok.com': 'outlook.com', 'outllook.com': 'outlook.com', 'outlook.co': 'outlook.com',
  'iclod.com': 'icloud.com', 'icloud.co': 'icloud.com', 'iclould.com': 'icloud.com',
}
/** Equivocaciones frecuentes de ".com" al teclear. */
const FINALES_DE_COM = new Set(['coin', 'con', 'cm', 'comm', 'cpm', 'vom', 'xom', 'ocm', 'clm', 'om', 'copm', 'comn', 'cim', 'coom', 'comj', 'conm', 'comi'])

export type RevisionCorreo = { ok: true; correo: string } | { ok: false; error: string; sugerencia?: string }

/** Revisa un correo: forma, final (dominio de primer nivel) y equivocaciones comunes. Si hay una corrección probable, la devuelve en `sugerencia`. */
export function revisarCorreo(v: unknown): RevisionCorreo {
  if (typeof v !== 'string' || !v.trim()) return { ok: false, error: 'Escribe un correo' }
  const correo = v.trim()
  if (correo.length > 200 || /\s/.test(correo) || (correo.match(/@/g) ?? []).length !== 1) return { ok: false, error: 'El correo no está bien escrito: debe ser como nombre@dominio.com' }
  const [local, dominio] = correo.split('@')
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return { ok: false, error: 'La parte antes de la @ no es válida' }
  const etiquetas = dominio.toLowerCase().split('.')
  if (etiquetas.length < 2 || etiquetas.some((e) => !e || e.length > 63 || !/^[a-z0-9-]+$/.test(e) || e.startsWith('-') || e.endsWith('-'))) return { ok: false, error: 'El dominio del correo no es válido: debe ser como nombre@dominio.com' }
  const tld = etiquetas[etiquetas.length - 1]
  const dom = etiquetas.join('.')
  const sugerido = DOMINIOS_CONOCIDOS[dom] ?? (FINALES_DE_COM.has(tld) ? [...etiquetas.slice(0, -1), 'com'].join('.') : null)
  if (sugerido && sugerido !== dom) return { ok: false, error: `El correo parece mal escrito. ¿Quisiste decir ${local}@${sugerido}?`, sugerencia: `${local}@${sugerido}` }
  const esPrueba = TLD_DE_PRUEBA.has(tld) && process.env.NODE_ENV !== 'production'
  if (!/^[a-z]{2}$/.test(tld) && !TLD_GENERICOS.has(tld) && !esPrueba) return { ok: false, error: `El final del correo (.${tld}) no parece real. Revisa que esté bien escrito.` }
  return { ok: true, correo }
}

export function emailValido(v: unknown): v is string {
  return revisarCorreo(v).ok
}

export { esc }
