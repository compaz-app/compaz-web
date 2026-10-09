// Lógica de visitas recurrentes: de la 2ª visita en adelante el cliente agenda otra con su compita asignada.
import { createAdminSupabase } from '@/lib/supabase-server'
import { LIMITES_PLAN, PLAN_INFO } from '@/lib/pago'

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
  plan: string; planNombre: string; limite: number; usadas: number; restantes: number
  ciclo: 'unico' | '30d'; renueva: string | null // ISO del próximo ciclo (null si es plan único)
}

/**
 * Cupo de visitas del plan vigente del cliente. null = sin plan registrado (cuentas anteriores o
 * asignadas a mano sin plan): no hay límite. Cuenta toda visita creada desde el inicio del ciclo.
 */
export async function cupoDelPlan(usuarioId: string): Promise<CupoPlan | null> {
  const supabase = createAdminSupabase()
  const { data: u, error } = await supabase
    .from('usuarios').select('plan_contratado, plan_inicio').eq('id', usuarioId).maybeSingle()
  if (error) { console.error('[cupoDelPlan] columnas de plan no disponibles (¿migración pendiente?):', error.message); return null }
  const lim = u?.plan_contratado ? LIMITES_PLAN[u.plan_contratado] : undefined
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
  return {
    plan: u.plan_contratado, planNombre: PLAN_INFO[u.plan_contratado]?.nombre ?? u.plan_contratado,
    limite: lim.visitas, usadas, restantes: Math.max(0, lim.visitas - usadas), ciclo: lim.ciclo, renueva,
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
