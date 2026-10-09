// Netlify Scheduled Function: Cada 5 minutos
import type { Config } from '@netlify/functions'
import { llamarCron } from '../lib/cron'

export const config: Config = { schedule: '*/5 * * * *' }

export default async function () {
  await llamarCron('recordatorios')
}
