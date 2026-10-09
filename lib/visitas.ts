// Lógica de visitas recurrentes: de la 2ª visita en adelante el cliente agenda otra con su compita asignada.
import { createAdminSupabase } from '@/lib/supabase-server'
import { PLANES, CICLO_PAGO_DIAS, type PlanId } from '@/lib/planes'
import { calcularCreditos, type PaqueteCredito } from '@/lib/creditos'

export type MotivoNuevaVisita = 'sin_compita' | 'compita_no_disponible' | 'cliente_bloqueado' | 'visita_activa' | 'sin_visitas_previas' | 'limite_plan' | 'error'
export type ResultadoNuevaVisita =
  | { ok: true; visitaId: string; compitaNombre: string; clienteNombre: string; numero: number; telegramChatId: string | null; cupo: CupoPlan | null }
  | { ok: false; motivo: 'limite_plan'; mensaje: string; clienteNombre: string; compitaNombre: string; cupo: CupoPlan }
  | { ok: false; motivo: Exclude<MotivoNuevaVisita, 'limite_plan'>; mensaje: string }

const MENSAJES: Record<MotivoNuevaVisita, string> = {
  sin_compita: 'Todavía no tienes una compita asignada.',
  compita_no_disponible: 'Tu compita no está disponible en este momento. Escríbenos a hola@micompaz.com.',
  cliente_bloqueado: 'Tu cuenta está suspendida. Escríbenos a hola@micompaz.com.',
  visita_activa: 'Ya tienes una visita en coordinación o programada. Termínala o reagéndala antes de agendar otra.',
  limite_plan: 'Ya usaste todas las visitas de tu plan. Escríbenos a hola@micompaz.com para renovar o ampliar tu plan.',
  sin_visitas_previas: 'Tu primera visita se coordina al contratar. Escríbenos si no la ves en tu portal.',
  error: 'No pudimos crear la visita. Intenta de nuevo.',
}
const falla = (motivo: Exclude<MotivoNuevaVisita, 'limite_plan'>): ResultadoNuevaVisita => ({ ok: false, motivo, mensaje: MENSAJES[motivo] })

export type CupoPlan = {
  plan: string | null; planNombre: string
  limite: number; usadas: number; restantes: number
  /** Cuándo toca pagar el siguiente mes (null si el último pago fue "A la carta" o una visita extra) */
  renueva: string | null
  /** Cuándo vence el primer saldo de visitas (las no usadas se pueden usar hasta entonces) */
  vence: string | null
  modo: 'creditos' | 'legado'
}

const LIMITES_LEGADO: Record<string, { visitas: number; ciclo: 'unico' | '30d' }> = {
  carta: { visitas: 1, ciclo: 'unico' }, quincenal: { visitas: 2, ciclo: '30d' }, semanal: { visitas: 4, ciclo: '30d' },
}

/**
 * Cupo de visitas del cliente. Con pagos registrados (pagos_plan) usa paquetes que vencen a los 60 días.
 * Sin pagos registrados cae al cupo antiguo por plan_contratado/plan_inicio. Sin ninguno de los dos: null (sin límite).
 */
