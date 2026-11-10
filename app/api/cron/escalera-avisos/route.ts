// POST /api/cron/escalera-avisos — Netlify Scheduled Function cada 5 min.
// Despacha avisos atascados, reintenta los fallidos pasajeros y escala los que no tuvieron acción
// (respaldo por correo y luego tarea para el equipo). Ver lib/escalera.ts.
import { NextRequest } from 'next/server'
import { procesarEscalera } from '@/lib/escalera'
import { escalarPagosInsistidos } from '@/lib/confirmar-pago'
import { liberarVencidas } from '@/lib/agenda'
import { escalarCambiosLugar } from '@/lib/lugar'
import { entregarDirecciones } from '@/lib/direccion'
import { procesarNadieAbre } from '@/lib/llegada'
import { preguntarTodoBien, escalarTodoBien } from '@/lib/seguridad'
import { escalarLlamadasVencidas } from '@/lib/bloqueos-compita'
import { cronAutorizado, latido } from '@/lib/cron'
import { ok, err } from '@/lib/api'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return err('No autorizado', 401)
  const resultado = await procesarEscalera()
  const reservasVencidas = (await liberarVencidas().catch((e) => { console.error('[escalera] reservas vencidas:', e); return [] })).length
  const cambiosLugarEscalados = await escalarCambiosLugar().catch((e) => { console.error('[escalera] cambios de lugar:', e); return 0 })
  const direcciones = await entregarDirecciones().catch((e) => { console.error('[escalera] direcciones:', e); return { enviadas: 0, sinDireccion: 0 } })
  const nadieAbre = await procesarNadieAbre().catch((e) => { console.error('[escalera] nadie abre:', e); return { tareas: 0, cierres: 0 } })
  const todoBien = await (async () => ({ preguntas: await preguntarTodoBien(), alertas: await escalarTodoBien() }))().catch((e) => { console.error('[escalera] todo bien:', e); return { preguntas: 0, alertas: 0 } })
  const pagosEscalados = await escalarPagosInsistidos().catch((e) => { console.error('[escalera] pagos insistidos:', e); return 0 })
  const llamadasVencidas = await escalarLlamadasVencidas().catch((e) => { console.error('[escalera] llamadas vencidas:', e); return 0 })
  await latido('escalera-avisos')
  return ok({ ...resultado, pagosEscalados, reservasVencidas, cambiosLugarEscalados, direcciones, nadieAbre, todoBien, llamadasVencidas })
}
