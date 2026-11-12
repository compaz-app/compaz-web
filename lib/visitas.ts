// Lógica de visitas recurrentes: de la 2ª visita en adelante el cliente agenda otra con su compita asignada.
import { createAdminSupabase } from '@/lib/supabase-server'
import { PLANES, CICLO_PAGO_DIAS, type PlanId } from '@/lib/planes'
import { calcularCreditos, type PaqueteCredito } from '@/lib/creditos'
import { fichaCompleta } from '@/lib/ficha'
import { visitasConsumidasPorCancelacion } from '@/lib/cancelaciones'
import { parBloqueado } from '@/lib/bloqueos-compita'
import { personaPausada } from '@/lib/pausas'

export type MotivoNuevaVisita = 'sin_compita' | 'compita_no_disponible' | 'cliente_bloqueado' | 'cuenta_pausada' | 'visita_activa' | 'sin_visitas_previas' | 'ficha_incompleta' | 'limite_plan' | 'error'
export type ResultadoNuevaVisita =
  | { ok: true; visitaId: string; compitaNombre: string; clienteNombre: string; numero: number; telegramChatId: string | null; cupo: CupoPlan | null }
  | { ok: false; motivo: 'limite_plan'; mensaje: string; clienteNombre: string; compitaNombre: string; cupo: CupoPlan }
  | { ok: false; motivo: Exclude<MotivoNuevaVisita, 'limite_plan'>; mensaje: string }

const MENSAJES: Record<MotivoNuevaVisita, string> = {
  sin_compita: 'Todavía no tienes una compita asignada.',
  compita_no_disponible: 'Tu compita no está disponible en este momento. Escríbenos a hola@micompaz.com.',
  cliente_bloqueado: 'Tu cuenta está suspendida. Escríbenos a hola@micompaz.com.',
  cuenta_pausada: 'Tu cuenta está en pausa: por ahora no puedes agendar visitas. El equipo se comunica contigo por correo.',
  visita_activa: 'Ya tienes una visita en coordinación o programada. Termínala o reagéndala antes de agendar otra.',
  limite_plan: 'Ya usaste todas las visitas de tu plan. Escríbenos a hola@micompaz.com para renovar o ampliar tu plan.',
  sin_visitas_previas: 'Tu primera visita se coordina al contratar. Escríbenos si no la ves en tu portal.',
  ficha_incompleta: 'Antes de agendar completa la ficha de tu familiar y acepta los términos. La encuentras en tu portal.',
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
  return (await cuposDelPlan([usuarioId])).get(usuarioId) ?? null
}

/**
 * El cupo de VARIOS clientes con una cantidad fija de consultas (pagos, visitas, cancelaciones consumidas y plan antiguo), no una tanda por cliente.
 * Es la única implementación: cupoDelPlan de uno solo la usa con un lote de uno. Sin pagos registrados ni plan antiguo, el cliente queda en null.
 */
