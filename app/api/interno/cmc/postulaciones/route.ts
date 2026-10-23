// /api/interno/cmc/postulaciones — entrega directa al CMC
//
// Solo para postulaciones que Airtable no aceptó tras 5 intentos (p. ej. límite de
// 1.000 registros). Permite que el CMC las procese sin borrar ni archivar nada en
// Airtable.
//
//   GET  → lista hasta 100 postulaciones pendientes, con el mismo formato de
//          registro que la API de Airtable (id con prefijo "sup").
//   POST { ids: [postulacionId, …] } → el CMC confirma que las incorporó.
//          Una postulación confirmada ya no se copia a Airtable (nunca entra dos veces).
//
// Desactivada salvo que exista CMC_ENTREGA_SECRETO. Autenticación: cabecera
// "x-cmc-secreto". Sin acceso desde el navegador (sin CORS).
import { NextRequest } from 'next/server'
import { postulacionesParaCmc, confirmarEntregaCmc, comoRegistroAirtable } from '@/lib/captacion'
import { secretoValido } from '@/lib/links'
import { ok, err, unauthorized, notFound } from '@/lib/api'

function autorizado(req: NextRequest): 'ok' | 'desactivada' | 'no' {
  const secreto = process.env.CMC_ENTREGA_SECRETO
  if (!secreto) return 'desactivada'
  return secretoValido(req.headers.get('x-cmc-secreto'), secreto) ? 'ok' : 'no'
}

export async function GET(req: NextRequest) {
  const a = autorizado(req)
  if (a === 'desactivada') return notFound('Ruta')
  if (a === 'no') return unauthorized()
  try {
    const filas = await postulacionesParaCmc(100)
    return ok({ records: filas.map(comoRegistroAirtable) })
  } catch (e) {
    console.error('[cmc/postulaciones] GET', e)
    return err('No se pudieron leer las postulaciones', 500)
  }
}

export async function POST(req: NextRequest) {
  const a = autorizado(req)
  if (a === 'desactivada') return notFound('Ruta')
  if (a === 'no') return unauthorized()
  let body: { ids?: unknown }
  try { body = await req.json() } catch { return err('Solicitud inválida') }
  if (!Array.isArray(body.ids) || body.ids.some((i) => typeof i !== 'string')) return err('ids debe ser una lista de textos')
  try {
    const confirmadas = await confirmarEntregaCmc(body.ids as string[])
    return ok({ confirmadas })
  } catch (e) {
    console.error('[cmc/postulaciones] POST', e)
    return err('No se pudo confirmar la entrega', 500)
  }
}
