// Netlify Scheduled Function — corre una vez al día a las 3am Venezuela (7am UTC)
import type { Config } from '@netlify/functions'

export const config: Config = {
  schedule: '0 7 * * *',
}

export default async function () {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/cron/limpieza`
  const secret = process.env.CRON_SECRET

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-cron-secret': secret ?? '' },
    })
    if (!res.ok) {
      console.error('Limpieza cron error:', await res.text())
    }
  } catch (e) {
    console.error('Limpieza cron fetch error:', e)
  }
}
