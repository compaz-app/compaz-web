// /admin/equipo — gestión de colaboradores del panel. Solo el administrador raíz (requireAdmin + la ruta
// /api/admin/equipo exige el permiso 'raiz'): un colaborador no puede entrar ni darse permisos.
import { requireAdmin } from '@/lib/auth'
import { listarEquipo, type Colaborador } from '@/lib/equipo'
import { adminsDeEntorno } from '@/lib/admins'
import { colors, fonts, spacing, radius } from '@/lib/design'
import EquipoPanel from './EquipoPanel'

export const dynamic = 'force-dynamic'

export default async function EquipoPage() {
  await requireAdmin()

  let equipo: Colaborador[] = []
  let error = ''
  try {
    equipo = await listarEquipo()
  } catch (e) {
    console.error('[admin/equipo]', e)
    error = 'No se pudo leer el equipo. Reintenta en unos minutos.'
  }

  return (
    <main style={{ minHeight: '100vh', background: colors.fondoCrudo, padding: `${spacing.lg} ${spacing.md}`, fontFamily: fonts.body }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <a href="/admin?tab=accesos" style={{ color: colors.textoSutil, fontSize: '14px', textDecoration: 'none' }}>← Volver al panel</a>
        <h1 style={{ fontFamily: fonts.display, color: colors.textoOscuro, fontSize: '24px', margin: `${spacing.md} 0 ${spacing.sm}` }}>
          Equipo y permisos
        </h1>
        <p style={{ color: colors.textoMedio, fontSize: '14px', lineHeight: 1.6, margin: `0 0 ${spacing.lg}` }}>
          Quién entra al panel y qué puede hacer cada persona. Cada permiso se activa o se apaga por separado y el cambio
          vale en la siguiente acción de esa persona. Todo queda registrado con tu nombre.
        </p>
        {error
          ? <div style={{ background: colors.rojoClaro, color: colors.rojo, borderRadius: radius.md, padding: spacing.md, fontSize: '14px' }}>{error}</div>
          : <EquipoPanel inicial={equipo} administradores={adminsDeEntorno()} />}
      </div>
    </main>
  )
}
