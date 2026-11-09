import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { desactivarCompita, reactivarCompita } from '@/lib/compitas'
import { ok, err, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('cuentas'); if (!g.ok) return g.res

  const { compita_id, estado } = (await req.json().catch(() => ({})) as { compita_id: string; estado: string })
  if (!compita_id || !['activo', 'inactivo'].includes(estado)) return err('Parámetros inválidos')

  try {
    if (estado === 'inactivo') {
      await desactivarCompita(compita_id)
    } else {
      await reactivarCompita(compita_id)
    }
    return ok({ compita_id, estado })
  } catch (e) {
    return serverError(e)
  }
}
