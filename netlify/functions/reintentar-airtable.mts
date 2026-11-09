// Netlify Scheduled Function: cada 15 minutos
// Reintenta la copia a Airtable de postulaciones ya guardadas en Supabase.
// Sin CAPTACION_DESDE, o con POSTULACIONES_DESTINO=solo_supabase, el endpoint no llama a Airtable (solo registra el latido en solo_supabase).
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '*/15 * * * *' }

export default async function () {
  await llamarCron('reintentar-airtable')
}
