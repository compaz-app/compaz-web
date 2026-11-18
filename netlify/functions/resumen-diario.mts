// Netlify Scheduled Function: una vez al día, 23:00 UTC (7 pm de Caracas)
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '0 23 * * *' }

export default async function () {
  await llamarCron('resumen-diario')
}
