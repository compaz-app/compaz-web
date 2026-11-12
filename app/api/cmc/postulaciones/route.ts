// GET /api/cmc/postulaciones — lectura para el Apps Script del CMC (solo lectura)
//
// Devuelve las postulaciones desde CAPTACION_DESDE con el formato de la API de
// Airtable, dentro del sobre estándar: { ok: true, data: { records, offset } }.
// Paginación: ?offset=<cursor de la respuesta anterior>.
//
// Seguridad (falla cerrado):
//   · Authorization: Bearer <CMC_LECTURA_TOKEN>, comparado en tiempo constante.
//   · Sin CMC_LECTURA_TOKEN o sin CAPTACION_DESDE en el entorno → 503: no se sirve nada.
//     Quitar CMC_LECTURA_TOKEN es el interruptor de corte del lado web.
//   · Respuesta sin caché: contiene datos personales.
import { NextRequest } from 'next/server'
import { secretoValido } from '@/lib/links'
import { paginaPostulacionesCmc } from '@/lib/cmc'
import { ok, err, unauthorized } from '@/lib/api'

export async function GET(req: NextRequest) {
  const esperado = process.env.CMC_LECTURA_TOKEN
  const desde = process.env.CAPTACION_DESDE
  if (!esperado || !desde || Number.isNaN(Date.parse(desde))) return sinCache(err('Lectura del CMC no configurada', 503))

  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!secretoValido(token, esperado)) return sinCache(unauthorized())

  const offset = req.nextUrl.searchParams.get('offset') ?? ''
  if (offset.length > 200) return sinCache(err('offset no válido', 400))

  try {
    return sinCache(ok(await paginaPostulacionesCmc(desde, offset)))
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'offset no válido') return sinCache(err(msg, 400))
    console.error('[cmc/postulaciones]', e)
    return sinCache(err('No se pudieron leer las postulaciones', 500))
  }
}

function sinCache<T extends Response>(res: T): T {
  res.headers.set('Cache-Control', 'no-store')
  return res
}
