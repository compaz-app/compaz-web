// /api/solicitud/motivo?token=&quien=cliente|compita&s=<firma>
// Pantalla opcional, de un toque, para contar por qué se dijo que no. GET muestra los botones; cada botón
// hace POST (así un escáner de enlaces no registra nada). El enlace va firmado por rol, igual que los demás.
import { NextRequest } from 'next/server'
import { getSolicitudPorToken } from '@/lib/solicitudes'
import { registrarMotivo, MOTIVOS, type RolMotivo } from '@/lib/motivos'
import { rolValido } from '@/lib/links'
import { SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'
import { pagina, paginaHtml } from '@/lib/confirm'

function leer(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const token = sp.get('token')
  const quien = sp.get('quien')
  if (!token || (quien !== 'cliente' && quien !== 'compita')) return null
  if (!rolValido(token, quien, sp.get('s'))) return null
  return { token, rol: quien as RolMotivo }
}

const BOTON = 'display:block;width:100%;box-sizing:border-box;margin:10px 0 0;padding:14px 20px;border-radius:9999px;border:2px solid #E8E0D4;background:white;color:#1A0A3C;font-weight:700;font-size:15px;cursor:pointer'

async function cargar(token: string, rol: RolMotivo) {
  const solicitud = await getSolicitudPorToken(token)
  if (!solicitud || solicitud.estado !== 'rechazada') return null
  return { solicitud, actorId: rol === 'cliente' ? solicitud.cliente_id : solicitud.compita_id }
}

function gracias(rol: RolMotivo) {
  return rol === 'cliente'
    ? pagina('Gracias por contarnos', 'Esto nos ayuda a mejorar. Puedes explorar otros compitas cuando quieras.', 200, { texto: 'Ver otros compitas →', href: `${SITE_URL}/compitas` })
    : pagina('Gracias por contarnos', 'Lo anotamos. Esto nos ayuda a enviarte solicitudes que sí te encajen.', 200, { texto: 'Listo', href: SITE_URL })
}

export async function GET(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido o está incompleto.', 400)
  const datos = await cargar(p.token, p.rol)
  if (!datos) return pagina('Enlace no disponible', 'No encontramos nada pendiente para este enlace.', 404)

  const action = req.nextUrl.pathname + req.nextUrl.search
  const botones = MOTIVOS[p.rol].map((m) =>
    `<form method="POST" action="${esc(action)}"><input type="hidden" name="motivo" value="${esc(m.id)}"><button type="submit" style="${BOTON}">${esc(m.texto)}</button></form>`,
  ).join('')
  const omitir = p.rol === 'cliente'
    ? `<p style="margin-top:20px"><a href="${esc(SITE_URL)}/compitas" style="color:#6B5C90;font-size:14px">Omitir y ver otros compitas</a></p>`
    : ''
  return paginaHtml(
    '¿Nos cuentas por qué?',
    `<p>Es opcional y de un solo toque. Nos ayuda a mejorar.</p>${botones}${omitir}`,
  )
}

export async function POST(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido o está incompleto.', 400)
  const datos = await cargar(p.token, p.rol)
  if (!datos) return pagina('Enlace no disponible', 'No encontramos nada pendiente para este enlace.', 404)

  const form = await req.formData().catch(() => null)
  const motivo = typeof form?.get('motivo') === 'string' ? String(form?.get('motivo')) : ''
  const r = await registrarMotivo({ solicitudId: datos.solicitud.id, rol: p.rol, actorId: datos.actorId, motivo })
  if (r === 'invalido') return pagina('No pudimos anotarlo', 'Elige una de las opciones.', 400)
  return gracias(p.rol) // también si ya estaba registrado: un segundo toque no suma otro motivo
}
