import { preciosVigentes } from '@/lib/precios'
import { ok, serverError } from '@/lib/api'

// GET /api/precios — los precios que rigen hoy, para mostrarlos en pantalla (son públicos: ya salen en la página web). Solo informa: al cobrar,
// el servidor vuelve a calcular el importe por su cuenta y no confía en lo que el navegador haya visto.
export async function GET() {
  try {
    const r = ok(await preciosVigentes())
    r.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60') // cambian pocas veces: no hace falta pedirlos en cada visita
    return r
  } catch { return serverError() }
}
