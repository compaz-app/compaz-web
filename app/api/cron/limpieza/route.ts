// POST /api/cron/limpieza — ejecutado por Netlify una vez al día (3am VE)
// Elimina tokens expirados o usados para evitar acumulación de basura en la BD
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) return err('No autorizado', 401)

  const admin = createAdminSupabase()
  const ahora = new Date().toISOString()

  await admin.from('onboarding_tokens').delete().or(`usado.eq.true,expires_at.lt.${ahora}`)
  await admin.from('compita_edit_tokens').delete().lt('expires_at', ahora)
  await admin.from('action_tokens').delete().lt('expires_at', ahora)

  return ok(null)
}
