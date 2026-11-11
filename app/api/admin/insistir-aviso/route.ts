import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { insistirDeTarea } from '@/lib/insistir-aviso'
import { ok, err, errEspera } from '@/lib/api'

// POST /api/admin/insistir-aviso { flag_id } — reenvía el aviso que la persona de una tarea de la Bandeja no atendió.
// Tope: uno cada 30 minutos y 3 por aviso (explicado con la regla `insistir_aviso`). La tarea se queda abierta: insistir no la resuelve.
export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender')
  if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { flag_id?: unknown } | null
  if (!b || typeof b.flag_id !== 'string' || !/^[0-9a-zA-Z-]{8,64}$/.test(b.flag_id)) return err('Falta la tarea')
  const r = await insistirDeTarea(g.actor, b.flag_id)
  if (r.ok) return ok({ reenvios: r.reenvios })
  return r.espera ? errEspera(r.espera) : err(r.error, r.status)
}
