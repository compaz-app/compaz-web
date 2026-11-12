// El cliente toca "Llamar" durante una visita en curso: se abre (o reutiliza) la sala, se la guarda en la visita y se avisa al compita por Telegram y al
// equipo en Actividad. Toda la lógica y las consultas viven aquí; la ruta solo autentica y responde.
import { createAdminSupabase } from '@/lib/supabase-server'
import { getOrCreateDailyRoom } from '@/lib/daily'
import { sendTelegramMessage } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { esc } from '@/lib/html'
import { SITE_URL } from '@/lib/email'
import { enlaceDeLlamada } from '@/lib/llamada-acceso'
import { rutaLlamada } from '@/lib/llamada-ruta'
import { minutosLlamadaVisita } from '@/lib/llamada'
import { reclamarVentana } from '@/lib/cron'

/** Cada cuánto se le puede volver a avisar al compita de una llamada de la misma visita. Tocar "Llamar" más veces no lo llena de mensajes. */
export const VENTANA_AVISO_LLAMADA_MS = 60_000

export type ResultadoLlamadaVisita = { ok: true; url: string; roomName: string } | { ok: false; status: number; error: string }

export async function iniciarLlamadaDeVisita(usuarioId: string, soloAudio: boolean): Promise<ResultadoLlamadaVisita> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('visitas').select('id, room_url, compita:compitas(nombre, telegram_chat_id), usuario:usuarios(nombre)')
    .eq('usuario_id', usuarioId).eq('estado', 'en_curso').order('inicio', { ascending: false }).limit(1).maybeSingle()
  const visita = data as unknown as { id: string; room_url: string | null; compita: { nombre: string; telegram_chat_id: string | null } | null; usuario: { nombre: string } | null } | null
  if (!visita) return { ok: false, status: 400, error: 'No hay visita activa' }

  let room
  try { room = await getOrCreateDailyRoom(visita.id, visita.room_url ?? null, soloAudio) }
  catch (e) { console.error('[llamada-visita] no se pudo abrir la sala:', e); return { ok: false, status: 500, error: 'No se pudo abrir la llamada' } }

  const { error: eRoom } = await admin.from('visitas').update({ room_url: room.url }).eq('id', visita.id)
  if (eRoom) console.error('[llamada-visita] no se pudo guardar room_url:', eRoom.message)

  // La sala se devuelve siempre; el AVISO al compita y al equipo sale como mucho una vez por minuto por visita (S-07).
  if ((await reclamarVentana(`llamada_aviso:${visita.id}`, VENTANA_AVISO_LLAMADA_MS)).ok) {
    const minutos = await minutosLlamadaVisita()
    if (visita.compita?.telegram_chat_id) {
      const tipo = soloAudio ? '📞 El cliente quiere hacer una llamada de voz' : '📹 El cliente quiere hacer una videollamada'
      try { await sendTelegramMessage(visita.compita.telegram_chat_id, `${tipo}. Dura ${minutos} min.\n\nEntra aquí: ${SITE_URL}${enlaceDeLlamada(room.url, 'compita')}`) }
      catch (e) { console.error('[llamada-visita] Telegram:', e) }
    }
    await alertaAdmin('actividad', `${soloAudio ? '📞' : '📹'} <b>${esc(visita.usuario?.nombre ?? 'Un cliente')}</b> inició una ${soloAudio ? 'llamada de voz' : 'videollamada'} con <b>${esc(visita.compita?.nombre ?? 'su compita')}</b>.\n\n<a href="${SITE_URL}${rutaLlamada(room.url)}">Unirse →</a>`)
  }
  return { ok: true, url: room.url, roomName: room.name }
}
