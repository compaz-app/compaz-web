import { requireAuth, getUsuario } from '@/lib/auth'
import CompitasMarketplace from './CompitasMarketplace'
import { createAdminSupabase } from '@/lib/supabase-server'
import type { Compita } from '@/types'
import { Suspense } from 'react'

export default async function CompitasPage() {
  await requireAuth()
  const usuario = await getUsuario()

  const supabase = createAdminSupabase()
  const { data: compitas } = await supabase
    .from('compitas')
    .select('*')
    .eq('estado', 'activo')
    .eq('verificado', true)
    .order('visitas_realizadas', { ascending: false }) as { data: Compita[] | null }

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
