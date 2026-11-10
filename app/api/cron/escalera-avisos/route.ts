// POST /api/cron/escalera-avisos — Netlify Scheduled Function cada 5 min.
// Despacha avisos atascados, reintenta los fallidos pasajeros y escala los que no tuvieron acción
// (respaldo por correo y luego tarea para el equipo). Ver lib/escalera.ts.
import { NextRequest } from 'next/server'
import { procesarEscalera } from '@/lib/escalera'
import { escalarPagosInsistidos } from '@/lib/confirmar-pago'
import { cronAutorizado, latido } from '@/lib/cron'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return err('No autorizado', 401)
  const resultado = await procesarEscalera()
  const pagosEscalados = await escalarPagosInsistidos().catch((e) => { console.error('[escalera] pagos insistidos:', e); return 0 })
  await latido('escalera-avisos')
  return ok({ ...resultado, pagosEscalados })
}
