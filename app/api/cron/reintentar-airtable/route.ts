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
  // Los crons dependen de CAPTACION_DESDE, no de POSTULACIONES_DESTINO: al revertir
  // (quitar solo POSTULACIONES_DESTINO) siguen vaciando pendientes y conciliando.
  const desde = process.env.CAPTACION_DESDE
  if (!desde) return ok({ desactivado: true })
  if (!airtableConfigurado() || Number.isNaN(Date.parse(desde))) return err('Falta AIRTABLE_* o CAPTACION_DESDE (fecha ISO)', 500)

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
