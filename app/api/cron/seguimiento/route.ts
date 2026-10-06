// POST /api/cron/seguimiento — enviado por Netlify Scheduled Function cada 5 min
// Busca llamadas terminadas (slot + 23 min) y envía email de seguimiento al cliente
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getSolicitudesParaSeguimiento, marcarSeguimientoEnviado, getSolicitudesParaSegundoSeguimiento, marcarSeguimiento2Enviado } from '@/lib/solicitudes'
import { Resend } from 'resend'
import { ok, err } from '@/lib/api'

const resend = new Resend(process.env.RESEND_API_KEY)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

const AVISO_PLATAFORMA_CLIENTE = `
  <div style="background:#FFF3E8;border:2px solid #FF6B2B;border-radius:12px;padding:14px 18px;margin-top:24px">
    <p style="color:#C84B0E;font-size:13px;line-height:1.6;margin:0">
      <strong>Importante:</strong> Para que Compaz pueda garantizarte el servicio, mantén toda la comunicación con tu compita dentro de la plataforma. Si coordinan por fuera, Compaz no podrá responder por lo que suceda ni ofrecer ningún tipo de cobertura o garantía. Estamos aquí para protegerte a ti y a tu familiar.
    </p>
  </div>`

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) return err('No autorizado', 401)

  const solicitudes = await getSolicitudesParaSeguimiento()
  const admin = createAdminSupabase()

  for (const solicitud of solicitudes) {
    const { data: cliente } = await admin
      .from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()

    let emailEnviado = false
    if (cliente?.email) {
      const token = solicitud.token_respuesta
      const siUrl = `${SITE_URL}/api/solicitud/seguimiento?token=${token}&respuesta=si`
      const noUrl = `${SITE_URL}/api/solicitud/seguimiento?token=${token}&respuesta=no`

      try {
        await resend.emails.send({
          from: 'Compaz <visitas@micompaz.com>',
          to: cliente.email,
          subject: `¿Cómo te fue con ${solicitud.compita_nombre}?`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">¿Qué te pareció ${solicitud.compita_nombre}?</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                Esperamos que tu llamada con <strong>${solicitud.compita_nombre}</strong> haya ido bien. ¿Te gustaría contratarla?
              </p>
              <div style="margin-top:24px">
                <a href="${siUrl}" style="display:inline-block;background:#22C55E;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-bottom:12px">
                  ✅ Sí, quiero contratarla
                </a>
                <br>
                <a href="${noUrl}" style="display:inline-block;background:#E8E0D4;color:#1A0A3C;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px">
                  No por ahora
                </a>
              </div>
              ${AVISO_PLATAFORMA_CLIENTE}
              <p style="color:#6B5C90;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
        emailEnviado = true
      } catch (e) { console.error('Email seguimiento:', e) }
    }

    if (emailEnviado) await marcarSeguimientoEnviado(solicitud.id)
  }

  // ── Segundo seguimiento (24h después, sin respuesta) ─────────────────────
  const solicitudes2 = await getSolicitudesParaSegundoSeguimiento()

  for (const solicitud of solicitudes2) {
    const { data: cliente } = await admin
      .from('usuarios').select('nombre, email').eq('id', solicitud.cliente_id).single()

    let email2Enviado = false
    if (cliente?.email) {
      const token = solicitud.token_respuesta
      const siUrl = `${SITE_URL}/api/solicitud/seguimiento?token=${token}&respuesta=si`
      const noUrl = `${SITE_URL}/api/solicitud/seguimiento?token=${token}&respuesta=no`

      try {
        await resend.emails.send({
          from: 'Compaz <visitas@micompaz.com>',
          to: cliente.email,
          subject: `Recordatorio: ¿qué decidiste sobre ${solicitud.compita_nombre}?`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#2D1464;font-size:22px">¿Tomaste una decisión?</h2>
              <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
                Hace un día te preguntamos si querías contratar a <strong>${solicitud.compita_nombre}</strong>. Si aún no has decidido, no hay problema — puedes hacerlo ahora.
              </p>
              <div style="margin-top:24px">
                <a href="${siUrl}" style="display:inline-block;background:#22C55E;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-bottom:12px">
                  ✅ Sí, quiero contratarla
                </a>
                <br>
                <a href="${noUrl}" style="display:inline-block;background:#E8E0D4;color:#1A0A3C;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px">
                  No por ahora
                </a>
              </div>
              ${AVISO_PLATAFORMA_CLIENTE}
              <p style="color:#6B5C90;font-size:13px;margin-top:32px">Compaz — <em>Cerca aunque estés lejos</em></p>
            </div>
          `,
        })
        email2Enviado = true
      } catch (e) { console.error('Email segundo seguimiento:', e) }
    }

    if (email2Enviado) await marcarSeguimiento2Enviado(solicitud.id)
  }

  return ok({ procesados: solicitudes.length + solicitudes2.length })
}
