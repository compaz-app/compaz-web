// POST /api/cron/aviso-inicio-visita — cada 15 min
// 1. 30 min antes de la hora programada le envía al compita el botón ▶️ Iniciar visita.
// 2. Auto-confirma visitas en estado 'confirmando_inicio' que llevan más de 5 min sin
//    confirmación del cliente (para no bloquear al compita si el cliente no responde).
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin, INLINE_INICIO, INLINE_DURANTE, TECLADO_DURANTE_VISITA } from '@/lib/telegram'
import { sendVisitaInicio } from '@/lib/resend'
import { esc } from '@/lib/html'
import { hoyVE, horaVE } from '@/lib/format'
import { cronAutorizado, latido, reclamarUnaVez } from '@/lib/cron'
import type { Visita, Usuario } from '@/types'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()

  // ── 1. Avisar al compita hasta 30 min antes (ventana 0-30 min para no perder visitas recién agendadas) ──
  const desde = horaVE(Date.now())
  const hasta = horaVE(Date.now() + 30 * 60_000)
  const hoy = hoyVE()

  const { data: visitas, error } = await admin
    .from('visitas')
    .select('id, hora_inicio_programada, compitas(nombre, telegram_chat_id), usuarios(nombre)')
    .eq('estado', 'programada')
    .eq('fecha_programada', hoy)
    .not('hora_inicio_programada', 'is', null)
    .gte('hora_inicio_programada', desde)
    .lte('hora_inicio_programada', hasta)
  if (error) console.error('[aviso-inicio-visita] consulta falló:', error)

  let enviados = 0
  for (const visita of visitas ?? []) {
    if (!(await reclamarUnaVez(`aviso_inicio:${visita.id}`))) continue
    const compita = visita.compitas as unknown as { nombre: string; telegram_chat_id: string | null } | null
    const cliente = visita.usuarios as unknown as { nombre: string } | null

    if (compita?.telegram_chat_id) {
      try {
        await sendTelegramMessage(
          compita.telegram_chat_id,
          [`⏰ <b>Tu visita empieza en ~30 minutos</b>`, ``, `Cuando llegues donde <b>${esc(cliente?.nombre ?? 'el cliente')}</b> y vayas a comenzar, toca el botón de abajo.`].join('\n'),
          INLINE_INICIO,
        )
        enviados++
      } catch (e) {
        console.error('[aviso-inicio-visita] Telegram falló:', e)
        await avisarAdmin(`⚠️ No se pudo enviar el aviso de inicio a <b>${esc(compita.nombre)}</b> para la visita con <b>${esc(cliente?.nombre ?? '—')}</b> a las <b>${esc(visita.hora_inicio_programada!)}</b>. Contáctala manualmente.`)
      }
    } else {
      await avisarAdmin(`⚠️ <b>${esc(compita?.nombre ?? '—')}</b> no tiene Telegram registrado. Su visita con <b>${esc(cliente?.nombre ?? '—')}</b> empieza a las <b>${esc(visita.hora_inicio_programada!)}</b>. Avísale tú.`)
    }
  }

  // ── 2. Auto-confirmar si el cliente lleva 5+ min sin confirmar ─────────────
  const hace5min = new Date(Date.now() - 5 * 60_000).toISOString()
  const { data: pendientes } = await admin
    .from('visitas')
    .select('id, updated_at, compitas(nombre, telegram_chat_id), usuario:usuarios(*)')
    .eq('estado', 'confirmando_inicio')
    .lt('updated_at', hace5min)

  let autoConfirmados = 0
  for (const v of pendientes ?? []) {
    if (!(await reclamarUnaVez(`auto_confirma:${v.id}`))) continue
    const ahora = new Date().toISOString()
    const { data: iniciada } = await admin
      .from('visitas')
      .update({ estado: 'en_curso', inicio: ahora })
      .eq('id', v.id)
      .eq('estado', 'confirmando_inicio')
      .select('*, compita:compitas(id, nombre, telegram_chat_id), usuario:usuarios(*)')
      .maybeSingle() as { data: (Visita & { compita: { id: string; nombre: string; telegram_chat_id: string | null }; usuario: Usuario }) | null }

    if (!iniciada) continue

    const compita = iniciada.compita
    const usuario = iniciada.usuario

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
          `✅ <b>¡Visita iniciada automáticamente!</b>\n\nEl cliente no confirmó a tiempo, pero la visita arrancó igual.${perfilTexto}\n\n📸 Puedes mandar fotos y mensajes desde aquí.\n\nCuando termines, toca el botón 🔴 de tu teclado. 👇`,
          TECLADO_DURANTE_VISITA,
        )
      } catch (e) { console.error('[aviso-inicio-visita] Telegram auto-confirma:', e) }
    }

    try { await sendVisitaInicio(usuario, compita as Parameters<typeof sendVisitaInicio>[1], iniciada) }
    catch (e) { console.error('[aviso-inicio-visita] email auto-confirma:', e) }

    const horaInicio = new Date(ahora).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas', hour12: true })
    await avisarAdmin(`▶️ <b>Visita auto-iniciada</b> (cliente no confirmó)\n\n<b>Compita:</b> ${esc(compita.nombre)}\n<b>Cliente:</b> ${esc(usuario.nombre)}\n<b>Hora:</b> ${horaInicio}`)
    autoConfirmados++
  }

  await latido('aviso-inicio-visita')
  return NextResponse.json({ ok: true, enviados, autoConfirmados })
}
