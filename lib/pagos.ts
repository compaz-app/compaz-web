// Pagos registrados (plan mensual o visita extra). Cada pago crea un paquete de visitas que vence a los 60 días.
import { createAdminSupabase } from '@/lib/supabase-server'
import { registrarEvento } from '@/lib/eventos'
import { reclamarVentana } from '@/lib/cron'
import { alertaAdmin } from '@/lib/alertas-admin'
import { esc } from '@/lib/html'
import {
  PLANES, PLANES_IDS, METODOS_PAGO, VIGENCIA_CREDITOS_DIAS, HORAS_MINIMAS_EXTRA,
  type PlanId, type MetodoPago,
} from '@/lib/planes'
import { preciosVigentes } from '@/lib/precios'

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

  const precios = await preciosVigentes()
  let visitas: number, plan: PlanId | null = null, horas: number | null = null, monto: number
  if (i.tipo === 'plan') {
    if (!i.plan || !PLANES_IDS.includes(i.plan as PlanId)) return { ok: false, error: 'Plan inválido' }
    plan = i.plan as PlanId
    visitas = PLANES[plan].visitas
    monto = precios.planes[plan]
  } else if (i.tipo === 'extra') {
    const h = Number(i.horas ?? HORAS_MINIMAS_EXTRA)
    if (!Number.isInteger(h) || h < HORAS_MINIMAS_EXTRA || h > 12) return { ok: false, error: `La visita extra es de ${HORAS_MINIMAS_EXTRA} a 12 horas` }
    horas = h; visitas = 1; monto = h * precios.hora
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

  // Idempotencia (D-01): dos clics seguidos o dos personas del equipo no pueden crear dos paquetes de visitas por el mismo pago.
  //  1. Bloqueo corto por cliente: mientras uno se registra, el otro espera y ve el resultado.
  //  2. Misma referencia ya registrada (activa) para el cliente y el método: se rechaza.
  //  3. Un pago idéntico registrado hace menos de 2 minutos: se rechaza (cubre el doble clic sin referencia).
  const clave = `pago_lock:${i.usuarioId}`
  // El bloqueo vence solo a los 60 s: si la función muere a mitad, el cliente no queda sin poder registrar pagos para siempre.
  if (!(await reclamarVentana(clave, 60_000)).ok) return { ok: false, error: 'Ya se está registrando un pago de este cliente. Espera unos segundos y revisa la lista antes de volver a intentarlo.' }
  try {
    const previos = await listarPagos(i.usuarioId)
    const activos = previos.filter((p) => p.estado !== 'anulado')
    const norm = (t: string | null | undefined) => (t ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
    if (referencia && activos.some((p) => p.metodo === i.metodo && norm(p.referencia) === norm(referencia))) {
      return { ok: false, error: 'Ya hay un pago de este cliente con esa misma referencia. Si fue un error, anula el anterior antes de registrarlo otra vez.' }
    }
    // El mismo comprobante tampoco puede estar registrado en OTRO cliente (un Zelle o una transferencia tienen una referencia única).
    if (referencia) {
      const { data: otros } = await supabase.from('pagos_plan').select('usuario_id, referencia, estado').eq('metodo', i.metodo).neq('usuario_id', i.usuarioId).neq('estado', 'anulado').ilike('referencia', referencia.replace(/[%_]/g, (m) => `\\${m}`)).limit(5)
      if (((otros ?? []) as { referencia: string | null }[]).some((p) => norm(p.referencia) === norm(referencia))) {
        return { ok: false, error: 'Esa referencia ya está registrada en el pago de otro cliente. Revisa que sea el comprobante correcto antes de registrarla.' }
      }
    }
    const haceDosMin = Date.now() - 2 * 60_000
    if (!referencia && activos.some((p) => !p.referencia && p.tipo === i.tipo && p.plan === plan && (p.horas ?? null) === horas && p.metodo === i.metodo && Number(p.monto_usd) === monto && new Date(p.created_at).getTime() > haceDosMin)) {
      return { ok: false, error: 'Se acaba de registrar un pago idéntico para este cliente. Si de verdad son dos pagos, espera 2 minutos o pon una referencia distinta en cada uno.' }
    }
    return await insertarPago(i, { plan, visitas, horas, monto, referencia })
  } finally {
    await createAdminSupabase().from('telegram_estados').delete().eq('chat_id', clave).then(undefined, () => undefined) // se libera ya (si falla, vence solo a los 60 s)
  }
}

async function insertarPago(i: PagoInput, v: { plan: PlanId | null; visitas: number; horas: number | null; monto: number; referencia: string | null }): Promise<{ ok: true; pago: PagoRow } | { ok: false; error: string }> {
  const { plan, visitas, horas, monto, referencia } = v
  const supabase = createAdminSupabase()
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
  // Queda el evento (no lanza). Si lo registró una persona del equipo, su correo es el actor.
  await registrarEvento({
    entidad: 'pago', entidadId: (data as PagoRow).id, tipo: 'pago_confirmado',
    actor: i.registradoPor.includes('@') ? `admin:${i.registradoPor}` : 'sistema',
    datos: { usuario_id: i.usuarioId, tipo: i.tipo, plan, monto_usd: monto, metodo: i.metodo },
  })
  return { ok: true, pago: data as PagoRow }
}

export async function listarPagos(usuarioId: string): Promise<PagoRow[]> {
  const { data, error } = await createAdminSupabase()
    .from('pagos_plan').select('*').eq('usuario_id', usuarioId).order('created_at', { ascending: false })
  if (error) { console.error('[listarPagos]', error.message); return [] }
  return (data ?? []) as PagoRow[]
}

/**
 * Anula un pago (D-01): el motivo es OBLIGATORIO, queda con quién lo hizo y cuándo (evento `pago_anulado` + Actividad) y, si lo hizo un colaborador,
 * además llega al administrador como tarea para que lo revise: anular un pago real deja visitas sin cobrar.
 */
export async function anularPago(pagoId: string, motivo: string, actor: { correo: string; rol: 'admin' | 'colaborador' }): Promise<{ ok: true; usuarioId: string } | { ok: false; error: string }> {
  const limpio = motivo.trim().slice(0, 300)
  if (limpio.length < 5) return { ok: false, error: 'Escribe el motivo de la anulación (mínimo 5 letras): queda guardado con tu nombre.' }
  const { data, error } = await createAdminSupabase()
    .from('pagos_plan')
    .update({ estado: 'anulado', anulado_motivo: limpio })
    .eq('id', pagoId)
    .eq('estado', 'activo')
    .select('usuario_id, tipo, plan, horas, monto_usd')
    .maybeSingle()
  if (error) return { ok: false, error: 'No se pudo anular el pago' }
  if (!data) return { ok: false, error: 'El pago no existe o ya estaba anulado' }
  const pago = data as { usuario_id: string; tipo: string; plan: string | null; horas: number | null; monto_usd: number }
  await registrarEvento({ entidad: 'pago', entidadId: pagoId, tipo: 'pago_anulado', actor: `admin:${actor.correo}`, datos: { usuario_id: pago.usuario_id, monto_usd: Number(pago.monto_usd), motivo: limpio, rol: actor.rol } })
  await alertaAdmin(actor.rol === 'admin' ? 'actividad' : 'tarea',
    `💸 ${esc(actor.correo)} anuló un pago de <b>$${Number(pago.monto_usd)}</b> (${pago.tipo === 'extra' ? `visita extra de ${pago.horas ?? '?'} h` : `plan ${pago.plan ?? ''}`}). Motivo: ${esc(limpio)}`,
    { categoria: 'pago_anulado', entidad: { tipo: 'cliente', id: pago.usuario_id, nombre: 'Pago anulado' } })
  return { ok: true, usuarioId: pago.usuario_id }
}
