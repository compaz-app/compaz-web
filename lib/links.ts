// Enlaces firmados: roles (cliente/compita) y fotos temporales. Evita suplantación entre partes.
import { createHmac, timingSafeEqual } from 'crypto'

function secret(): string {
  const s = process.env.LINK_SECRET || process.env.CRON_SECRET
  if (!s) throw new Error('LINK_SECRET/CRON_SECRET no configurado')
  return s
}

function firmar(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('hex').slice(0, 24)
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export type Rol = 'cliente' | 'compita'

export function firmaRol(token: string, rol: Rol): string {
  return firmar(`rol:${token}:${rol}`)
}

export function rolValido(token: string, rol: string | null, sig: string | null): rol is Rol {
  if (rol !== 'cliente' && rol !== 'compita') return false
  if (!sig) return false
  try { return iguales(sig, firmaRol(token, rol)) } catch { return false }
}

/** Query string con rol firmado: "&quien=cliente&s=abc" */
export function qRol(token: string, rol: Rol): string {
  return `quien=${rol}&s=${firmaRol(token, rol)}`
}

export function firmaFoto(mensajeId: string, expSeg: number): string {
  return firmar(`foto:${mensajeId}:${expSeg}`)
}

/** URL firmada para fotos en emails (no requiere sesión). Dura 7 días. */
export function urlFotoFirmada(base: string, mensajeId: string, dias = 7): string {
  const exp = Math.floor(Date.now() / 1000) + dias * 86400
  return `${base}/api/foto/${mensajeId}?e=${exp}&s=${firmaFoto(mensajeId, exp)}`
}

export function fotoFirmaValida(mensajeId: string, exp: string | null, sig: string | null): boolean {
  const e = Number(exp)
  if (!sig || !Number.isFinite(e) || e < Math.floor(Date.now() / 1000)) return false
  try { return iguales(sig, firmaFoto(mensajeId, e)) } catch { return false }
}

/** Compara secretos en tiempo constante; falla cerrado si el esperado está vacío. */
export function secretoValido(recibido: string | null, esperado: string | undefined): boolean {
  if (!esperado || !recibido) return false
  return iguales(recibido, esperado)
}

export function tokenRating(visitaId: string, valor: number): string {
  return firmar(`rating:${visitaId}:${valor}`)
}

export function ratingValido(visitaId: string, valor: number, sig: string | null): boolean {
  if (!sig) return false
  try { return iguales(sig, tokenRating(visitaId, valor)) } catch { return false }
}
