// /admin/postulaciones — bandeja de postulaciones que no llegaron a Airtable
// Mientras el CMC lea solo de Airtable, una postulación que no llegó allí es invisible
// para la selección. Aquí Luis o Juan las ven y las resuelven, con autor y nota.
import { requireAdmin } from '@/lib/auth'
import { postulacionesPorResolver, type PostulacionPorResolver } from '@/lib/captacion'
import { colors, fonts, spacing, radius } from '@/lib/design'
import BandejaPostulaciones from './BandejaPostulaciones'

export const dynamic = 'force-dynamic'

export default async function PostulacionesPage() {
  await requireAdmin()

  // Igual que los crons: visible desde la activación (CAPTACION_DESDE) y también durante
  // una reversión, para poder resolver lo que quedó pendiente.
  const activa = Boolean(process.env.CAPTACION_DESDE)
  let pendientes: PostulacionPorResolver[] = []
  let error = ''
  if (activa) {
    try {
      pendientes = await postulacionesPorResolver(500)
    } catch (e) {
      console.error('[admin/postulaciones]', e)
      error = 'No se pudo leer la bandeja. Reintenta en unos minutos.'
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: colors.fondoCrudo, padding: `${spacing.lg} ${spacing.md}`, fontFamily: fonts.body }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <a href="/admin" style={{ color: colors.textoSutil, fontSize: '14px', textDecoration: 'none' }}>← Volver al panel</a>
        <h1 style={{ fontFamily: fonts.display, color: colors.textoOscuro, fontSize: '24px', margin: `${spacing.md} 0 ${spacing.sm}` }}>
          Postulaciones sin llegar al CMC
        </h1>
        <p style={{ color: colors.textoMedio, fontSize: '14px', lineHeight: 1.6, margin: `0 0 ${spacing.lg}` }}>
          Están guardadas en Supabase, pero no se pudieron copiar a Airtable, así que el CMC no las ve.
          Resuélvelas aquí: vincúlalas a un registro de Airtable, regístralas directamente en el CMC o márcalas como no procedentes.
        </p>
        {!activa && (
          <Aviso texto="La captación en Supabase no está activada (CAPTACION_DESDE). No hay nada que revisar." />
        )}
        {error && <Aviso texto={error} />}
        {activa && !error && <BandejaPostulaciones pendientes={pendientes} />}
      </div>
    </main>
  )
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div style={{ background: colors.blanco, border: `1px solid ${colors.gris200}`, borderRadius: radius.md, padding: spacing.md, color: colors.textoMedio, fontSize: '14px' }}>
      {texto}
    </div>
  )
}
