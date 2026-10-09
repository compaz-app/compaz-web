// POST /api/cron/seguimiento — Netlify Scheduled Function cada 5 min
// Paso 1 (respaldo del webhook de Daily): 25 min post-slot, "¿ocurrió la llamada?" a ambas partes.
// Paso 2: "¿quieres contratar?" cuando ambos confirmaron (o timeout de 4 h sin que nadie diga NO).
// Paso 3: recordatorio a las 24 h si el cliente no respondió.
// Cada envío reclama su flag de forma atómica antes de enviar (sin duplicados) y lo libera si falla.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import {
  getSolicitudesParaConfirmacion, getSolicitudesParaSeguimiento, getSolicitudesParaSegundoSeguimiento,
  reclamarFlag, liberarFlag,
} from '@/lib/solicitudes'
import { sendTelegramMessage, makeInlineKeyboard } from '@/lib/telegram'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { qRol } from '@/lib/links'
import { cronAutorizado, latido } from '@/lib/cron'
import { ok, err } from '@/lib/api'
import type { Solicitud } from '@/types'

const AVISO_PLATAFORMA_CLIENTE = `
  <div style="background:#FFF3E8;border:2px solid #FF6B2B;border-radius:12px;padding:14px 18px;margin-top:24px">
    <p style="color:#C84B0E;font-size:13px;line-height:1.6;margin:0">
      <strong>Importante:</strong> Para que Compaz pueda garantizarte el servicio, mantén toda la comunicación con tu compita dentro de la plataforma. Si coordinan por fuera, Compaz no podrá responder por lo que suceda ni ofrecer ningún tipo de cobertura o garantía. Estamos aquí para protegerte a ti y a tu familiar.
    </p>
  </div>`

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
          <a href="${siUrl}" style="display:inline-block;background:#22C55E;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-bottom:12px">✅ Sí, quiero contratarla</a>
          <br>
          <a href="${noUrl}" style="display:inline-block;background:#E8E0D4;color:#1A0A3C;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px">No por ahora</a>
        </div>
        ${AVISO_PLATAFORMA_CLIENTE}
        <p style="color:#6B5C90;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
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

      let enviado = false
      if (cliente?.email) {
        try {
          await sendEmail({
            to: cliente.email,
            subject: `¿Pudiste hablar con ${sol.compita_nombre}?`,
            html: `
              <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
                <h2 style="color:#2D1464;font-size:22px">¿Cómo estuvo la llamada?</h2>
                <p style="color:#4A3B6B;font-size:16px;line-height:1.6">Hola${cliente.nombre ? `, <strong>${esc(cliente.nombre.split(' ')[0])}</strong>` : ''}. Tu llamada con <strong>${esc(sol.compita_nombre)}</strong> ya debería haber ocurrido.</p>
                <p style="color:#4A3B6B;font-size:15px;line-height:1.6">¿Pudiste hablar con ${esc(sol.compita_nombre)}?</p>
                <div style="margin-top:24px">
                  <a href="${url('cliente', 'si')}" style="display:inline-block;background:#22C55E;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px">✅ Sí, todo bien</a><br>
                  <a href="${url('cliente', 'no')}" style="display:inline-block;background:#E8E0D4;color:#1A0A3C;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;margin-top:12px">❌ No ocurrió — quiero reagendar</a>
                </div>
                <p style="color:#6B5C90;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
              </div>`,
          })
          enviado = true
        } catch (e) { console.error('Email confirmacion cliente:', e) }
      }
      if (compita?.telegram_chat_id) {
        try {
          const n = esc(cliente?.nombre?.split(' ')[0] ?? 'el cliente')
          await sendTelegramMessage(
            compita.telegram_chat_id,
            `🤙 <b>¿Cómo estuvo la llamada con ${n}?</b>\n\n¿Pudiste conectarte y hablar con ${n}?`,
            makeInlineKeyboard([[
              { text: '✅ Sí, ocurrió', url: url('compita', 'si') },
              { text: '❌ No se pudo', url: url('compita', 'no') },
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
      const { data: cliente } = await admin.from('usuarios').select('email').eq('id', s.cliente_id).single()
      if (!cliente?.email) { procesados++; continue }
      try {
        await sendEmail({ to: cliente.email, ...emailDecision(
          s, `¿Cómo te fue con ${s.compita_nombre}?`, `¿Qué te pareció ${esc(s.compita_nombre)}?`,
          `Esperamos que tu llamada con <strong>${esc(s.compita_nombre)}</strong> haya ido bien. ¿Te gustaría contratarla?`,
        ) })
        procesados++
      } catch (e) {
        console.error('Email seguimiento:', e)
        await liberarFlag(s.id, 'seguimiento_enviado')
      }
    } catch (e) { console.error(`[seguimiento] paso 2 fallo ${s.id}:`, e) }
  }

  // ── Paso 3: recordatorio a las 24 h ─────────────────────────────────────────
  for (const s of await getSolicitudesParaSegundoSeguimiento()) {
    try {
      if (!(await reclamarFlag(s.id, 'seguimiento2_enviado'))) continue
      const { data: cliente } = await admin.from('usuarios').select('email').eq('id', s.cliente_id).single()
      if (!cliente?.email) { procesados++; continue }
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

  await latido('seguimiento')
  return ok({ procesados })
}