export async function cupoDelPlan(usuarioId: string): Promise<CupoPlan | null> {
  const supabase = createAdminSupabase()

  const { data: pagos, error: eP } = await supabase
    .from('pagos_plan').select('id, tipo, plan, visitas, inicio, vence, estado').eq('usuario_id', usuarioId)
  // Con pagos registrados (aunque estén anulados) manda el sistema de paquetes: el cupo antiguo no se reactiva.
  if (!eP && (pagos ?? []).length > 0) {
    const { data: vs } = await supabase.from('visitas').select('created_at').eq('usuario_id', usuarioId)
    const todos = pagos as PaqueteCredito[]
    const r = calcularCreditos(todos, (vs ?? []).map((v) => v.created_at as string))
    const ultimoPlan = todos.filter((p) => p.tipo === 'plan' && p.estado !== 'anulado').sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0]
    const plan = (ultimoPlan?.plan as PlanId | undefined) ?? null
    const hayActivos = todos.some((p) => p.estado !== 'anulado')
    return {
      plan, planNombre: plan ? PLANES[plan].nombre : hayActivos ? 'Visita extra' : 'Sin plan activo',
      limite: r.total, usadas: r.usadas, restantes: r.disponibles,
      renueva: ultimoPlan && plan !== 'carta' ? new Date(new Date(ultimoPlan.inicio).getTime() + CICLO_PAGO_DIAS * 86400_000).toISOString() : null,
      vence: r.proximoVencimiento, modo: 'creditos',
    }
  }
  if (eP) console.error('[cupoDelPlan] tabla de pagos no disponible (¿migración pendiente?):', eP.message)

  // Cupo antiguo (cuentas anteriores a los pagos registrados)
  const { data: u, error } = await supabase
    .from('usuarios').select('plan_contratado, plan_inicio').eq('id', usuarioId).maybeSingle()
  if (error) { console.error('[cupoDelPlan] columnas de plan no disponibles:', error.message); return null }
  const lim = u?.plan_contratado ? LIMITES_LEGADO[u.plan_contratado] : undefined
  if (!u?.plan_contratado || !u.plan_inicio || !lim) return null

  const inicio = new Date(u.plan_inicio).getTime()
  const CICLO = 30 * 86400_000
  const k = lim.ciclo === '30d' ? Math.max(0, Math.floor((Date.now() - inicio) / CICLO)) : 0
  const desde = new Date(inicio + k * CICLO).toISOString()
  const renueva = lim.ciclo === '30d' ? new Date(inicio + (k + 1) * CICLO).toISOString() : null
  const { count } = await supabase
    .from('visitas').select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId).gte('created_at', lim.ciclo === '30d' ? desde : u.plan_inicio)
  const usadas = count ?? 0
  const plan = u.plan_contratado as PlanId
  return {
    plan, planNombre: PLANES[plan]?.nombre ?? u.plan_contratado, limite: lim.visitas, usadas,
    restantes: Math.max(0, lim.visitas - usadas), renueva, vence: renueva, modo: 'legado',
  }
}

/**
 * Crea la siguiente visita (estado 'pre_visita') del cliente con su compita asignada.
 * Reglas: compita asignada, activa y verificada; cliente no bloqueado; sin otra visita activa;
 * al menos una visita terminada (la primera nace al contratar). El mismo flujo de chat, fecha,
 * recordatorios, inicio, cierre, cuestionario y valoración aplica a cada visita.
 */
export async function crearSiguienteVisita(usuarioId: string): Promise<ResultadoNuevaVisita> {
  const supabase = createAdminSupabase()

  const { data: usuario } = await supabase
    .from('usuarios').select('nombre, plan, compita_id').eq('id', usuarioId).maybeSingle()
  if (!usuario?.compita_id) return falla('sin_compita')
  if (usuario.plan === 'bloqueado') return falla('cliente_bloqueado')

  const { data: compita } = await supabase
    .from('compitas').select('nombre, estado, verificado, telegram_chat_id').eq('id', usuario.compita_id).maybeSingle()
  if (!compita || compita.estado !== 'activo' || !compita.verificado) return falla('compita_no_disponible')

  const { data: visitas, error: eV } = await supabase
    .from('visitas').select('id, estado').eq('usuario_id', usuarioId)
  if (eV) return falla('error')
  const lista = visitas ?? []
  if (lista.some((v) => ['pre_visita', 'programada', 'en_curso'].includes(v.estado))) return falla('visita_activa')
  const terminadas = lista.filter((v) => v.estado === 'terminada').length
  if (terminadas === 0) return falla('sin_visitas_previas')

  // Límite del plan contratado (la visita nueva consumiría una)
  const cupo = await cupoDelPlan(usuarioId)
  if (cupo && cupo.restantes <= 0) {
    return { ok: false, motivo: 'limite_plan', mensaje: MENSAJES.limite_plan, clienteNombre: usuario.nombre, compitaNombre: compita.nombre, cupo }
  }

  const { data: nueva, error } = await supabase
    .from('visitas')
    .insert({ compita_id: usuario.compita_id, usuario_id: usuarioId, estado: 'pre_visita' })
    .select('id')
    .single()
  // 23505: otro clic simultáneo ya creó la visita (índice único de visita activa por cliente)
  if (error?.code === '23505') return falla('visita_activa')
  if (error || !nueva) { console.error('[crearSiguienteVisita] error:', error); return falla('error') }

  return {
    ok: true, visitaId: nueva.id, compitaNombre: compita.nombre, clienteNombre: usuario.nombre,
    numero: terminadas + 1, telegramChatId: compita.telegram_chat_id,
    cupo: cupo ? { ...cupo, usadas: cupo.usadas + 1, restantes: cupo.restantes - 1 } : null,
  }
}
