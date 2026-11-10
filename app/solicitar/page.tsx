// /solicitar?compita=<id>&modo=directa|mandado — formulario de solicitud del rediseño (Lote 2).
// "Hablar primero" (entrevista con horarios) sigue en /compitas hasta que existan las horas libres del compita (Lote 3).
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { requireAuth, getClienteActivo, getUsuario } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { getAjuste } from '@/lib/ajustes'
import { compitaEnPausa } from '@/lib/cancelaciones'
import { fotoClienteVigente } from '@/lib/fotos-privadas'
import { nombreCorto } from '@/lib/plantillas-aviso'
import SolicitarForm from './SolicitarForm'

export const dynamic = 'force-dynamic'

export default async function SolicitarPage({ searchParams }: { searchParams: Promise<{ compita?: string }> }) {
  await requireAuth()
  if (!(await getClienteActivo())) redirect('/login?error=bloqueado')
  const { compita: compitaId } = await searchParams
  if (!compitaId) redirect('/compitas')

  const { data: c } = await createAdminSupabase()
    .from('compitas').select('id, nombre, estado, verificado, telegram_chat_id').eq('id', compitaId).maybeSingle()
  // Solo se puede pedir a un compita activo, verificado y alcanzable por Telegram (igual que el listado).
  if (!c || c.estado !== 'activo' || !c.verificado || !c.telegram_chat_id || await compitaEnPausa(c.id as string)) redirect('/compitas')

  const [usuario, precioMandado, antifraude] = await Promise.all([
    getUsuario(), getAjuste('precio_mandado'), getAjuste('antifraude_cliente'),
  ])
  const foto = usuario ? await fotoClienteVigente(usuario.id) : null
  const familiar = usuario?.familiar_nombre
    ? [usuario.familiar_nombre, usuario.familiar_edad ? `${usuario.familiar_edad} años` : null, usuario.familiar_condicion].filter(Boolean).join(', ')
    : null

  return (
    <Suspense>
      <SolicitarForm
        compitaId={c.id as string}
        compitaNombre={nombreCorto(String(c.nombre))}
        precioMandado={Number(precioMandado)}
        antifraude={String(antifraude)}
        familiar={familiar}
        tieneFotoInicial={!!foto}
      />
    </Suspense>
  )
}
