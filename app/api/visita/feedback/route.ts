import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { feedbackValido } from '@/lib/links'
import { ok, err, notFound, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const visita_id = typeof body?.visita_id === 'string' ? body.visita_id.trim() : ''
  const comentario = typeof body?.comentario === 'string' ? body.comentario.trim().slice(0, 600) : ''
  const quiere_resena = body?.quiere_resena === true
  const t = typeof body?.t === 'string' ? body.t : null

  if (!visita_id || !/^[0-9a-f-]{36}$/i.test(visita_id)) return err('Parámetros inválidos', 400)
  if (!feedbackValido(visita_id, t)) return err('Enlace inválido', 403)
  if (!comentario) return err('El comentario no puede estar vacío', 400)

  const admin = createAdminSupabase()
  const { data: visita } = await admin
    .from('visitas')
    .select('id, estado, usuario_id, compita_id, comentario_cliente, rating_cliente')
    .eq('id', visita_id)
    .maybeSingle()

  if (!visita) return notFound('Visita no encontrada')
  if (visita.estado !== 'terminada') return err('La visita no ha terminado', 400)

  // Guardar comentario interno (solo si no tenía uno — idempotente)
  if (!visita.comentario_cliente) {
    const { error } = await admin
      .from('visitas')
      .update({ comentario_cliente: comentario })
      .eq('id', visita_id)
    if (error) return serverError('No se pudo guardar el comentario')
  }

  // Crear reseña pública pendiente de aprobación
  if (quiere_resena) {
    await admin.from('resenas').upsert(
      {
        visita_id,
        compita_id: visita.compita_id,
        cliente_id: visita.usuario_id,
        texto: comentario,
        estrellas: visita.rating_cliente ?? 5,
        publicada: false,
      },
      { onConflict: 'visita_id', ignoreDuplicates: false },
    )

    // Notificar al admin
    try {
      await admin.from('admin_flags').insert({
        entidad_tipo: 'visita',
        entidad_id: visita_id,
        entidad_nombre: 'Nueva reseña pendiente de aprobación',
        nota: comentario.slice(0, 200),
        reportado_por: 'cliente',
        resuelto: false,
      })
    } catch { /* no bloquear si falla */ }
  }

  return ok({ guardado: true })
}
