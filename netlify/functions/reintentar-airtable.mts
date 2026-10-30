// Netlify Scheduled Function: cada 15 minutos
// Reintenta la copia a Airtable de postulaciones ya guardadas en Supabase.
// Si POSTULACIONES_DESTINO no es "supabase_y_airtable", el endpoint responde sin hacer nada.
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '*/15 * * * *' }

export default async function () {
  await llamarCron('reintentar-airtable')
}
