// /api/solicitud/confirmacion-llamada?token=&quien=cliente|compita&s=<firma>&respuesta=si|no
// GET muestra una página con botón (los escáneres de correo no pueden ejecutar la acción);
// POST registra si la llamada ocurrió. La firma `s` ata el enlace a un rol (nadie puede responder por el otro).
import { NextRequest, NextResponse } from 'next/server'
import { rolValido } from '@/lib/links'
import { registrarRespuestaLlamada } from '@/lib/confirmacion-llamada'
import { pagina, paginaPara, puertaConfirmacion } from '@/lib/confirm'

function leer(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const token = sp.get('token')
  const quien = sp.get('quien')
  const respuesta = sp.get('respuesta')
  if (!token || (respuesta !== 'si' && respuesta !== 'no') || !rolValido(token, quien, sp.get('s'))) return null
  return { token, quien: quien as 'cliente' | 'compita', respuesta: respuesta as 'si' | 'no' }
}

export async function GET(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)
  return puertaConfirmacion(
    req,
    p.respuesta === 'si' ? '¿La llamada ocurrió?' : '¿La llamada no se pudo realizar?',
    p.respuesta === 'si' ? 'Confirma que la llamada se realizó con normalidad.' : 'Confirma que la llamada no ocurrió para ayudarte a reagendar.',
    p.respuesta === 'si' ? 'Sí, ocurrió' : 'No ocurrió',
  )
}

export async function POST(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)
  const r = await registrarRespuestaLlamada(p.token, p.quien, p.respuesta)
  if (r.tipo === 'redirigir') return NextResponse.redirect(r.destino, 303)
  return paginaPara(p.quien, r.titulo, r.texto, r.status ?? 200)
}
