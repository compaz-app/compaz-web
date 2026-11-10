// /solicitar/hora?solicitud=<id> — el cliente elige una de las horas libres del compita para la videollamada de 20 minutos.
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { requireAuth, getClienteActivo } from '@/lib/auth'
import { createAdminSupabase } from '@/lib/supabase-server'
import { nombreCorto } from '@/lib/plantillas-aviso'
import HoraForm from './HoraForm'

export const dynamic = 'force-dynamic'

export default async function HoraPage({ searchParams }: { searchParams: Promise<{ solicitud?: string }> }) {
  await requireAuth()
  const cli = await getClienteActivo()
  if (!cli) redirect('/login?error=bloqueado')
  const { solicitud } = await searchParams
  if (!solicitud) redirect('/dashboard')

  const admin = createAdminSupabase()
  const { data: s } = await admin.from('solicitudes').select('id, compita_id, estado, tipo, slot_confirmado').eq('id', solicitud).eq('cliente_id', cli.id).maybeSingle()
  if (!s || s.estado !== 'aceptada' || s.tipo !== 'entrevista' || s.slot_confirmado) redirect('/dashboard')
  const [{ data: c }, { data: r }] = await Promise.all([
    admin.from('compitas').select('nombre').eq('id', s.compita_id).maybeSingle(),
    admin.from('reservas_horario').select('id, inicio, vence_en').eq('solicitud_id', s.id).eq('estado', 'reservada').maybeSingle(),
  ])
  const reservada = r && new Date(String(r.vence_en)).getTime() > Date.now() ? { inicio: String(r.inicio), venceEn: String(r.vence_en) } : null

  return (
    <Suspense>
      <HoraForm solicitudId={String(s.id)} compitaNombre={nombreCorto(String(c?.nombre ?? '')) || 'tu compita'} reservadaInicial={reservada} />
    </Suspense>
  )
}
