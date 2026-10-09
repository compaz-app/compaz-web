// Solicitudes de pago que inicia el cliente desde su dashboard. El cobro se confirma a mano (Zelle o transferencia):
// el admin pulsa "Confirmar pago recibido" y recién entonces se crea el pago real con sus visitas.
import { createAdminSupabase } from '@/lib/supabase-server'
import { registrarPago, type PagoRow } from '@/lib/pagos'
import { PLANES, PLANES_IDS, PRECIO_HORA_EXTRA_USD, HORAS_MINIMAS_EXTRA, type PlanId } from '@/lib/planes'

export const METODOS_DIRECTOS = ['zelle', 'transferencia'] as const
export type MetodoDirecto = (typeof METODOS_DIRECTOS)[number]

export type SolicitudPago = {
  id: string; usuario_id: string; tipo: 'plan' | 'extra'; plan: string | null; horas: number | null
  monto_usd: number; metodo: MetodoDirecto; estado: 'pendiente' | 'confirmado' | 'cancelado'; pago_id: string | null
  created_at: string; resuelta_at: string | null
}

/** Referencia corta que el cliente escribe en la nota del Zelle o la transferencia. */
export const referenciaDe = (id: string) => `COMPAZ-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`

/**
 * Datos para pagar. NUNCA se inventan: salen de variables de entorno (ZELLE_DESTINO, ZELLE_TITULAR, TRANSFERENCIA_DATOS).
 * Si no están configuradas, se le dice al cliente que el equipo le enviará los datos.
 */
export function instruccionesPago(metodo: MetodoDirecto): { configurado: boolean; lineas: string[] } {
  if (metodo === 'zelle') {
    const destino = process.env.ZELLE_DESTINO?.trim(); const titular = process.env.ZELLE_TITULAR?.trim()
    if (!destino) return { configurado: false, lineas: [] }
    return { configurado: true, lineas: [`Zelle a: ${destino}`, ...(titular ? [`A nombre de: ${titular}`] : [])] }
  }
  const datos = process.env.TRANSFERENCIA_DATOS?.trim()
  if (!datos) return { configurado: false, lineas: [] }
  return { configurado: true, lineas: datos.split('\n').map((l) => l.trim()).filter(Boolean) }
}

export async function crearSolicitudPago(i: {
  usuarioId: string; tipo: string; plan?: string | null; horas?: number | null; metodo: string
}): Promise<{ ok: true; solicitud: SolicitudPago } | { ok: false; error: string }> {
  if (!(METODOS_DIRECTOS as readonly string[]).includes(i.metodo)) return { ok: false, error: 'Elige Zelle o transferencia' }
  let monto: number, plan: PlanId | null = null, horas: number | null = null
  if (i.tipo === 'plan') {
    if (!i.plan || !PLANES_IDS.includes(i.plan as PlanId)) return { ok: false, error: 'Plan inválido' }
    plan = i.plan as PlanId; monto = PLANES[plan].precioUsd
  } else if (i.tipo === 'extra') {
    const h = Number(i.horas ?? HORAS_MINIMAS_EXTRA)
    if (!Number.isInteger(h) || h < HORAS_MINIMAS_EXTRA || h > 12) return { ok: false, error: `La visita extra es de ${HORAS_MINIMAS_EXTRA} a 12 horas` }
    horas = h; monto = h * PRECIO_HORA_EXTRA_USD
  } else return { ok: false, error: 'Tipo inválido' }

  const supabase = createAdminSupabase()
  // Una sola pendiente por cliente: la nueva reemplaza a la anterior
  await supabase.from('solicitudes_pago').update({ estado: 'cancelado', resuelta_at: new Date().toISOString() }).eq('usuario_id', i.usuarioId).eq('estado', 'pendiente')
  const { data, error } = await supabase
    .from('solicitudes_pago')
    .insert({ usuario_id: i.usuarioId, tipo: i.tipo, plan, horas, monto_usd: monto, metodo: i.metodo, estado: 'pendiente' })
    .select('*').single()
  if (error || !data) {
    console.error('[crearSolicitudPago] error:', error?.code, error?.message)
    return { ok: false, error: 'No pudimos registrar tu solicitud. Intenta de nuevo.' }
  }
  return { ok: true, solicitud: data as SolicitudPago }
}

export async function solicitudPendiente(usuarioId: string): Promise<SolicitudPago | null> {
  const { data, error } = await createAdminSupabase().from('solicitudes_pago').select('*').eq('usuario_id', usuarioId).eq('estado', 'pendiente').maybeSingle()
  if (error) { console.error('[solicitudPendiente]', error.message); return null }
  return (data as SolicitudPago) ?? null
}

export async function pendientesDeTodos(): Promise<Map<string, SolicitudPago>> {
  const { data, error } = await createAdminSupabase().from('solicitudes_pago').select('*').eq('estado', 'pendiente')
  if (error) { console.error('[pendientesDeTodos]', error.message); return new Map() }
  return new Map(((data ?? []) as SolicitudPago[]).map((s) => [s.usuario_id, s]))
}

export async function cancelarSolicitudPago(id: string, usuarioId?: string): Promise<boolean> {
  let q = createAdminSupabase().from('solicitudes_pago').update({ estado: 'cancelado', resuelta_at: new Date().toISOString() }).eq('id', id).eq('estado', 'pendiente')
  if (usuarioId) q = q.eq('usuario_id', usuarioId)
  const { data } = await q.select('id').maybeSingle()
  return !!data
}

/** El admin confirma que llegó el dinero: se crea el pago real (monto exacto) y la solicitud queda confirmada. */
export async function confirmarSolicitudPago(id: string, adminEmail: string): Promise<{ ok: true; pago: PagoRow; usuarioId: string } | { ok: false; error: string; status: number }> {
  const supabase = createAdminSupabase()
  // Reclamo atómico: solo una confirmación puede pasar de 'pendiente' a 'confirmado'
  const { data: s } = await supabase
    .from('solicitudes_pago').update({ estado: 'confirmado', resuelta_at: new Date().toISOString() })
    .eq('id', id).eq('estado', 'pendiente').select('*').maybeSingle()
  if (!s) return { ok: false, error: 'La solicitud no existe o ya fue resuelta', status: 409 }
  const sol = s as SolicitudPago

  const r = await registrarPago({
    usuarioId: sol.usuario_id, tipo: sol.tipo, plan: sol.plan, horas: sol.horas, metodo: sol.metodo,
    referencia: referenciaDe(sol.id), registradoPor: adminEmail,
  })
  if (!r.ok) {
    await supabase.from('solicitudes_pago').update({ estado: 'pendiente', resuelta_at: null }).eq('id', id) // revertir: se puede reintentar
    return { ok: false, error: r.error, status: 500 }
  }
  await supabase.from('solicitudes_pago').update({ pago_id: r.pago.id }).eq('id', id)
  return { ok: true, pago: r.pago, usuarioId: sol.usuario_id }
}
