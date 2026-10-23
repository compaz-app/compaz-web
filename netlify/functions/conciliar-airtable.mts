// Netlify Scheduled Function: cada hora, en el minuto 20
// Importa a Supabase lo que solo quedó en Airtable (ruta de respaldo o confirmaciones perdidas).
// Si POSTULACIONES_DESTINO no es "supabase_y_airtable", el endpoint responde sin hacer nada.
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '20 * * * *' }

export default async function () {
  await llamarCron('conciliar-airtable')
}
