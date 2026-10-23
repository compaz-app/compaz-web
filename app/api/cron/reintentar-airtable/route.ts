// POST /api/cron/reintentar-airtable — Netlify Scheduled Function cada 15 min
// Retoma las copias a Airtable pendientes. Cada reintento busca primero la huella de
// la postulación en Airtable (Contacto + Fecha): si ya existe, la vincula en lugar de
// crear otra. Después avisa por Telegram de lo que quedó en la bandeja.
import { NextRequest } from 'next/server'
import { reintentarEnviosAirtable, avisarBandeja } from '@/lib/captacion'
import { airtableConfigurado } from '@/lib/airtable'
import { cronAutorizado, latido } from '@/lib/cron'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return err('No autorizado', 401)
  if (process.env.POSTULACIONES_DESTINO !== 'supabase_y_airtable') return ok({ desactivado: true })
  if (!airtableConfigurado()) return err('Airtable sin configurar', 500)

  try {
    const resumen = await reintentarEnviosAirtable()
    const porResolver = await avisarBandeja()
    await latido('reintentar-airtable')
    return ok({ ...resumen, porResolver })
  } catch (e) {
    console.error('[reintentar-airtable]', e)
    return err('Fallo al reintentar envíos', 500)
  }
}
