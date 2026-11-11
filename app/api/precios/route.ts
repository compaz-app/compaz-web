import { preciosVigentes } from '@/lib/precios'
import { ok, serverError } from '@/lib/api'

// GET /api/precios — los precios que rigen hoy, para mostrarlos en pantalla (son públicos: ya salen en la página web). Solo informa: al cobrar,
// el servidor vuelve a calcular el importe por su cuenta y no confía en lo que el navegador haya visto.
export async function GET() {
  try { return ok(await preciosVigentes()) } catch { return serverError() }
}
