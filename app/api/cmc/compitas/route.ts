// POST /api/cmc/compitas — foto de Compitas habilitadas enviada por el Apps Script del CMC
//
// Unidireccional CMC → web. La lógica está en lib/cmc-compitas.ts; esta ruta solo
// autentica, elige el modo y responde.
//
// Seguridad (falla cerrado):
//   · Authorization: Bearer <CMC_ESCRITURA_TOKEN>, distinto del token de lectura
//     (CMC_LECTURA_TOKEN) y comparado en tiempo constante.
//   · Sin CMC_ESCRITURA_TOKEN en el entorno → 503: no se procesa nada. Quitarlo es el
//     interruptor de corte del lado web.
//   · Modo: se APLICA solo si CMC_COMPITAS_MODO=aplicar y la petición no trae ?dryRun=1.
//     En cualquier otro caso se SIMULA (solo lecturas, sin correos, avisos ni registro).
//   · Cuerpo de 1 MB como máximo. Respuesta sin caché.
import { NextRequest } from 'next/server'
import { secretoValido } from '@/lib/links'
import { validarFoto, simularFotoCmc, aplicarFotoCmc } from '@/lib/cmc-compitas'
import { latido } from '@/lib/cron'
import { ok, err, unauthorized, serverError } from '@/lib/api'

const MAX_BYTES = 1_000_000

export async function POST(req: NextRequest) {
  const esperado = process.env.CMC_ESCRITURA_TOKEN
  if (!esperado) return sinCache(err('Sincronización del CMC no configurada', 503))

  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!secretoValido(token, esperado)) return sinCache(unauthorized())

  const texto = await req.text().catch(() => '')
  if (texto.length > MAX_BYTES) return sinCache(err('Foto demasiado grande', 413))
  let body: unknown
  try { body = JSON.parse(texto) } catch { return sinCache(err('JSON no válido')) }
  const v = validarFoto(body)
  if (!v.ok) return sinCache(err(v.error))

  const simular = req.nextUrl.searchParams.get('dryRun') === '1' || process.env.CMC_COMPITAS_MODO !== 'aplicar'
  try {
    if (simular) return sinCache(ok(await simularFotoCmc(v.foto)))
    const r = await aplicarFotoCmc(v.foto)
    await latido('cmc-compitas')
    // Una foto rechazada es una respuesta válida (el CMC la registra); 409 para que el script la marque.
    return sinCache(r.rechazo ? err(`Foto rechazada: ${r.rechazo}`, 409) : ok(r))
  } catch (e) {
    console.error('[cmc/compitas]', e)
    return sinCache(serverError(e))
  }
}

export function GET() { return sinCache(err('Método no permitido', 405)) }

function sinCache<T extends Response>(res: T): T {
  res.headers.set('Cache-Control', 'no-store')
  return res
}
