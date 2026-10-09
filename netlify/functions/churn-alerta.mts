// Netlify Scheduled Function: Lunes 10:00 UTC (6 AM Venezuela)
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '0 10 * * 1' }

export default async function () {
  await llamarCron('churn-alerta')
}
