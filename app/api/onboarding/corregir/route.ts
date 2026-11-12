import { NextRequest } from 'next/server'
import { corregirRegistroCompita } from '@/lib/onboarding-compita'
import { ok, err } from '@/lib/api'

// POST /api/onboarding/corregir { edit_token, ...mismos campos del registro } — corrige los datos (por ejemplo el correo) de un compita que acaba de
// registrarse y todavía no conectó Telegram. El enlace de edición lo recibió la pantalla de registro y es de un solo uso.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body.edit_token !== 'string' || !body.edit_token) return err('Falta el enlace de corrección')
  const r = await corregirRegistroCompita(body.edit_token, body)
  return r.ok ? ok({ edit_token: r.editToken }) : err(r.error, r.status)
}
