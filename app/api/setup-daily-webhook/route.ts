// GET /api/setup-daily-webhook — solo admin. Registra en Daily el webhook "meeting.ended" con firma HMAC.
// Usa DAILY_API_KEY y DAILY_WEBHOOK_SECRET (base64) del servidor; el secreto nunca viaja en la respuesta.
// Elimina webhooks previos que apunten a la misma URL para no recibir eventos duplicados.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { ok, err, unauthorized } from '@/lib/api'

const DAILY = 'https://api.daily.co/v1'

export async function GET(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const key = process.env.DAILY_API_KEY
  const secret = process.env.DAILY_WEBHOOK_SECRET
  if (!key) return err('Falta DAILY_API_KEY', 400)
  if (!secret || Buffer.from(secret, 'base64').length < 16) {
    return err('Falta DAILY_WEBHOOK_SECRET (base64, mínimo 16 bytes). Genera uno con: openssl rand -base64 32', 400)
  }

  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin}/api/webhooks/daily`
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

  try {
    // 1. Quitar webhooks existentes hacia la misma URL
    const lista = await fetch(`${DAILY}/webhooks`, { headers })
    let eliminados = 0
    if (lista.ok) {
      const json = await lista.json() as unknown
      const hooks = (Array.isArray(json) ? json : (json as { data?: unknown[] }).data ?? []) as Array<{ uuid: string; url: string }>
      for (const h of hooks.filter((x) => x.url === url)) {
        const del = await fetch(`${DAILY}/webhooks/${h.uuid}`, { method: 'DELETE', headers })
        if (del.ok) eliminados++
      }
    }

    // 2. Crear el webhook con firma HMAC. Daily envía una petición de verificación a la URL al crearlo.
    const res = await fetch(`${DAILY}/webhooks`, {
      method: 'POST', headers,
      body: JSON.stringify({ url, eventTypes: ['meeting.ended'], hmac: secret }),
    })
    if (!res.ok) {
      const detalle = (await res.text()).slice(0, 300)
      console.error('[setup-daily-webhook] Daily respondió', res.status, detalle)
      return err(`Daily rechazó el webhook (${res.status}): ${detalle}`, 502)
    }
    return ok({ registrado: true, url, eliminados })
  } catch (e) {
    console.error('[setup-daily-webhook] error:', e)
    return err('No se pudo contactar a Daily', 502)
  }
}
