// Netlify Scheduled Function: Cada 30 minutos
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '*/30 * * * *' }

export default async function () {
  await llamarCron('recordatorio-visita')
}