export async function cuposDelPlan(ids: string[]): Promise<Map<string, CupoPlan | null>> {
  const salida = new Map<string, CupoPlan | null>()
  if (ids.length === 0) return salida
  const supabase = createAdminSupabase()
  const [pagosR, visitasR, consumidasR, usuariosR] = await Promise.all([
    supabase.from('pagos_plan').select('id, usuario_id, tipo, plan, visitas, inicio, vence, estado').in('usuario_id', ids),
    supabase.from('visitas').select('usuario_id, created_at').in('usuario_id', ids),
    supabase.from('cancelaciones').select('usuario_id, visita_creada_en').in('usuario_id', ids).eq('cuenta_como_usada', true).eq('justificada', false),
    supabase.from('usuarios').select('id, plan_contratado, plan_inicio').in('id', ids),
  ])
  if (pagosR.error) console.error('[cupoDelPlan] tabla de pagos no disponible (¿migración pendiente?):', pagosR.error.message)
  if (consumidasR.error) console.error('[cancelaciones] consumidas:', consumidasR.error.message)
  const porUsuario = <T extends { usuario_id: string }>(filas: T[] | null | undefined) => {
    const m = new Map<string, T[]>(); for (const f of filas ?? []) { const l = m.get(f.usuario_id); if (l) l.push(f); else m.set(f.usuario_id, [f]) } return m
  }
  const pagos = pagosR.error ? new Map<string, never[]>() : porUsuario((pagosR.data ?? []) as { usuario_id: string }[])
  const visitas = porUsuario((visitasR.data ?? []) as { usuario_id: string; created_at: string }[])
  const consumidas = consumidasR.error ? new Map<string, never[]>() : porUsuario((consumidasR.data ?? []) as { usuario_id: string; visita_creada_en: string | null }[])
  const filasU = new Map(((usuariosR.data ?? []) as { id: string; plan_contratado: string | null; plan_inicio: string | null }[]).map((u) => [u.id, u]))

  for (const id of ids) {
    const propios = (pagos.get(id) ?? []) as unknown as PaqueteCredito[]
    // Con pagos registrados (aunque estén anulados) manda el sistema de paquetes: el cupo antiguo no se reactiva.
    if (propios.length > 0) {
      const creadas = (visitas.get(id) ?? []).map((v) => v.created_at)
      // Las visitas canceladas con poco aviso cuentan como usadas aunque la visita ya no exista.
      const usadasPorCancelacion = ((consumidas.get(id) ?? []) as { visita_creada_en: string | null }[]).map((f) => f.visita_creada_en).filter((x): x is string => !!x)
      const r = calcularCreditos(propios, [...creadas, ...usadasPorCancelacion])
      const ultimoPlan = propios.filter((p) => p.tipo === 'plan' && p.estado !== 'anulado').sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0]
      const plan = (ultimoPlan?.plan as PlanId | undefined) ?? null
      const hayActivos = propios.some((p) => p.estado !== 'anulado')
      salida.set(id, {
        plan, planNombre: plan ? PLANES[plan].nombre : hayActivos ? 'Visita extra' : 'Sin plan activo',
        limite: r.total, usadas: r.usadas, restantes: r.disponibles,
        renueva: ultimoPlan && plan !== 'carta' ? new Date(new Date(ultimoPlan.inicio).getTime() + CICLO_PAGO_DIAS * 86400_000).toISOString() : null,
        vence: r.proximoVencimiento, modo: 'creditos',
      })
      continue
    }
    // Cupo antiguo (cuentas anteriores a los pagos registrados)
    if (usuariosR.error) { console.error('[cupoDelPlan] columnas de plan no disponibles:', usuariosR.error.message); salida.set(id, null); continue }
    const u = filasU.get(id)
    const lim = u?.plan_contratado ? LIMITES_LEGADO[u.plan_contratado] : undefined
    if (!u?.plan_contratado || !u.plan_inicio || !lim) { salida.set(id, null); continue }
    const inicio = new Date(u.plan_inicio).getTime()
    const CICLO = 30 * 86400_000
    const k = lim.ciclo === '30d' ? Math.max(0, Math.floor((Date.now() - inicio) / CICLO)) : 0
    const desde = new Date(lim.ciclo === '30d' ? inicio + k * CICLO : new Date(u.plan_inicio).getTime()).getTime()
    const renueva = lim.ciclo === '30d' ? new Date(inicio + (k + 1) * CICLO).toISOString() : null
    const usadas = (visitas.get(id) ?? []).filter((v) => new Date(v.created_at).getTime() >= desde).length
    const plan = u.plan_contratado as PlanId
    salida.set(id, {
      plan, planNombre: PLANES[plan]?.nombre ?? u.plan_contratado, limite: lim.visitas, usadas,
      restantes: Math.max(0, lim.visitas - usadas), renueva, vence: renueva, modo: 'legado',
    })
  }
  return salida
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
    .from('usuarios').select('nombre, plan, compita_id, familiar_nombre, telefono, terminos_aceptados_en').eq('id', usuarioId).maybeSingle()
  if (!usuario?.compita_id) return falla('sin_compita')
  if (usuario.plan === 'bloqueado') return falla('cliente_bloqueado')
  if (await personaPausada('cliente', usuarioId)) return falla('cuenta_pausada')
  // Sin ficha completa y términos aceptados no se agenda (la validación vive aquí, no solo en la pantalla).
  if (!fichaCompleta(usuario)) return falla('ficha_incompleta')

  const { data: compita } = await supabase
    .from('compitas').select('nombre, estado, verificado, telegram_chat_id').eq('id', usuario.compita_id).maybeSingle()
  if (!compita || compita.estado !== 'activo' || !compita.verificado) return falla('compita_no_disponible')
  if (await parBloqueado(usuario.compita_id, usuarioId)) return falla('compita_no_disponible')

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
