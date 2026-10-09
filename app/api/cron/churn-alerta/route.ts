import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'
import { esc } from '@/lib/html'
import { cronAutorizado, latido } from '@/lib/cron'

// POST /api/cron/churn-alerta
// Corre semanalmente. Detecta clientes con compita asignada cuya última visita
// terminada fue hace más de 30 días y sin visita activa.
// Alerta al admin por Telegram para seguimiento personalizado.
export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()
  const adminTg = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!adminTg) return NextResponse.json({ ok: true, inactivos: 0 })

  const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()

  // Clientes con compita asignada
  const { data: usuarios } = await admin
    .from('usuarios')
    .select('id, nombre, email, compita:compitas(nombre)')
    .not('compita_id', 'is', null) as {
      data: Array<{ id: string; nombre: string; email: string; compita: { nombre: string } | null }> | null
    }

  if (!usuarios?.length) return NextResponse.json({ ok: true, inactivos: 0 })

  const inactivos: Array<{ nombre: string; email: string; compita: string; diasDesde: number }> = []

  // Dos consultas en bloque (antes: 2 por cliente)
  const ids = usuarios.map((u) => u.id)
  const { data: visitas } = await admin
    .from('visitas')
    .select('usuario_id, estado, fin')
    .in('usuario_id', ids)
    .in('estado', ['terminada', 'pre_visita', 'programada', 'en_curso'])
  const ultimaFin = new Map<string, string>()
  const conActiva = new Set<string>()
  for (const v of visitas ?? []) {
    if (v.estado === 'terminada') {
      if (v.fin && (!ultimaFin.has(v.usuario_id) || v.fin > ultimaFin.get(v.usuario_id)!)) ultimaFin.set(v.usuario_id, v.fin)
    } else conActiva.add(v.usuario_id)
  }

  for (const u of usuarios) {
    const fin = ultimaFin.get(u.id)
    if (!fin || new Date(fin) > new Date(hace30dias) || conActiva.has(u.id)) continue
    const ultimaVisita = { fin }

    const diasDesde = Math.floor((Date.now() - new Date(ultimaVisita.fin).getTime()) / (24 * 60 * 60_000))
    inactivos.push({
      nombre: u.nombre,
      email: u.email,
      compita: u.compita?.nombre ?? '—',
      diasDesde,
    })
  }

  if (inactivos.length === 0) return NextResponse.json({ ok: true, inactivos: 0 })

  // Ordenar por más días sin visita
  inactivos.sort((a, b) => b.diasDesde - a.diasDesde)

  const lista = inactivos
    .map((c, i) => `${i + 1}. <b>${esc(c.nombre)}</b>: ${c.diasDesde} días sin visita\n   Compita: ${esc(c.compita)} · ${esc(c.email)}`)
    .join('\n\n')

  // Telegram limita a 4096 caracteres: enviar en bloques
  const bloques: string[] = []
  let actual = ''
  for (const l of lista.split('\n\n')) {
    if ((actual + l).length > 3500) { bloques.push(actual); actual = '' }
    actual += (actual ? '\n\n' : '') + l
  }
  if (actual) bloques.push(actual)
  for (let i = 0; i < bloques.length; i++) {
    await sendTelegramMessage(
      adminTg,
      [
        i === 0 ? `⚠️ <b>Clientes que necesitan seguimiento (${inactivos.length})</b>\n\nLlevan más de 30 días sin visita y no tienen ninguna activa:\n` : '',
        bloques[i],
        i === bloques.length - 1 ? `\nContáctalos personalmente para saber cómo están.` : '',
      ].join('\n'),
    ).catch((e) => console.error('Error Telegram churn-alerta:', e))
  }
  await latido('churn-alerta')

  return NextResponse.json({ ok: true, inactivos: inactivos.length })
}
