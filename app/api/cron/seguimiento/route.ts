// POST /api/cron/seguimiento — Netlify Scheduled Function cada 5 min
// Paso 1 (respaldo del webhook de Daily): 25 min post-slot, "¿ocurrió la llamada?" a ambas partes.
// Paso 2: "¿quieres contratar?" cuando ambos confirmaron (o timeout de 4 h sin que nadie diga NO).
// Paso 3: recordatorio a las 24 h si el cliente no respondió.
// Paso 4: entrevistas que se quedaron sin hora: recordatorio al cliente a las 24 h y tarea para el equipo a las 48 h (lib/sin-hora.ts).
// Cada envío reclama su flag de forma atómica antes de enviar (sin duplicados) y lo libera si falla.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import {
  getSolicitudesParaConfirmacion, getSolicitudesParaSeguimiento, getSolicitudesParaSegundoSeguimiento,
  reclamarFlag, liberarFlag,
} from '@/lib/solicitudes'
import { sendTelegramMessage, makeInlineKeyboard } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { registrarNovedad, novedadVista, correoDeDecisionEnviado } from '@/lib/novedades'
import { TITULO_SEGUIMIENTO } from '@/lib/novedades-politica'
import { esc } from '@/lib/html'
import { qRol } from '@/lib/links'
import { cronAutorizado, latido } from '@/lib/cron'
import { ok, err } from '@/lib/api'
import { AVISO_FUERA } from '@/lib/avisos-seguridad'
import { procesarSolicitudesSinHora } from '@/lib/sin-hora'
import type { Solicitud } from '@/types'

const AVISO_PLATAFORMA_CLIENTE = `
  <p style="color:#C84B0E;font-size:13px;line-height:1.6;margin:24px 0 0">${AVISO_FUERA}</p>`

function emailDecision(s: Solicitud, asunto: string, titulo: string, intro: string): { subject: string; html: string } {
  const base = `${SITE_URL}/api/solicitud/seguimiento?token=${s.token_respuesta}`
  const siUrl = `${base}&respuesta=si`
  const noUrl = `${base}&respuesta=no&${qRol(s.token_respuesta, 'cliente')}`
  return {
    subject: asunto,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
        <h2 style="color:#2D1464;font-size:22px">${titulo}</h2>
        <p style="color:#4A3B6B;font-size:16px;line-height:1.6">${intro}</p>
        <div style="margin-top:24px">
          <a href="${siUrl}" style="display:inline-block;background:#22C55E;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-bottom:12px">Sí, quiero contratarla</a>
          <br>
          <a href="${noUrl}" style="display:inline-block;background:#E8E0D4;color:#1A0A3C;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px">No por ahora</a>
        </div>
        ${AVISO_PLATAFORMA_CLIENTE}
</div>`,
  }
}

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return err('No autorizado', 401)

  const admin = createAdminSupabase()
  let procesados = 0

  // ── Paso 1: "¿ocurrió la llamada?" ──────────────────────────────────────────
  for (const sol of await getSolicitudesParaConfirmacion()) {
    try {
      if (!(await reclamarFlag(sol.id, 'confirmacion_llamada_enviada'))) continue
      const [{ data: cliente }, { data: compita }] = await Promise.all([
        admin.from('usuarios').select('nombre, email').eq('id', sol.cliente_id).single(),
        admin.from('compitas').select('telegram_chat_id').eq('id', sol.compita_id).single(),
      ])
      const t = sol.token_respuesta
      const url = (quien: 'cliente' | 'compita', r: 'si' | 'no') =>
        `${SITE_URL}/api/solicitud/confirmacion-llamada?token=${t}&respuesta=${r}&${qRol(t, quien)}`

      // El cliente se entera en su portal (novedad); el único correo de esta etapa es el de las 24 horas (paso 3). Decidido 2026-11-18.
      let enviado = false
      if (await registrarNovedad({ usuarioId: sol.cliente_id, tipo: 'seguimiento_llamada', nivel: 'accionable', titulo: TITULO_SEGUIMIENTO.seguimiento_llamada, entidad: 'solicitud', entidadId: sol.id, clave: `seguimiento_llamada:${sol.id}` })) enviado = true
      if (compita?.telegram_chat_id) {
        try {
          const n = esc(cliente?.nombre?.split(' ')[0] ?? 'el cliente')
          await sendTelegramMessage(
            compita.telegram_chat_id,
            `🤙 <b>¿Cómo estuvo la llamada con ${n}?</b>\n\n¿Pudiste conectarte y hablar con ${n}?`,
            makeInlineKeyboard([[
              // Callback, no enlace: el compita responde con un toque y se queda en Telegram (sin página web de por medio ni «Ir al portal»).
              { text: '✅ Sí, ocurrió', callback_data: `ll:si:${sol.id}` },
              { text: '❌ No se pudo', callback_data: `ll:no:${sol.id}` },
            ]]),
          )
          enviado = true
        } catch (e) { console.error('Telegram confirmacion compita:', e) }
      }
      if (enviado) procesados++
      else await liberarFlag(sol.id, 'confirmacion_llamada_enviada')
    } catch (e) { console.error(`[seguimiento] paso 1 fallo ${sol.id}:`, e) }
  }

  // ── Paso 2: "¿quieres contratar?" ───────────────────────────────────────────
  for (const s of await getSolicitudesParaSeguimiento()) {
    try {
      if (!(await reclamarFlag(s.id, 'seguimiento_enviado'))) continue
      await registrarNovedad({ usuarioId: s.cliente_id, tipo: 'seguimiento_decision', nivel: 'accionable', titulo: TITULO_SEGUIMIENTO.seguimiento_decision, entidad: 'solicitud', entidadId: s.id, clave: `seguimiento_decision:${s.id}` })
      procesados++
    } catch (e) { console.error(`[seguimiento] paso 2 fallo ${s.id}:`, e) }
  }

  // ── Paso 3: recordatorio a las 24 h ─────────────────────────────────────────
  for (const s of await getSolicitudesParaSegundoSeguimiento()) {
    try {
      if (!(await reclamarFlag(s.id, 'seguimiento2_enviado'))) continue
      const { data: cliente } = await admin.from('usuarios').select('email').eq('id', s.cliente_id).single()
      if (!cliente?.email) { procesados++; continue }
      // UN solo correo por decisión: si ya lo vio en el portal, o ya le llegó el aviso de fin de entrevista por correo, no se repite.
      if ((await novedadVista(`seguimiento_decision:${s.id}`)) || (await correoDeDecisionEnviado(s.id))) { procesados++; continue }
      try {
        await sendEmail({ to: cliente.email, ...emailDecision(
          s, `Recordatorio: ¿qué decidiste sobre ${s.compita_nombre}?`, '¿Tomaste una decisión?',
          `Hace un día te preguntamos si querías contratar a <strong>${esc(s.compita_nombre)}</strong>. Si aún no has decidido, no hay problema: puedes hacerlo ahora.`,
        ) })
        procesados++
      } catch (e) {
        console.error('Email segundo seguimiento:', e)
        await liberarFlag(s.id, 'seguimiento2_enviado')
      }
    } catch (e) { console.error(`[seguimiento] paso 3 fallo ${s.id}:`, e) }
  }

  // ── Paso 4: entrevistas sin hora ──────────────────────────────────────────────
  const sinHora = await procesarSolicitudesSinHora()
  procesados += sinHora.recordatorios + sinHora.tareas

  await latido('seguimiento')
  return ok({ procesados })
}
