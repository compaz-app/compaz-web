// POST /api/visita/confirmar-inicio — el cliente confirma que el compita llegó.
// Transiciona confirmando_inicio → en_curso y notifica al compita por Telegram.
import { getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin, TECLADO_DURANTE_VISITA } from '@/lib/telegram'
import { sendVisitaInicio } from '@/lib/resend'
import { esc } from '@/lib/html'
import { ok, err, unauthorized } from '@/lib/api'
import type { Visita, Usuario } from '@/types'

export async function POST(req: Request) {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const { visitaId } = await req.json() as { visitaId?: string }
  if (!visitaId) return err('visitaId requerido', 400)

  const admin = createAdminSupabase()
  const ahora = new Date().toISOString()

  const { data: visita } = await admin
    .from('visitas')
    .update({ estado: 'en_curso', inicio: ahora })
    .eq('id', visitaId)
    .eq('usuario_id', user.id)
    .eq('estado', 'confirmando_inicio')
    .select('*, compita:compitas(id, nombre, telegram_chat_id), usuario:usuarios(*)')
    .maybeSingle() as { data: (Visita & { compita: { id: string; nombre: string; telegram_chat_id: string | null }; usuario: Usuario }) | null }

  if (!visita) return err('No hay visita pendiente de confirmación', 409)

  const compita = visita.compita
  const usuario = visita.usuario

  // Avisar al compita: ¡el cliente confirmó, arranca!
  if (compita.telegram_chat_id) {
    const perfilLineas: string[] = []
    if (usuario.familiar_nombre) perfilLineas.push(`<b>Nombre:</b> ${esc(usuario.familiar_nombre)}`)
    if (usuario.familiar_edad) perfilLineas.push(`<b>Edad:</b> ${esc(String(usuario.familiar_edad))} años`)
    if (usuario.familiar_condicion) perfilLineas.push(`<b>Condición:</b> ${esc(usuario.familiar_condicion)}`)
    if (usuario.familiar_notas) perfilLineas.push(`<b>Notas:</b> ${esc(usuario.familiar_notas)}`)
    const perfilTexto = perfilLineas.length > 0 ? `\n\n👤 <b>Perfil del familiar:</b>\n${perfilLineas.join('\n')}` : ''

    try {
      await sendTelegramMessage(
        compita.telegram_chat_id,
        `✅ <b>¡${esc(usuario.nombre)} confirmó tu llegada!</b>\n\nLa visita está activa.${perfilTexto}\n\n📸 Puedes mandar fotos y mensajes desde aquí — la familia los verá en tiempo real.\n\nCuando termines, toca el botón 🔴 de tu teclado. 👇`,
        TECLADO_DURANTE_VISITA,
      )
    } catch (e) { console.error('[confirmar-inicio] Telegram compita:', e) }
  }

  try { await sendVisitaInicio(usuario, compita as Parameters<typeof sendVisitaInicio>[1], visita) }
  catch (e) {
    console.error('[confirmar-inicio] email inicio:', e)
    await avisarAdmin(`⚠️ No se pudo enviar el correo de inicio de visita a <b>${esc(usuario.nombre)}</b> (${esc(usuario.email)}).`)
  }

  const horaInicio = new Date(ahora).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas', hour12: true })
  await avisarAdmin(`▶️ <b>Visita iniciada</b>\n\n<b>Compita:</b> ${esc(compita.nombre)}\n<b>Cliente:</b> ${esc(usuario.nombre)}\n<b>Hora:</b> ${horaInicio}`)

  return ok({ iniciada: true })
}
