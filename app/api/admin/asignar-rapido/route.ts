// /api/admin/asignar-rapido?token=...   (enlace de un solo uso enviado al admin por email/Telegram)
// GET solo muestra una confirmación (los previsualizadores de enlaces de Telegram/correo no consumen el token);
// POST asigna la compita al cliente.
import { NextRequest, NextResponse } from 'next/server'
import { asignarPorEnlace } from '@/lib/acciones-equipo'
import { pagina, puertaConfirmacion } from '@/lib/confirm'
import { urlPublica } from '@/lib/site'

export async function GET(req: NextRequest) {
  if (!req.nextUrl.searchParams.get('token')) return pagina('No autorizado', 'Falta el token.', 401)
  return puertaConfirmacion(req, 'Asignar compita', 'Se asignará esta compita al cliente y se les avisará a ambos.', 'Asignar ahora')
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return pagina('No autorizado', 'Falta el token.', 401)
  const r = await asignarPorEnlace(token)
  if (!r.ok) return pagina(r.titulo, r.texto, r.status)
  return NextResponse.redirect(urlPublica('/panel?sec=personas', req), 303)
}
