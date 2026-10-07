import type { Config } from '@netlify/functions'

// Corre todos los lunes a las 10 AM UTC (6 AM Venezuela)
export const config: Config = { schedule: '0 10 * * 1' }

export default async function () {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/cron/churn-alerta`
  const secret = process.env.CRON_SECRET
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'x-cron-secret': secret ?? '' } })
    if (!res.ok) console.error('churn-alerta cron error:', await res.text())
  } catch (e) {
    console.error('churn-alerta cron fetch error:', e)
  }
}
