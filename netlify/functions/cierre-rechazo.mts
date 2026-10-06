// Netlify Scheduled Function — corre cada 30 minutos
import type { Config } from '@netlify/functions'

export const config: Config = {
  schedule: '*/30 * * * *',
}

export default async function () {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/cron/cierre-rechazo`
  const secret = process.env.CRON_SECRET

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-cron-secret': secret ?? '' },
    })
    if (!res.ok) {
      console.error('Cierre rechazo cron error:', await res.text())
    }
  } catch (e) {
    console.error('Cierre rechazo cron fetch error:', e)
  }
}
