// Lógica de visitas recurrentes: de la 2ª visita en adelante el cliente agenda otra con su compita asignada.
import { createAdminSupabase } from '@/lib/supabase-server'

export type MotivoNuevaVisita = 'sin_compita' | 'compita_no_disponible' | 'cliente_bloqueado' | 'visita_activa' | 'sin_visitas_previas' | 'error'
export type ResultadoNuevaVisita =
  | { ok: true; visitaId: string; compitaNombre: string; clienteNombre: string; numero: number; telegramChatId: string | null }
  | { ok: false; motivo: MotivoNuevaVisita; mensaje: string }

const MENSAJES: Record<MotivoNuevaVisita, string> = {
  sin_compita: 'Todavía no tienes una compita asignada.',
  compita_no_disponible: 'Tu compita no está disponible en este momento. Escríbenos a hola@micompaz.com.',
  cliente_bloqueado: 'Tu cuenta está suspendida. Escríbenos a hola@micompaz.com.',
  visita_activa: 'Ya tienes una visita en coordinación o programada. Termínala o reagéndala antes de agendar otra.',
  sin_visitas_previas: 'Tu primera visita se coordina al contratar. Escríbenos si no la ves en tu portal.',
  error: 'No pudimos crear la visita. Intenta de nuevo.',
}
const falla = (motivo: MotivoNuevaVisita): ResultadoNuevaVisita => ({ ok: false, motivo, mensaje: MENSAJES[motivo] })

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
  }
}
