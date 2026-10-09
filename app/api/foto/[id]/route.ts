// GET /api/foto/[id] — sirve una foto de visita guardada en Telegram como "tg:<file_id>".
// Acceso: dueño de la visita (sesión), admin, o enlace firmado con expiración (emails).
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/auth'
import { descargarFotoTelegram } from '@/lib/telegram'
import { fotoFirmaValida } from '@/lib/links'

const UUID = /^[0-9a-f-]{36}$/i

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID.test(id)) return new NextResponse('No encontrada', { status: 404 })

  const admin = createAdminSupabase()
  const { data: msg } = await admin
    .from('mensajes')
    .select('id, tipo, contenido, visita:visitas(usuario_id)')
    .eq('id', id)
    .maybeSingle() as { data: { id: string; tipo: string; contenido: string | null; visita: { usuario_id: string } | null } | null }

  if (!msg || msg.tipo !== 'foto' || !msg.contenido?.startsWith('tg:')) {
    return new NextResponse('No encontrada', { status: 404 })
  }

  const sp = req.nextUrl.searchParams
  let autorizado = fotoFirmaValida(id, sp.get('e'), sp.get('s'))
  if (!autorizado) {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    autorizado = !!user && (isAdminEmail(user.email ?? '') || msg.visita?.usuario_id === user.id)
  }
  if (!autorizado) return new NextResponse('No autorizado', { status: 401 })

  try {
    const { buffer, contentType } = await descargarFotoTelegram(msg.contenido.slice(3))
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    console.error('[foto] error:', e)
    return new NextResponse('Foto no disponible', { status: 502 })
  }
}
