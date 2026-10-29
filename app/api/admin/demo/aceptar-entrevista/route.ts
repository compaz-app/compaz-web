// POST /api/admin/demo/aceptar-entrevista
// Acepta la solicitud pendiente del inversionista demo: fija slot=NOW(), crea sala Daily,
// guarda room_url y envía el link al cliente por email.
import { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { guardarRoomUrl } from '@/lib/solicitudes'
import { createEntrevistaRoom } from '@/lib/daily'
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { qRol } from '@/lib/links'
import { ok, err, unauthorized, notFound, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) return unauthorized()

  const { solicitud_id } = (await req.json().catch(() => ({}))) as { solicitud_id?: string }
  if (!solicitud_id) return err('Falta solicitud_id')

  const admin = createAdminSupabase()

  const { data: sol } = await admin
    .from('solicitudes')
    .select('id, cliente_id, compita_id, estado, room_url, token_respuesta, compitas(nombre)')
    .eq('id', solicitud_id)
    .single()

  if (!sol) return notFound('Solicitud no encontrada')
  if (sol.estado !== 'pendiente') return err(`La solicitud ya está en estado "${sol.estado}"`)

  const ahoraIso = new Date().toISOString()

  // Aceptar + fijar slot a ahora mismo
  const { error: eAcept } = await admin
    .from('solicitudes')
    .update({ estado: 'aceptada', slot_confirmado: ahoraIso })
    .eq('id', solicitud_id)
  if (eAcept) return serverError(eAcept)

  // Crear sala Daily
  let roomUrl = sol.room_url as string | null
  if (!roomUrl) {
    try {
      const room = await createEntrevistaRoom(sol.id, new Date(ahoraIso))
      roomUrl = room.url
      await guardarRoomUrl(sol.id, roomUrl)
    } catch (e) {
      console.error('[demo/aceptar-entrevista] Daily:', e)
      return err('No se pudo crear la sala Daily', 502)
    }
  }

  // Enviar email al cliente con link de sala
  const { data: cliente } = await admin
    .from('usuarios').select('nombre, email').eq('id', sol.cliente_id).single()

  const compitaNombre = (sol.compitas as unknown as { nombre: string } | null)?.nombre ?? 'tu compita'
  const t = sol.token_respuesta as string
  const salaClienteUrl = `${SITE_URL}/sala/${t}?${qRol(t, 'cliente')}`

  if (cliente?.email) {
    try {
      await sendEmail({
        to: cliente.email,
        subject: `⏰ Tu llamada con ${compitaNombre} — link de acceso`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#2D1464;font-size:22px">Tu link de llamada está listo</h2>
            <p style="color:#4A3B6B;font-size:16px;line-height:1.6">
              Tu llamada con <strong>${esc(compitaNombre)}</strong> comienza ahora.
            </p>
            <p style="color:#C84B0E;background:#FFF3E8;border:2px solid #FF6B2B;border-radius:12px;padding:14px;font-size:14px">
              ⏱️ La llamada tiene un límite de 20 minutos. La sala se cierra automáticamente a los 23 min.
            </p>
            <a href="${salaClienteUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;margin-top:8px">
              Entrar a la llamada →
            </a>
            <p style="color:#6B5C90;font-size:13px;margin-top:24px">
              Compaz — <em>Cerca aunque estés lejos</em>
            </p>
          </div>
        `,
      })
    } catch (e) {
      console.error('[demo/aceptar-entrevista] email cliente:', e)
    }
  }

  const salaAdminUrl = `${SITE_URL}/sala/${t}?${qRol(t, 'compita')}`
  return ok({ room_url: roomUrl, sala_admin_url: salaAdminUrl })
}
