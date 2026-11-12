import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { verificarCompita, desactivarCompita, CompitaNoPermitidaPorCmc } from '@/lib/compitas'
import { avisarCompitaVerificada, anotarAccion } from '@/lib/acciones-equipo'
import { ok, err, serverError } from '@/lib/api'

// POST /api/admin/toggle-verificado { compita_id, verificado } — verifica a un compita (y se lo avisa) o le quita la verificación.
export async function POST(req: NextRequest) {
  const g = await requierePermiso('cuentas'); if (!g.ok) return g.res
  const { compita_id, verificado } = (await req.json().catch(() => ({})) as { compita_id?: string; verificado?: boolean })
  if (!compita_id || typeof verificado !== 'boolean') return err('Parámetros inválidos')
  try {
    if (verificado) await verificarCompita(compita_id)
    else await desactivarCompita(compita_id)
  } catch (e) {
    if (e instanceof CompitaNoPermitidaPorCmc) return err(e.message, 409)
    return serverError(e)
  }
  await anotarAccion(g.actor.correo, verificado ? 'verificó a un compita' : 'quitó la verificación a un compita', { tipo: 'compita', id: compita_id })
  const notificada = verificado ? await avisarCompitaVerificada(compita_id) : null
  return ok({ compita_id, verificado, notificada })
}
