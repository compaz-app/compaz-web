// POST /api/vitals — el navegador manda cuánto tardó en cargar y responder la pantalla (Core Web Vitals). Pública a propósito (la usan también los visitantes de la
// página sin cuenta), por eso es estricta: máximo 4 KB, solo las 5 métricas conocidas, números sanos, la ruta reducida a su primer tramo, un tope por conexión y
// NUNCA responde con error ni explica nada (es una señal de fondo; no hay a quién mostrarle un mensaje). No guarda IP ni usuario. Ver lib/velocidad-real.ts.
import { NextRequest, NextResponse } from 'next/server'
import { validarMediciones } from '@/lib/velocidad-real'
import { guardarMediciones } from '@/lib/velocidad-real-servidor'
import { sumarIntento } from '@/lib/limite'

const MAX_BYTES = 4096
/** Una persona navegando manda una señal por pantalla; 120 por hora deja margen de sobra y frena a quien quiera llenar la tabla. */
const TOPE_POR_HORA = 120
const vacia = () => new NextResponse(null, { status: 204 })

export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get('content-length') ?? '0') > MAX_BYTES) return vacia()
    const texto = await req.text()
    if (texto.length > MAX_BYTES) return vacia()
    const mediciones = validarMediciones(JSON.parse(texto))
    if (mediciones.length === 0) return vacia()
    const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'desconocida'
    // El conteo falla abierto: si no se puede contar, se guarda igual (medir no debe romperse por esto).
    const n = await sumarIntento(`vitals:${ip}`, 60).catch(() => 0)
    if (n > TOPE_POR_HORA) return vacia()
    await guardarMediciones(mediciones)
  } catch { /* una señal mal formada se ignora */ }
  return vacia()
}
