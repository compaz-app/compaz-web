// Dirección pública del sitio. Detrás de Netlify, req.nextUrl.origin / req.url pueden devolver la dirección
// interna del despliegue (p. ej. main--compaz-beta.netlify.app). Redirigir allí rompe las cookies de sesión
// y la CSP (form-action 'self') bloquea el salto en silencio. Siempre usar esta función para redirigir.
//
// Excepción, SOLO en los deploy previews de Netlify (decidido 2026-11-17, PR #25): NEXT_PUBLIC_SITE_URL vale
// micompaz.com en todos los contextos, así que sin esta excepción el login del preview mandaba a producción y la
// sesión (cookie de micompaz.com) nunca llegaba al preview. Si el despliegue se construyó como «deploy-preview»
// (variable CONTEXT de Netlify, fijada en la compilación por next.config.ts) y la petición llega a una dirección
// de preview de ESTE sitio, se usa esa dirección. En producción la compilación dice «production» y esto no corre.

const CONTEXTO = process.env.COMPAZ_CONTEXTO_DESPLIEGUE ?? ''
/** Solo direcciones de preview de este sitio: deploy-preview-N o el enlace fijo de un despliegue (id de 24 hex). */
const HOST_PREVIEW = /^(deploy-preview-\d{1,6}|[0-9a-f]{24})--compaz-beta\.netlify\.app$/

type Peticion = { nextUrl?: { origin: string; host?: string }; url?: string; headers?: { get(nombre: string): string | null } }

/** La dirección del preview si este despliegue es un preview y la petición llegó a uno; si no, null. */
export function origenDePreview(req?: Peticion, contexto: string = CONTEXTO): string | null {
  if (contexto !== 'deploy-preview' || !req) return null
  let deUrl: string | null = null
  try { deUrl = req.url ? new URL(req.url).host : null } catch { deUrl = null }
  for (const h of [req.headers?.get('x-forwarded-host'), req.nextUrl?.host, deUrl]) {
    const host = h?.split(',')[0].trim().toLowerCase()
    if (host && HOST_PREVIEW.test(host)) return `https://${host}`
  }
  return null
}

export function baseUrl(req?: Peticion): string {
  const preview = origenDePreview(req)
  if (preview) return preview
  const publica = process.env.NEXT_PUBLIC_SITE_URL
  if (publica) return publica.replace(/\/+$/, '')
  if (req?.nextUrl?.origin) return req.nextUrl.origin
  if (req?.url) return new URL(req.url).origin
  return 'https://micompaz.com'
}

export function urlPublica(ruta: string, req?: Peticion): URL {
  return new URL(ruta, baseUrl(req))
}
