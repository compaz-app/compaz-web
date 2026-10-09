// Netlify Scheduled Function: Diario 07:00 UTC (3 AM Venezuela)
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '0 7 * * *' }

export default async function () {
  await llamarCron('limpieza')
}
