// Netlify Scheduled Function: Cada 15 minutos
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '*/15 * * * *' }

export default async function () {
  await llamarCron('noshow-alerta')
}
