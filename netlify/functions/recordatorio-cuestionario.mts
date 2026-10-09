// Netlify Scheduled Function: Cada 10 minutos
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '*/10 * * * *' }

export default async function () {
  await llamarCron('recordatorio-cuestionario')
}
