import type { Config } from '@netlify/functions'

export const config: Config = { schedule: '*/10 * * * *' }

export default async function () {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/cron/recordatorio-cuestionario`
  const secret = process.env.CRON_SECRET
  await fetch(url, { method: 'POST', headers: { 'x-cron-secret': secret ?? '' } })
}
