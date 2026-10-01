import { requireAdmin } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import AdminDashboard from './AdminDashboard'
import type { Visita, Compita, Usuario } from '@/types'
import { Suspense } from 'react'

export default async function AdminPage() {
  await requireAdmin()

  const supabase = createAdminSupabase()

  const [
    { data: visitasActivas },
    { data: todosUsuarios },
    { data: todosCompitas },
    { data: visitasPasadas },
  ] = await Promise.all([
    supabase
      .from('visitas')
      .select('*, compita:compitas(*), usuario:usuarios(*)')
      .eq('estado', 'en_curso')
      .order('inicio', { ascending: false }),
    supabase
      .from('usuarios')
      .select('*, compita:compitas(nombre, zona, verificado)')
      .order('created_at', { ascending: false }),
    supabase
      .from('compitas')
      .select('id, nombre, zona, estado, verificado, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, fecha_ingreso, codigo, created_at')
      .order('nombre', { ascending: true }),
    supabase
      .from('visitas')
      .select('*, compita:compitas(nombre), usuario:usuarios(nombre, email)')
      .eq('estado', 'terminada')
      .order('fin', { ascending: false })
      .limit(50),
  ])

  return (
    <Suspense>
    <AdminDashboard
      visitasActivas={(visitasActivas ?? []) as (Visita & { compita: Compita; usuario: Usuario })[]}
      usuarios={(todosUsuarios ?? []) as (Usuario & { compita: { nombre: string; zona: string; verificado: boolean } | null })[]}
      compitas={(todosCompitas ?? []) as Compita[]}
      visitasPasadas={(visitasPasadas ?? []) as Visita[]}
    />
    </Suspense>
  )
}
