import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { ok, err, serverError } from '@/lib/api'
import { bloquearCompita, desbloquearCompita } from '@/lib/compitas'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('cuentas'); if (!g.ok) return g.res

  const { compita_id, bloquear } = (await req.json().catch(() => ({})))
  if (!compita_id) return err('compita_id requerido')

  try {
    if (bloquear) {
      await bloquearCompita(compita_id)
    } else {
      await desbloquearCompita(compita_id)
    }
    return ok(null)
  } catch (e) {
    return serverError(e)
  }
}
