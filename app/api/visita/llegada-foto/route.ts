// GET /api/visita/llegada-foto — la foto de llegada del compita, SOLO para el cliente de esa visita (o el administrador).
// Se sirve desde Compaz sin guardarla en caché; el borrado a los N días la hace desaparecer de verdad.
import { NextResponse } from 'next/server'
import { getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { descargarFotoPrivada } from '@/lib/fotos-privadas'

const no = (status: number) => new NextResponse('No disponible', { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET() {
  const user = await getClienteActivo()
  if (!user) return no(401)
  const { data } = await createAdminSupabase().from('visitas').select('llegada_foto_id')
    .eq('usuario_id', user.id).in('estado', ['programada', 'confirmando_inicio', 'en_curso']).not('llegada_foto_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const id = (data as { llegada_foto_id: string } | null)?.llegada_foto_id
  const foto = id ? await descargarFotoPrivada(id) : null
  if (!foto) return no(404)
  return new NextResponse(foto.bytes, { headers: { 'Content-Type': foto.contentType, 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' } })
}
