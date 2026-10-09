// /api/visita/rating?visita_id=&valor=1..5&t=<firma>
// GET muestra la confirmación (los escáneres de correo abren los 5 enlaces y falsearían la calificación);
// POST registra el rating una sola vez, de forma atómica.
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ratingValido } from '@/lib/links'
import { SITE_URL } from '@/lib/email'
import { pagina, puertaConfirmacion } from '@/lib/confirm'

function leer(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const visita_id = sp.get('visita_id')
  const valor = parseInt(sp.get('valor') ?? '', 10)
  if (!visita_id || !/^[0-9a-f-]{36}$/i.test(visita_id) || !Number.isInteger(valor) || valor < 1 || valor > 5) return null
  if (!ratingValido(visita_id, valor, sp.get('t'))) return null
  return { visita_id, valor }
}

export async function GET(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido o ya expiró.', 400)
  return puertaConfirmacion(req, `${'⭐'.repeat(p.valor)} Confirmar calificación`, `Vas a calificar la visita con ${p.valor} de 5 estrellas.`, 'Enviar calificación')
}

const MENSAJES: Record<number, string> = {
  1: 'Gracias por tu honestidad. Vamos a revisarlo para mejorar.',
  2: 'Gracias por contarnos. Tu opinión nos ayuda a mejorar el servicio.',
  3: 'Gracias por tu calificación.',
  4: 'Nos alegra saber que estuvo bien. ¡Hasta la próxima!',
  5: '¡Nos alegra mucho saberlo! Tu compita está haciendo un gran trabajo. 💙',
}

export async function POST(req: NextRequest) {
  const p = leer(req)
  if (!p) return pagina('Enlace inválido', 'Este enlace no es válido o ya expiró.', 400)
  const admin = createAdminSupabase()

  const { data: visita } = await admin.from('visitas').select('id, compita_id, estado').eq('id', p.visita_id).maybeSingle()
  if (!visita) return pagina('No encontrada', 'No encontramos esta visita.', 404)
  if (visita.estado !== 'terminada') return pagina('Visita no terminada', 'Solo puedes calificar visitas que ya terminaron.')

  // Escritura atómica: solo si aún no tiene rating
  const { data: guardado, error } = await admin
    .from('visitas').update({ rating_cliente: p.valor }).eq('id', p.visita_id).is('rating_cliente', null).select('id').maybeSingle()
  if (error) {
    console.error('[rating] error:', error)
    return pagina('Error', 'No pudimos guardar tu calificación. Intenta de nuevo.', 500)
  }
  if (!guardado) return pagina('Ya calificaste', 'Ya registramos tu calificación para esta visita. ¡Gracias!')

  const { data: ratings } = await admin
    .from('visitas').select('rating_cliente').eq('compita_id', visita.compita_id).eq('estado', 'terminada').not('rating_cliente', 'is', null)
  if (ratings && ratings.length > 0) {
    const suma = ratings.reduce((acc, r) => acc + (r.rating_cliente ?? 0), 0)
    await admin.from('compitas').update({ rating_promedio: Math.round((suma / ratings.length) * 100) / 100, total_ratings: ratings.length }).eq('id', visita.compita_id)
  }

  return pagina(`${'⭐'.repeat(p.valor)} ¡Gracias por calificar!`, MENSAJES[p.valor], 200, { texto: 'Ir al dashboard', href: `${SITE_URL}/dashboard` })
}
