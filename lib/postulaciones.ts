// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Postulaciones de Compitas desde la landing pública (/se-compita)
// Usa el mismo endpoint y formato que el formulario de la home (/api/waitlist),
// así Airtable y sus automatizaciones reciben los leads igual que siempre.
// ══════════════════════════════════════════════════════════════════════════════

export interface PostulacionCompita {
  nombre: string
  prefijo: string        // "0412", "0414"…
  numero: string         // 7 dígitos
  email: string
  estado: string
  ciudad: string
  website: string        // honeypot
  turnstileToken: string
}

export type ResultadoPostulacion = { ok: true } | { ok: false; error: string }

const ERROR_GENERICO = 'No pudimos enviar tu postulación. Revisa tu conexión e intenta de nuevo.'

// "0412" + "1234567" → "+584121234567"
export function armarWhatsappVE(prefijo: string, numero: string): string {
  return `+58${prefijo.replace(/^0/, '')}${numero.replace(/\D/g, '')}`
}

export async function enviarPostulacionCompita(datos: PostulacionCompita): Promise<ResultadoPostulacion> {
  const whatsapp = armarWhatsappVE(datos.prefijo, datos.numero)
  const params = new URLSearchParams(window.location.search)

  try {
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: datos.nombre,
        contacto: `WA: ${whatsapp} | Email: ${datos.email} | Rol: compa`,
        whatsapp,
        email: datos.email,
        ciudad: `${datos.ciudad}, ${datos.estado}`,
        website: datos.website,
        turnstileToken: datos.turnstileToken,
        utmSource: params.get('utm_source') ?? '',
        utmMedium: params.get('utm_medium') ?? '',
        utmCampaign: params.get('utm_campaign') ?? '',
      }),
    })
    if (res.ok) return { ok: true }
    if (res.status >= 500) return { ok: false, error: ERROR_GENERICO }
    // 4xx: el endpoint devuelve un mensaje pensado para el usuario (límite de intentos, verificación…)
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null
    return { ok: false, error: typeof body?.error === 'string' ? body.error : ERROR_GENERICO }
  } catch {
    return { ok: false, error: ERROR_GENERICO }
  }
}
