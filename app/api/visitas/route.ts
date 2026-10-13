// GET /api/visitas — devuelve todas las visitas del cliente autenticado agrupadas por estado.
import { getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { ok, unauthorized } from '@/lib/api'

export async function GET() {
  const user = await getClienteActivo()
  if (!user) return unauthorized()

  const admin = createAdminSupabase()
  const { data } = await admin
    .from('visitas')
    .select('id, estado, fecha_programada, hora_inicio_programada, hora_fin_programada, inicio, fin, room_url, created_at, compita:compitas(id, nombre, foto_url, zona)')
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false })

  const visitas = (data ?? []) as unknown as {
    id: string
    estado: string
    fecha_programada: string | null
    hora_inicio_programada: string | null
    hora_fin_programada: string | null
    inicio: string | null
    fin: string | null
    room_url: string | null
    created_at: string
    compita: { id: string; nombre: string; foto_url: string | null; zona: string } | null
  }[]

  return ok({
    en_curso: visitas.filter(v => v.estado === 'en_curso'),
    agendadas: visitas.filter(v => v.estado === 'pre_visita' || v.estado === 'programada'),
    cerradas: visitas.filter(v => v.estado === 'terminada'),
  })
}
