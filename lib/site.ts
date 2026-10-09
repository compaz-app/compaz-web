// Dirección pública del sitio. Detrás de Netlify, req.nextUrl.origin / req.url pueden devolver la dirección
// interna del despliegue (p. ej. main--compaz-beta.netlify.app). Redirigir allí rompe las cookies de sesión
// y la CSP (form-action 'self') bloquea el salto en silencio. Siempre usar esta función para redirigir.
export function baseUrl(req?: { nextUrl?: { origin: string }; url?: string }): string {
  const publica = process.env.NEXT_PUBLIC_SITE_URL
  if (publica) return publica.replace(/\/+$/, '')
  if (req?.nextUrl?.origin) return req.nextUrl.origin
  if (req?.url) return new URL(req.url).origin
  return 'https://micompaz.com'
}

export function urlPublica(ruta: string, req?: { nextUrl?: { origin: string }; url?: string }): URL {
  return new URL(ruta, baseUrl(req))
}
