// POST /api/admin/anular-pago — { pago_id, motivo } deja el pago como anulado y recalcula el cupo. El motivo es obligatorio y queda con quién anuló.
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { anularPago } from '@/lib/pagos'
import { cupoDelPlan } from '@/lib/visitas'
import { notificar } from '@/lib/avisos'
import { registrarEvento } from '@/lib/eventos'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  const g = await requierePermiso('pagos'); if (!g.ok) return g.res
  const b = await req.json().catch(() => null) as { pago_id?: string; motivo?: string; avisar_cliente?: boolean } | null
  if (!b?.pago_id) return err('Falta pago_id')
  const r = await anularPago(b.pago_id, b.motivo ?? '', { correo: g.actor.correo, rol: g.actor.rol })
  if (!r.ok) return err(r.error, 400)
  // El cliente se entera (campana del portal y correo); antes su plan desaparecía sin explicación.
  // Por defecto se avisa. Quien anula puede desmarcarlo (error de captura, registro duplicado): queda anotado en la actividad.
  if (b.avisar_cliente === false) await registrarEvento({ entidad: 'pago', entidadId: b.pago_id, tipo: 'pago_anulado_sin_aviso', actor: `admin:${g.actor.correo}`, datos: { usuario_id: r.usuarioId } })
  else await notificar({ plantilla: 'pago_anulado', canal: 'correo', destinatario: { tipo: 'cliente', id: r.usuarioId }, variables: { pagoId: b.pago_id }, entidad: 'pago', entidadId: b.pago_id, paso: 12 })
  return ok({ cupo: await cupoDelPlan(r.usuarioId) })
}
