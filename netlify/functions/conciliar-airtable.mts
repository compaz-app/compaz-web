// Netlify Scheduled Function: cada hora, en el minuto 20
// Importa a Supabase lo que solo quedó en Airtable (ruta de respaldo o confirmaciones perdidas).
// Sin CAPTACION_DESDE, o con POSTULACIONES_DESTINO=solo_supabase, el endpoint no llama a Airtable (solo registra el latido en solo_supabase).
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '20 * * * *' }

export default async function () {
  await llamarCron('conciliar-airtable')
}
