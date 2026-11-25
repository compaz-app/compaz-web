import { redirect } from 'next/navigation'
import { actorDeSesion } from '@/lib/permisos'
import { mfaObligatorio } from '@/lib/mfa'
import { rutaInterna } from '@/lib/html'
import SegundoFactor from './SegundoFactor'

// Registrar y confirmar el autenticador (segundo factor) de quien entra al panel. Solo para administradores y colaboradores. Está fuera del panel a propósito: tiene que
// poder abrirse sin el segundo factor confirmado (es justo donde se confirma).
export const dynamic = 'force-dynamic'

export default async function SegundoFactorPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; reconfirmar?: string }> }) {
  const sp = await searchParams
  const actor = await actorDeSesion()
  if (!actor) redirect(`/login?returnTo=${encodeURIComponent('/seguridad/segundo-factor')}`)
  return <SegundoFactor volverA={rutaInterna(sp.returnTo ?? null, '/panel')} reconfirmar={sp.reconfirmar === '1'} obligatorio={mfaObligatorio()} correo={actor.correo} />
}
