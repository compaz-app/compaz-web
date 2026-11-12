// POST /api/admin/enviar-link-llamada { solicitud_id }
// Fuerza el envío del enlace de la llamada a la familia y al compita (y adelanta la hora a ahora para que la sala abra ya). Solo con el permiso de
// atender. Máximo una vez cada 5 minutos por solicitud: cada envío manda dos correos y un Telegram.
import { NextRequest } from 'next/server'
import { requierePermiso } from '@/lib/permisos'
import { enviarEnlaceDeLlamada } from '@/lib/enlace-llamada'
import { reclamarVentana } from '@/lib/cron'
import { explicarEspera } from '@/lib/esperas'
import { ok, err, errEspera } from '@/lib/api'

export const VENTANA_ENLACE_LLAMADA_MS = 5 * 60_000

export async function POST(req: NextRequest) {
  const g = await requierePermiso('atender'); if (!g.ok) return g.res
  const { solicitud_id } = (await req.json().catch(() => ({}))) as { solicitud_id?: unknown }
  if (typeof solicitud_id !== 'string' || !solicitud_id) return err('Falta solicitud_id')

  const v = await reclamarVentana(`enlace_llamada:${solicitud_id}`, VENTANA_ENLACE_LLAMADA_MS)
  if (!v.ok) return errEspera(explicarEspera('enlace_llamada_equipo', { desde: v.desde, duracionMs: VENTANA_ENLACE_LLAMADA_MS }))

  const r = await enviarEnlaceDeLlamada(solicitud_id)
  if (!r.ok) return err(r.error, r.status)
  return ok({ room_url: r.roomUrl, resultados: r.resultados })
}
