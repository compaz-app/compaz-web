// Permiso de cookies de medición (Google Analytics, Microsoft Clarity, píxel de Meta). Parte PURA: cómo se guarda la decisión y cuándo hay que volver a preguntar.
// La decisión vive en el navegador de la persona (no en nuestra base: no hace falta saber quién es). Sin decisión = no se mide. Las cookies de sesión (iniciar sesión)
// son necesarias y no piden permiso. Texto y plazos: pendientes de revisión legal (ver docs/versiones.md 1.3.43).
export const CLAVE_COOKIES = 'compaz_cookies'
/** Si cambia lo que se mide o cómo, se sube este número y a todos se les vuelve a preguntar. */
export const VERSION_COOKIES = 1
/** Pasado este tiempo se vuelve a preguntar (lo habitual es entre 6 y 12 meses). */
export const VIGENCIA_COOKIES_DIAS = 365
export type DecisionCookies = 'si' | 'no'

export function codificarDecision(d: DecisionCookies, ahora: number = Date.now()): string {
  return JSON.stringify({ v: VERSION_COOKIES, d, en: new Date(ahora).toISOString() })
}

/** Lo guardado → la decisión vigente, o null si no hay, está dañado, es de otra versión o ya venció (se vuelve a preguntar). */
export function leerDecision(crudo: string | null | undefined, ahora: number = Date.now()): DecisionCookies | null {
  if (!crudo) return null
  try {
    const x = JSON.parse(crudo) as { v?: unknown; d?: unknown; en?: unknown }
    if (x.v !== VERSION_COOKIES || (x.d !== 'si' && x.d !== 'no') || typeof x.en !== 'string') return null
    const t = new Date(x.en).getTime()
    if (Number.isNaN(t) || ahora - t > VIGENCIA_COOKIES_DIAS * 86_400_000 || t > ahora + 60_000) return null
    return x.d
  } catch { return null }
}
