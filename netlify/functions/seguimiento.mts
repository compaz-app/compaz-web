// Netlify Scheduled Function — corre cada 5 minutos
// Llama al endpoint de seguimiento post-llamada de Next.js
import type { Config } from '@netlify/functions'

export const config: Config = {
  schedule: '*/5 * * * *',
}

export default async function () {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/cron/seguimiento`
  const secret = process.env.CRON_SECRET

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-cron-secret': secret ?? '' },
    })
    if (!res.ok) {
      console.error('Seguimiento cron error:', await res.text())
    }
  } catch (e) {
    console.error('Seguimiento cron fetch error:', e)
  }
}
