// POST /api/visita/cancelar — el cliente cancela una visita en coordinación (pre_visita).
import { getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { esc } from '@/lib/html'
import { ok, err, unauthorized } from '@/lib/api'

export async function POST(req: Request) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const body = await req.json().catch(() => null)
  const mensaje = typeof body?.mensaje === 'string' ? body.mensaje.trim().slice(0, 500) : ''

  const admin = createAdminSupabase()

  // Buscar la visita en pre_visita del cliente, con datos del compita
  const { data: visita } = await admin
    .from('visitas')
    .select('id, usuario_id, compita_id, compitas(nombre, telegram_chat_id), usuarios(nombre)')
    .eq('usuario_id', user.id)
    .eq('estado', 'pre_visita')
    .maybeSingle() as {
      data: {
        id: string
        usuario_id: string
        compita_id: string
        compitas: { nombre: string; telegram_chat_id: string | null } | null
        usuarios: { nombre: string } | null
      } | null
    }

  if (!visita) return err('No hay visita en coordinación que puedas cancelar', 404)

  // Eliminar la visita
  const { error } = await admin.from('visitas').delete().eq('id', visita.id).eq('estado', 'pre_visita')
  if (error) {
    console.error('[visita/cancelar]', error)
    return err('No se pudo cancelar la visita', 500)
  }

  const clienteNombre = visita.usuarios?.nombre ?? 'El cliente'
  const compitaNombre = visita.compitas?.nombre ?? 'la compita'

  // Notificar al compita por Telegram
  if (visita.compitas?.telegram_chat_id) {
    const textoMensaje = mensaje
      ? `👋 <b>${esc(clienteNombre)}</b> ha cancelado la próxima visita.\n\n<b>Mensaje del cliente:</b> ${esc(mensaje)}`
      : `👋 <b>${esc(clienteNombre)}</b> ha cancelado la próxima visita.`
    try {
      await sendTelegramMessage(visita.compitas.telegram_chat_id, textoMensaje)
    } catch (e) { console.error('[visita/cancelar] Telegram compita:', e) }
  }

  await avisarAdmin(`ℹ️ <b>${esc(clienteNombre)}</b> canceló la visita en coordinación con <b>${esc(compitaNombre)}</b>.${mensaje ? `\n<b>Motivo:</b> ${esc(mensaje)}` : ''}`)

  return ok(null)
}
