import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, err } from '@/lib/api'

// GET /api/compita/resenas?compita_id=<uuid> — reseñas publicadas de un compita
export async function GET(req: NextRequest) {
  const compita_id = req.nextUrl.searchParams.get('compita_id')
  if (!compita_id || !/^[0-9a-f-]{36}$/i.test(compita_id)) return err('Parámetros inválidos', 400)

  const admin = createAdminSupabase()
  const { data } = await admin
    .from('resenas')
    .select('id, texto, estrellas, created_at')
    .eq('compita_id', compita_id)
    .eq('publicada', true)
    .order('created_at', { ascending: false })
    .limit(10)

  return ok(data ?? [])
}
