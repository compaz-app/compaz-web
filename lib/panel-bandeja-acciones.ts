// Acciones de la Bandeja que no tenían ruta propia (servidor). Las demás reutilizan lo que ya existe:
// decidir una pausa (PATCH /api/admin/pausas), registrar una llamada (PATCH /api/admin/reportes-compita) y cerrar una tarea (PATCH /api/admin/flags).
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Actor } from '@/lib/permisos'
import { puede } from '@/lib/permisos'
import { solicitudPendiente } from '@/lib/solicitudes-pago'
import { confirmarPagoYAvisar } from '@/lib/confirmar-pago'
import { alertaAdmin } from '@/lib/alertas-admin'
import { tipoDeAccion } from '@/lib/panel-bandeja-tipos'

export type ResultadoAccion = { ok: true; correoEnviado: boolean } | { ok: false; error: string; status: number }

/**
 * Confirma el pago que pide una tarea de la Bandeja. Reglas: permiso 'pagos' (confirmar dinero no es para cualquiera del equipo);
 * la solicitud de pago se busca por el CLIENTE de la tarea (el navegador no elige qué pago confirmar); al confirmar se cierran las tareas de pago
 * de ese cliente y queda anotado quién.
 */
export async function confirmarPagoDeTarea(actor: Actor, flagId: string): Promise<ResultadoAccion> {
  if (!puede(actor, 'pagos')) return { ok: false, error: 'Acceso denegado', status: 403 }
  const db = createAdminSupabase()
  const { data: flag } = await db.from('admin_flags').select('id, entidad_id, tipo, resuelto').eq('id', flagId).maybeSingle()
  if (!flag || flag.resuelto || tipoDeAccion(flag.tipo) !== 'pago') return { ok: false, error: 'La tarea no existe o ya se resolvió', status: 404 }
  const sol = await solicitudPendiente(String(flag.entidad_id))
  if (!sol) return { ok: false, error: 'Ese pago ya no está pendiente', status: 409 }
  const r = await confirmarPagoYAvisar(sol.id, actor.correo)
  if (!r.ok) return { ok: false, error: r.error, status: r.status }
  await db.from('admin_flags').update({ resuelto: true, resuelto_at: new Date().toISOString() }).eq('entidad_id', String(flag.entidad_id)).eq('resuelto', false).in('tipo', ['pago_insistido', 'pago_escalado'])
  await alertaAdmin('actividad', `${actor.correo} confirmó el pago de $${r.pago.monto_usd} de ${r.nombre} desde la bandeja.`, { categoria: 'pago_confirmado_bandeja', entidad: { tipo: 'cliente', id: String(flag.entidad_id), nombre: r.nombre } })
  return { ok: true, correoEnviado: r.correoEnviado }
}
