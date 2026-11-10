// /api/visita/llegada — el cliente ve si su compita llegó y si nadie abre.
// GET: estado de la llegada y los minutos que quedan de espera. POST { accion: 'ya_abro' }: detiene la cuenta atrás.
import { NextRequest } from 'next/server'
import { getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjustes } from '@/lib/ajustes'
import { clienteYaAbre } from '@/lib/llegada'
import { ok, err, unauthorized } from '@/lib/api'

async function visitaDelCliente(userId: string) {
  const { data } = await createAdminSupabase().from('visitas')
    .select('id, estado, llegada_en, llegada_foto_id, sin_acceso_en').eq('usuario_id', userId).eq('estado', 'programada').order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data as { id: string; estado: string; llegada_en: string | null; llegada_foto_id: string | null; sin_acceso_en: string | null } | null
}

export async function GET() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const v = await visitaDelCliente(user.id)
  if (!v || !v.llegada_en) return ok({ llego: false })
  const espera = Number((await getAjustes()).nadie_abre_espera_min)
  const restantes = v.sin_acceso_en ? Math.max(0, Math.ceil(espera - (Date.now() - new Date(v.sin_acceso_en).getTime()) / 60_000)) : null
  return ok({ llego: true, llegada_en: v.llegada_en, tiene_foto: !!v.llegada_foto_id, nadie_abre: !!v.sin_acceso_en, minutos_restantes: restantes, espera_min: espera })
}

export async function POST(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()
  const b = await req.json().catch(() => null) as { accion?: string } | null
  if (b?.accion !== 'ya_abro') return err('Acción inválida')
  const v = await visitaDelCliente(user.id)
  if (!v) return err('No hay una visita esperando', 404)
  return (await clienteYaAbre(v.id, user.id)) ? ok({ detenida: true }) : err('No hay una espera en curso', 409)
}
