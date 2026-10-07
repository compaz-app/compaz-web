import { requireAuth, getUsuario } from '@/lib/auth'
import CompitasMarketplace from './CompitasMarketplace'
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Compita } from '@/types'
import { Suspense } from 'react'

export default async function CompitasPage() {
  await requireAuth()
  const usuario = await getUsuario()

  const supabase = createAdminSupabase()
  const { data: compitasRaw } = await supabase
    .from('compitas')
    .select('id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, rating_promedio, total_ratings, horarios_disponibles, created_at')
    .eq('estado', 'activo')
    .eq('verificado', true)
    .not('telegram_chat_id', 'is', null)
    .order('visitas_realizadas', { ascending: false }) as { data: Compita[] | null }

  // Calcular tasa de aceptación por compita
  const compitaIds = (compitasRaw ?? []).map((c) => c.id)
  const { data: statsRaw } = compitaIds.length > 0
    ? await supabase
        .from('solicitudes')
        .select('compita_id, estado')
        .in('compita_id', compitaIds)
        .in('estado', ['aceptada', 'rechazada', 'completada', 'contratada'])
    : { data: [] }

  type StatRow = { compita_id: string; estado: string }
  const statsMap = new Map<string, { aceptadas: number; rechazadas: number }>()
  for (const row of (statsRaw ?? []) as StatRow[]) {
    const entry = statsMap.get(row.compita_id) ?? { aceptadas: 0, rechazadas: 0 }
    if (row.estado === 'aceptada' || row.estado === 'completada' || row.estado === 'contratada') {
      entry.aceptadas++
    } else if (row.estado === 'rechazada') {
      entry.rechazadas++
    }
    statsMap.set(row.compita_id, entry)
  }

  const compitas: Compita[] = (compitasRaw ?? []).map((c) => {
    const s = statsMap.get(c.id)
    const total = (s?.aceptadas ?? 0) + (s?.rechazadas ?? 0)
    return {
      ...c,
      total_solicitudes: total,
      tasa_aceptacion: total >= 3 ? Math.round((s!.aceptadas / total) * 100) : null,
    }
  })

  const { isAdminEmail } = await import('@/lib/auth')
  const esAdmin = isAdminEmail(usuario?.email ?? '')

  return (
    <Suspense>
    <CompitasMarketplace
      compitas={compitas ?? []}
      usuarioNombre={usuario?.nombre ?? ''}
      usuarioEmail={usuario?.email ?? ''}
      backHref={esAdmin ? '/admin?tab=accesos' : '/dashboard'}
      backLabel={esAdmin ? '← Panel admin' : '← Mi portal'}
    />
    </Suspense>
  )
}
