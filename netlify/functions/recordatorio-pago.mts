// Netlify Scheduled Function: Diario 15:00 UTC (11 AM Venezuela)
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '0 15 * * *' }

export default async function () {
  await llamarCron('recordatorio-pago')
}
