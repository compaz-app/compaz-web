// Netlify Scheduled Function: Diario 14:00 UTC (10 AM Venezuela)
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '0 14 * * *' }

export default async function () {
  await llamarCron('recordatorio-primera-visita')
}
