import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { createHmac } from 'crypto'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://micompaz.com'

export function generarTokenRating(visita_id: string): string {
  const secret = process.env.CRON_SECRET ?? 'compaz-rating'
  return createHmac('sha256', secret).update(visita_id).digest('hex').slice(0, 16)
}

function html(titulo: string, mensaje: string, redirigir = false) {
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${titulo} — Compaz</title>
    ${redirigir ? `<meta http-equiv="refresh" content="2;url=${SITE_URL}/dashboard">` : ''}
    <style>body{margin:0;font-family:Inter,sans-serif;background:#FDFAF6;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;box-sizing:border-box}
    .card{background:white;border-radius:24px;padding:40px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(26,10,60,.08)}
    h1{color:#2D1464;font-size:22px;margin:0 0 12px}p{color:#4A3B6B;font-size:15px;line-height:1.6;margin:0 0 20px}
    .stars{font-size:36px;margin-bottom:16px}
    a{display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:14px}</style>
    </head><body><div class="card">
    <div class="stars">⭐</div>
    <h1>${titulo}</h1><p>${mensaje}</p>
    <a href="${SITE_URL}/dashboard">Ir al dashboard</a>
    </div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

// GET /api/visita/rating?visita_id=X&valor=N&t=TOKEN
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const visita_id = searchParams.get('visita_id')
  const valor = parseInt(searchParams.get('valor') ?? '', 10)
  const token = searchParams.get('t') ?? ''

  if (!visita_id || isNaN(valor) || valor < 1 || valor > 5) {
    return html('Enlace inválido', 'Este enlace no es válido o ya expiró.')
  }

  // Verificar token para evitar spoofing
  if (token !== generarTokenRating(visita_id)) {
    return html('Enlace inválido', 'Este enlace no es válido o ya expiró.')
  }

  const admin = createAdminSupabase()

  const { data: visita } = await admin
    .from('visitas')
    .select('id, compita_id, estado, rating_cliente')
    .eq('id', visita_id)
    .single()

  if (!visita) return html('No encontrada', 'No encontramos esta visita.')
  if (visita.estado !== 'terminada') return html('Visita no terminada', 'Solo puedes calificar visitas que ya terminaron.')
  if (visita.rating_cliente !== null) return html('Ya calificaste', 'Ya registramos tu calificación para esta visita. ¡Gracias!')

  // Guardar rating en la visita
  await admin.from('visitas').update({ rating_cliente: valor }).eq('id', visita_id)

  // Recalcular promedio del compita
  const { data: ratings } = await admin
    .from('visitas')
    .select('rating_cliente')
    .eq('compita_id', visita.compita_id)
    .eq('estado', 'terminada')
    .not('rating_cliente', 'is', null)

  if (ratings && ratings.length > 0) {
    const suma = ratings.reduce((acc, r) => acc + (r.rating_cliente ?? 0), 0)
    const promedio = Math.round((suma / ratings.length) * 100) / 100
    await admin.from('compitas').update({ rating_promedio: promedio, total_ratings: ratings.length }).eq('id', visita.compita_id)
  }

  const estrellas = '⭐'.repeat(valor)
  const mensajes: Record<number, string> = {
    1: 'Gracias por tu honestidad. Vamos a revisarlo para mejorar.',
    2: 'Gracias por contarnos. Tu opinión nos ayuda a mejorar el servicio.',
    3: 'Gracias por tu calificación.',
    4: 'Nos alegra saber que estuvo bien. ¡Hasta la próxima!',
    5: '¡Nos alegra mucho saberlo! Tu compita está haciendo un gran trabajo. 💙',
  }

  return html(
    `${estrellas} ¡Gracias por calificar!`,
    mensajes[valor] ?? 'Gracias por tu calificación.',
    true,
  )
}
