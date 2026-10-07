// Netlify Scheduled Function — corre diariamente a las 10:00 AM UTC
import type { Config } from '@netlify/functions'

export const config: Config = {
  schedule: '0 14 * * *',
}

export default async function () {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/cron/recordatorio-primera-visita`
  const secret = process.env.CRON_SECRET

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-cron-secret': secret ?? '' },
    })
    if (!res.ok) {
      console.error('Recordatorio primera visita cron error:', await res.text())
    }
  } catch (e) {
    console.error('Recordatorio primera visita cron fetch error:', e)
  }
}
