// Helper compartido por las Scheduled Functions: llama al endpoint del cron con timeout y registra TODO fallo.
export async function llamarCron(nombre: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL
  const secret = process.env.CRON_SECRET
  if (!base || !secret) {
    console.error(`[cron:${nombre}] falta NEXT_PUBLIC_SITE_URL/URL o CRON_SECRET; no se ejecutó`)
    return
  }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 25_000)
  try {
    const res = await fetch(`${base}/api/cron/${nombre}`, { method: 'POST', headers: { 'x-cron-secret': secret }, signal: ctrl.signal })
    if (!res.ok) console.error(`[cron:${nombre}] respondió ${res.status}: ${(await res.text()).slice(0, 300)}`)
  } catch (e) {
    console.error(`[cron:${nombre}] fetch falló:`, e)
  } finally {
    clearTimeout(t)
  }
}
