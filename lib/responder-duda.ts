// Responder una "Duda sin resolver" desde la Bandeja: el equipo escribe la respuesta en el panel y el bot se la manda al compita por Telegram.
// Antes la tarea decía "respóndele por Telegram" y no había cómo hacerlo desde el sistema. Al enviar, la tarea se cierra y queda un evento con quién
// respondió. El texto no puede llevar teléfonos ni correos (el sistema no pasa contactos). Si Telegram falla, la tarea sigue abierta.
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { detectarContacto } from '@/lib/detectar-contacto'
import { registrarEvento } from '@/lib/eventos'
import { resolverFlag } from '@/lib/acciones-equipo'
import { esc } from '@/lib/html'
import type { Actor } from '@/lib/permisos'

import { MAX_RESPUESTA_DUDA } from '@/lib/responder-duda-tipos'

export type ResultadoRespuestaDuda = { ok: true } | { ok: false; status: number; error: string }

export async function responderDudaDeTarea(actor: Actor, flagId: string, textoCrudo: unknown): Promise<ResultadoRespuestaDuda> {
  const texto = typeof textoCrudo === 'string' ? textoCrudo.trim() : ''
  if (!texto) return { ok: false, status: 400, error: 'Escribe la respuesta para el compita' }
  if (texto.length > MAX_RESPUESTA_DUDA) return { ok: false, status: 400, error: `La respuesta es muy larga (máximo ${MAX_RESPUESTA_DUDA} caracteres)` }
  if (detectarContacto(texto).detectado) return { ok: false, status: 400, error: 'No incluyas teléfonos, correos ni enlaces de contacto: el sistema no los pasa. Quítalos y vuelve a enviar.' }

  const admin = createAdminSupabase()
  const { data: flag } = await admin.from('admin_flags').select('id, tipo, entidad_tipo, entidad_id, resuelto').eq('id', flagId).maybeSingle()
  const f = flag as { id: string; tipo: string | null; entidad_tipo: string; entidad_id: string; resuelto: boolean } | null
  if (!f || f.tipo !== 'duda_sin_resolver' || f.entidad_tipo !== 'compita') return { ok: false, status: 404, error: 'No encontramos esa duda' }
  if (f.resuelto) return { ok: false, status: 409, error: 'Esa duda ya estaba resuelta' }

  const { data: compita } = await admin.from('compitas').select('id, telegram_chat_id').eq('id', f.entidad_id).maybeSingle()
  const chat = (compita as { telegram_chat_id: string | null } | null)?.telegram_chat_id
  if (!chat) return { ok: false, status: 409, error: 'Este compita no tiene Telegram vinculado, así que no podemos escribirle desde aquí.' }

  try {
    await sendTelegramMessage(String(chat), `💬 <b>Respuesta del equipo de Compaz</b>\n\n${esc(texto)}\n\nSi sigues con dudas, toca 🙋 Tengo una duda.`)
  } catch (e) {
    console.error('[responder-duda] Telegram:', e)
    return { ok: false, status: 502, error: 'No se pudo enviar por Telegram. La duda sigue abierta: inténtalo de nuevo.' }
  }
  await registrarEvento({ entidad: 'compita', entidadId: f.entidad_id, tipo: 'duda_compita', actor: `admin:${actor.correo}`, datos: { tipo: 'otra', resultado: 'respondida', respuesta: texto } }).catch(() => undefined)
  await resolverFlag(flagId, actor.correo)
  return { ok: true }
}
