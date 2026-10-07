import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'

// POST /api/cron/churn-alerta
// Corre semanalmente. Detecta clientes con compita asignada cuya última visita
// terminada fue hace más de 30 días y sin visita activa.
// Alerta al admin por Telegram para seguimiento personalizado.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  for (const u of usuarios) {
    // Última visita terminada
    const { data: ultimaVisita } = await admin
      .from('visitas')
      .select('fin')
      .eq('usuario_id', u.id)
      .eq('estado', 'terminada')
      .order('fin', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!ultimaVisita?.fin) continue
    if (new Date(ultimaVisita.fin) > new Date(hace30dias)) continue

    // Verificar que no tenga visita activa
    const { count: activas } = await admin
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', u.id)
      .in('estado', ['pre_visita', 'programada', 'en_curso'])

    if ((activas ?? 0) > 0) continue

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
    .map((c, i) => `${i + 1}. <b>${c.nombre}</b> — ${c.diasDesde} días sin visita\n   Compita: ${c.compita} · ${c.email}`)
    .join('\n\n')

  await sendTelegramMessage(
    adminTg,
    [
      `⚠️ <b>Clientes que necesitan seguimiento (${inactivos.length})</b>`,
      ``,
      `Llevan más de 30 días sin visita y no tienen ninguna activa:`,
      ``,
      lista,
      ``,
      `Contáctalos personalmente para saber cómo están.`,
    ].join('\n'),
  ).catch((e) => console.error('Error Telegram churn-alerta:', e))

  return NextResponse.json({ ok: true, inactivos: inactivos.length })
}
