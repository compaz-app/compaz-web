// Pagos registrados (plan mensual o visita extra). Cada pago crea un paquete de visitas que vence a los 60 días.
import { createAdminSupabase } from '@/lib/supabase-server'
import {
  PLANES, PLANES_IDS, METODOS_PAGO, VIGENCIA_CREDITOS_DIAS, PRECIO_HORA_EXTRA_USD, HORAS_MINIMAS_EXTRA,
  type PlanId, type MetodoPago,
} from '@/lib/planes'

export type PagoRow = {
  id: string; usuario_id: string; tipo: 'plan' | 'extra'; plan: string | null; visitas: number; horas: number | null
  monto_usd: number; metodo: MetodoPago; referencia: string | null; registrado_por: string | null
  estado: 'activo' | 'anulado'; anulado_motivo: string | null; inicio: string; vence: string; created_at: string
}

export type PagoInput = {
  usuarioId: string
  tipo: 'plan' | 'extra'
  plan?: string | null
  horas?: number | null
  montoUsd?: number | null
  metodo: string
  referencia?: string | null
  registradoPor: string
}

export async function registrarPago(i: PagoInput): Promise<{ ok: true; pago: PagoRow } | { ok: false; error: string }> {
  if (!(METODOS_PAGO as readonly string[]).includes(i.metodo)) return { ok: false, error: 'Método de pago inválido' }

  let visitas: number, plan: PlanId | null = null, horas: number | null = null, monto: number
  if (i.tipo === 'plan') {
    if (!i.plan || !PLANES_IDS.includes(i.plan as PlanId)) return { ok: false, error: 'Plan inválido' }
    plan = i.plan as PlanId
    visitas = PLANES[plan].visitas
    monto = PLANES[plan].precioUsd
  } else if (i.tipo === 'extra') {
    const h = Number(i.horas ?? HORAS_MINIMAS_EXTRA)
    if (!Number.isInteger(h) || h < HORAS_MINIMAS_EXTRA || h > 12) return { ok: false, error: `La visita extra es de ${HORAS_MINIMAS_EXTRA} a 12 horas` }
    horas = h; visitas = 1; monto = h * PRECIO_HORA_EXTRA_USD
  } else {
    return { ok: false, error: 'Tipo de pago inválido' }
  }
  // El monto es siempre el del plan (o horas por la tarifa): no se aceptan pagos parciales ni distintos.
  if (i.montoUsd !== undefined && i.montoUsd !== null && Math.round(Number(i.montoUsd) * 100) !== Math.round(monto * 100)) {
    return { ok: false, error: `El monto debe ser exactamente $${monto}. Un pago por otro valor no se puede registrar.` }
  }
  const referencia = typeof i.referencia === 'string' && i.referencia.trim() ? i.referencia.trim().slice(0, 200) : null

  const supabase = createAdminSupabase()
  const { data: u } = await supabase.from('usuarios').select('id').eq('id', i.usuarioId).maybeSingle()
  if (!u) return { ok: false, error: 'Cliente no encontrado' }

  const ahora = new Date()
  const { data, error } = await supabase
    .from('pagos_plan')
    .insert({
      usuario_id: i.usuarioId, tipo: i.tipo, plan, visitas, horas, monto_usd: monto, metodo: i.metodo, referencia,
      registrado_por: i.registradoPor, estado: 'activo',
      inicio: ahora.toISOString(), vence: new Date(ahora.getTime() + VIGENCIA_CREDITOS_DIAS * 86400_000).toISOString(),
    })
    .select('*')
    .single()
  if (error || !data) {
    console.error('[registrarPago] error:', error?.code, error?.message)
    // Solo lo ve el admin: se muestra la causa real para poder corregirla rápido
    const tablaFalta = error?.code === '42P01' || error?.code === 'PGRST205' || /does not exist|schema cache/i.test(error?.message ?? '')
    return {
      ok: false,
      error: tablaFalta
        ? 'La tabla de pagos no existe o Supabase aún no la ve. Ejecuta la migración de pagos y luego: notify pgrst, \'reload schema\';'
        : `No se pudo registrar el pago: ${error?.message ?? 'error desconocido'}${error?.code ? ` (código ${error.code})` : ''}`,
    }
  }

  // Campos informativos del plan vigente (el cupo real se calcula con los paquetes)
  if (i.tipo === 'plan') {
    await supabase.from('usuarios').update({ plan_contratado: plan, plan_inicio: ahora.toISOString() }).eq('id', i.usuarioId)
  }
  return { ok: true, pago: data as PagoRow }
}

export async function listarPagos(usuarioId: string): Promise<PagoRow[]> {
  const { data, error } = await createAdminSupabase()
    .from('pagos_plan').select('*').eq('usuario_id', usuarioId).order('created_at', { ascending: false })
  if (error) { console.error('[listarPagos]', error.message); return [] }
  return (data ?? []) as PagoRow[]
}

export async function anularPago(pagoId: string, motivo: string): Promise<{ ok: true; usuarioId: string } | { ok: false; error: string }> {
  const { data, error } = await createAdminSupabase()
    .from('pagos_plan')
    .update({ estado: 'anulado', anulado_motivo: motivo.trim().slice(0, 300) || null })
    .eq('id', pagoId)
    .eq('estado', 'activo')
    .select('usuario_id')
    .maybeSingle()
  if (error) return { ok: false, error: 'No se pudo anular el pago' }
  if (!data) return { ok: false, error: 'El pago no existe o ya estaba anulado' }
  return { ok: true, usuarioId: data.usuario_id as string }
}
