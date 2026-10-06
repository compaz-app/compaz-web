import { requireAdmin } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import AdminDashboard from './AdminDashboard'
import type { Visita, Compita, Usuario } from '@/types'
import { Suspense } from 'react'

export type SolicitudAdmin = {
  id: string
  cliente_id: string
  compita_id: string
  estado: string
  slot_confirmado: string | null
  room_url: string | null
  created_at: string
  slots_propuestos: string[]
  mensaje: string
  usuarios: { nombre: string; email: string } | null
  compitas: { nombre: string; foto_url: string | null; zona: string } | null
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireAdmin()

  const supabase = createAdminSupabase()
  const params = await searchParams
  const defaultTab = params.tab ?? 'visitas'

  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [
    { data: visitasActivas },
    { data: visitasPreVisita },
    { data: todosUsuarios },
    { data: todosCompitas },
    { data: visitasPasadas },
    { data: todasSolicitudes },
    { count: visitasMes },
  ] = await Promise.all([
    supabase
      .from('visitas')
      .select('*, compita:compitas(*), usuario:usuarios(*)')
      .eq('estado', 'en_curso')
      .order('inicio', { ascending: false }),
    supabase
      .from('visitas')
      .select('*, compita:compitas(*), usuario:usuarios(*)')
      .eq('estado', 'pre_visita')
      .order('created_at', { ascending: false }),
    supabase
      .from('usuarios')
      .select('*, compita:compitas(nombre, zona, verificado)')
      .order('created_at', { ascending: false }),
    supabase
      .from('compitas')
      .select('id, nombre, zona, estado, verificado, telegram_chat_id, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, fecha_ingreso, codigo, created_at')
      .order('nombre', { ascending: true }),
    supabase
      .from('visitas')
      .select('*, compita:compitas(nombre), usuario:usuarios(nombre, email)')
      .eq('estado', 'terminada')
      .order('fin', { ascending: false })
      .limit(50),
    supabase
      .from('solicitudes')
      .select('id, cliente_id, compita_id, estado, slot_confirmado, room_url, created_at, slots_propuestos, mensaje, usuarios(nombre, email), compitas(nombre, foto_url, zona)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('visitas')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', inicioMes),
  ])

  return (
    <Suspense>
      <AdminDashboard
        visitasActivas={(visitasActivas ?? []) as (Visita & { compita: Compita; usuario: Usuario })[]}
        visitasPreVisita={(visitasPreVisita ?? []) as (Visita & { compita: Compita; usuario: Usuario })[]}
        usuarios={(todosUsuarios ?? []) as (Usuario & { compita: { nombre: string; zona: string; verificado: boolean } | null })[]}
        compitas={(todosCompitas ?? []) as Compita[]}
        visitasPasadas={(visitasPasadas ?? []) as Visita[]}
        todasSolicitudes={(todasSolicitudes ?? []) as unknown as SolicitudAdmin[]}
        visitasMes={visitasMes ?? 0}
        defaultTab={defaultTab}
      />
    </Suspense>
  )
}
