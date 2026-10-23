// POST /api/cron/reintentar-airtable — Netlify Scheduled Function cada 15 min
// Reintenta copiar a Airtable las postulaciones guardadas en Supabase cuya copia falló.
// Tras 5 fallos la postulación queda "agotada": el CMC puede leerla desde
// /api/interno/cmc/postulaciones y se avisa por Telegram (máx. 1 vez al día).
import { NextRequest } from 'next/server'
import { reintentarEnviosAirtable, postulacionesParaCmc } from '@/lib/captacion'
import { airtableConfigurado } from '@/lib/airtable'
import { avisarAdmin } from '@/lib/telegram'
import { cronAutorizado, latido, reclamarUnaVez } from '@/lib/cron'
import { hoyVE } from '@/lib/format'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return err('No autorizado', 401)
  if (process.env.POSTULACIONES_DESTINO !== 'supabase_y_airtable') return ok({ desactivado: true })
  if (!airtableConfigurado()) return err('Airtable sin configurar', 500)

  try {
    const resumen = await reintentarEnviosAirtable(20)
    const agotadas = (await postulacionesParaCmc(500)).length
    if (agotadas > 0 && (await reclamarUnaVez(`alerta_airtable_agotada:${hoyVE()}`))) {
      await avisarAdmin(
        `⚠️ <b>Postulaciones sin copiar a Airtable</b>\n\n${agotadas} postulación(es) fallaron 5 veces al copiarse a Airtable ` +
        `(posible límite de 1.000 registros). Están guardadas en Supabase y el CMC puede leerlas desde la entrega directa.`,
      )
    }
    await latido('reintentar-airtable')
    return ok({ ...resumen, agotadasSinEntregar: agotadas })
  } catch (e) {
    console.error('[reintentar-airtable]', e)
    return err('Fallo al reintentar envíos', 500)
  }
}
