// GET /api/solicitud-foto/<token> — el compita ve la foto del cliente SOLO mientras decide la solicitud.
// El token es el mismo de los botones del aviso. La foto se sirve desde nuestro servidor (sin enlaces firmados que se
// puedan guardar y sin pasar por Telegram, que no permite borrar lo que ya entregó): así el borrado es real.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { fotoClienteVigente, descargarFotoPrivada } from '@/lib/fotos-privadas'

const UUID = /^[0-9a-f-]{36}$/i
const no = (status: number) => new NextResponse('No disponible', { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!UUID.test(token)) return no(404)

  const { data } = await createAdminSupabase().from('solicitudes')
    .select('estado, cliente_id, foto_cliente_id').eq('token_respuesta', token).maybeSingle()
  const s = data as { estado: string; cliente_id: string; foto_cliente_id: string | null } | null
  // Solo con la solicitud pendiente (el compita está decidiendo) y solo si el cliente eligió mostrar su foto.
  if (!s || s.estado !== 'pendiente' || !s.foto_cliente_id) return no(404)

  const vigente = await fotoClienteVigente(s.cliente_id) // si el cliente la reemplazó o la quitó, manda la actual
  const foto = vigente ? await descargarFotoPrivada(vigente.id) : null
  if (!foto) return no(404)

  return new NextResponse(foto.bytes, {
    headers: {
      'Content-Type': foto.contentType,
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Disposition': 'inline',
    },
  })
}
