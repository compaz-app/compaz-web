// POST /api/portal/llamada { solicitudId } — el cliente dice desde su portal que la llamada SÍ ocurrió («¿Pudiste hablar?»). Es la misma respuesta que da el correo:
// se registra igual y la pregunta se cierra en todos los canales (el correo no la repite, el portal pasa a «¿contratas?»).
import { NextRequest } from 'next/server'
import { getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { registrarRespuestaLlamada } from '@/lib/confirmacion-llamada'
import { ok, err, unauthorized, notFound } from '@/lib/api'

export async function POST(req: NextRequest) {
  const cli = await getClienteActivo()
  if (!cli) return unauthorized()
  const b = (await req.json().catch(() => ({}))) as { solicitudId?: string }
  if (!b.solicitudId) return err('Falta la solicitud', 400)
  const { data: s } = await createAdminSupabase().from('solicitudes').select('token_respuesta').eq('id', b.solicitudId).eq('cliente_id', cli.id).maybeSingle()
  if (!s?.token_respuesta) return notFound()
  const r = await registrarRespuestaLlamada(String(s.token_respuesta), 'cliente', 'si')
  if (r.tipo === 'pagina' && (r.status ?? 200) >= 400) return err(r.texto, r.status ?? 400)
  return ok({ resumen: 'Listo, gracias. Ahora puedes decidir si la contratas.' })
}
