// Vista del equipo: el perfil público de un compita TAL COMO LO VE LA FAMILIA, con lo que el compita llenó. Es la misma pieza que usa el listado de
// la familia. Solo para quien tiene el permiso de cuentas; no lleva teléfono ni correo. Funciona aunque el compita aún no esté verificado, para
// revisar su calidad antes de publicarlo.
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { actorDePagina, puede } from '@/lib/permisos'
import { createAdminSupabase } from '@/lib/supabase-server'
import PerfilPublicoCompita from '@/components/ui/PerfilPublicoCompita'
import type { Compita } from '@/types'

const CAMPOS = 'id, nombre, apellido, zona, estado, verificado, telegram_chat_id, es_demo, foto_url, descripcion, servicios, youtube_url, visitas_realizadas, rating_promedio, total_ratings, horarios_disponibles, created_at'

export default async function PerfilPublicoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth()
  const actor = await actorDePagina()
  if (!actor || !puede(actor, 'cuentas')) redirect('/panel')
  const { id } = await params
  if (!/^[0-9a-zA-Z-]{8,64}$/.test(id)) notFound()
  const { data } = await createAdminSupabase().from('compitas').select(CAMPOS).eq('id', id).maybeSingle()
  const c = data as (Compita & { apellido?: string | null; telegram_chat_id?: string | null; es_demo?: boolean }) | null
  if (!c || c.es_demo) notFound()

  const faltan: string[] = []
  if (c.estado !== 'activo') faltan.push('está inactivo')
  if (!c.verificado) faltan.push('falta verificarlo')
  if (!c.telegram_chat_id) faltan.push('no ha vinculado Telegram')
  const completo = [c.nombre, c.apellido].filter(Boolean).join(' ')

  return (
    <main className="min-h-screen bg-fondo-lavanda px-4 pb-16 pt-4">
      <div className="mx-auto max-w-[560px]">
        <Link href={`/panel?sec=personas&persona=compita:${c.id}`} className="text-sm font-bold text-morado-profundo">← Volver a la ficha</Link>
        <p className="mb-1 mt-3 text-[13px] text-texto-medio">
          Perfil de {completo}, así lo ve la familia (solo el nombre de pila). {faltan.length === 0 ? 'Ya aparece en el listado.' : `Todavía no aparece en el listado: ${faltan.join(', ')}.`} Solo lectura, sin teléfono ni correo.
        </p>
        <div className="mt-2 rounded-3xl bg-fondo-claro p-7">
          <PerfilPublicoCompita compita={c} />
        </div>
      </div>
    </main>
  )
}
