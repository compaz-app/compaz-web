// Validación de entradas de perfil de compita (self-service, onboarding y admin).
import { esc } from '@/lib/html'

const HOSTS_YOUTUBE = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

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
    out.nombre = n
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
      hs.push({ dia: h.dia, inicio: h.inicio, fin: h.fin })
    }
    out.horarios_disponibles = hs
  }
  return { ok: true, datos: out }
}

export function emailValido(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export { esc }
