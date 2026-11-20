// /api/solicitud/reagendar-compita?token=&quien=compita&s=<firma>
// La compita inicia un reagendado desde Telegram. GET confirma; POST ejecuta.
import { NextRequest } from 'next/server'
import { iniciarReagendadoPorCompita, getSolicitudPorToken } from '@/lib/solicitudes'
import { esEntrevistaConHoras, reagendarEntrevista } from '@/lib/reagendar'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage, avisarAdmin } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { registrarNovedad } from '@/lib/novedades'
import { sendEmail } from '@/lib/email'
import { esc } from '@/lib/html'
import { rolValido } from '@/lib/links'
import { pagina as paginaSola, paginaPara, puertaConfirmacion } from '@/lib/confirm'
// Esta ruta la ve siempre el compita: sus páginas de éxito vuelven a donde él trabaja (ver botonDe).
const pagina = (titulo: string, texto: string, status = 200, boton?: { texto: string; href: string }) => (boton ? paginaSola(titulo, texto, status, boton) : paginaPara('compita', titulo, texto, status))

function leer(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const token = sp.get('token')
  if (!token || sp.get('quien') !== 'compita' || !rolValido(token, 'compita', sp.get('s'))) return null
  return { token }
}

export async function GET(req: NextRequest) {
  if (!leer(req)) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)
  return puertaConfirmacion(req, '¿Necesitas reagendar la llamada?', 'Le avisaremos al cliente y podrás sugerir nuevos horarios por Telegram.', 'Sí, reagendar')
}

export async function POST(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido.', 400)

  // Entrevista agendada con horas libres: el cliente elige otra hora libre (sin proponer horarios a mano).
  const actual = await getSolicitudPorToken(p.token)
  if (actual && await esEntrevistaConHoras(actual.id)) {
    const r = await reagendarEntrevista(actual.id, 'compita')
    return r.ok ? pagina('Reagendado', 'Listo. Le avisamos al cliente para que elija otra de tus horas libres. Si necesitas ofrecer otras, escribe /horas en Telegram. Te avisamos cuando elija.') : pagina('Enlace inválido', 'Este enlace ya no es válido o la solicitud está cerrada.', 410)
  }

  // Ya no hay camino de «escribe tus horarios»: todo pasa por las horas libres del perfil (el cliente elige y el compita las cambia en /horas).
  return pagina('Enlace inválido', 'Este enlace ya no es válido o la solicitud está cerrada.', 410)
}
