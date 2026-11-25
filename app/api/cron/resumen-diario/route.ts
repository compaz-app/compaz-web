import { NextRequest, NextResponse } from 'next/server'
import { cronAutorizado, latido } from '@/lib/cron'
import { enviarResumenesDiarios } from '@/lib/resumen-diario'

// POST /api/cron/resumen-diario
// Corre una vez al día (7 pm de Caracas). Manda UN correo a los clientes con novedades sin ver que no tuvieron correo propio.
export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await enviarResumenesDiarios()
  await latido('resumen-diario')
  return NextResponse.json({ ok: true, ...r })
}
