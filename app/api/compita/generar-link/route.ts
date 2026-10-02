// POST /api/compita/generar-link
// Llamado desde el webhook de Telegram cuando el compita escribe /perfil.
// Genera un token de edición de un solo uso y devuelve la URL.
import { NextRequest } from 'next/server'
import { ok, err, unauthorized } from '@/lib/api'
import { validateTelegramWebhook } from '@/lib/telegram'
import { generarTokenPerfil } from '@/lib/compita-tokens'
import { createAdminSupabase } from '@/lib/supabase-server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token')
  if (!validateTelegramWebhook(secretHeader)) return unauthorized()

  const { compita_id } = await req.json() as { compita_id: string }
  if (!compita_id) return err('compita_id requerido')

  const supabase = createAdminSupabase()
  const { data: compita } = await supabase.from('compitas').select('id').eq('id', compita_id).single()
  if (!compita) return err('Compita no encontrada', 404)

  const token = await generarTokenPerfil(compita_id)
  const url = `${SITE_URL}/compita/perfil?token=${token}`
  return ok({ url })
}
