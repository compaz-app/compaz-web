import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getClienteActivo } from '@/lib/auth'
import { ok, err, notFound, unauthorized } from '@/lib/api'
import { pagoSimuladoActivo } from '@/lib/pago'

export async function GET(req: NextRequest) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const solicitudId = req.nextUrl.searchParams.get('solicitud')
  if (!solicitudId) return err('Falta solicitud', 400)

  const admin = createAdminSupabase()
  const { data: sol } = await admin
    .from('solicitudes')
    .select('id, estado, cliente_id, compita_id, compitas(nombre, foto_url), usuarios!solicitudes_cliente_id_fkey(nombre)')
    .eq('id', solicitudId)
    .maybeSingle() as {
      data: { id: string; estado: string; cliente_id: string; compita_id: string; compitas: { nombre: string; foto_url: string | null } | null; usuarios: { nombre: string } | null } | null
    }

  if (!sol) return notFound()
  if (sol.cliente_id !== user.id) return unauthorized()
  // Tras la llamada la solicitud está 'aceptada' (o 'completada' si la compita la marcó como buena)
  if (!['aceptada', 'completada'].includes(sol.estado)) return err('Esta solicitud no está en estado de pago', 400)

  return ok({
    id: sol.id,
    compitaNombre: sol.compitas?.nombre ?? '—',
    compitaFoto: sol.compitas?.foto_url ?? null,
    clienteNombre: sol.usuarios?.nombre ?? 'Cliente',
    pagoActivo: pagoSimuladoActivo(),
  })
}
