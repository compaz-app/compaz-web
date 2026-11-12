// POST /api/cron/limpieza — una vez al día (3 am VE)
// Elimina tokens vencidos y filas sintéticas de control (idempotencia, cooldowns, latidos viejos).
import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { cronAutorizado, latido } from '@/lib/cron'
import { ok, err } from '@/lib/api'
import { getAjuste } from '@/lib/ajustes'
import { borrarFotosVencidas } from '@/lib/fotos-privadas'
import { borrarCuentasVencidas } from '@/lib/cuenta-eliminar'
import { sincronizarAdmins } from '@/lib/admins'
import { CATEGORIAS_ACCESO } from '@/lib/panel-mas-tipos'

export async function POST(req: NextRequest) {
  if (!cronAutorizado(req)) return err('No autorizado', 401)

  const admin = createAdminSupabase()
  const ahora = new Date().toISOString()
  const hace1d = new Date(Date.now() - 86400_000).toISOString()
  const hace30d = new Date(Date.now() - 30 * 86400_000).toISOString()
  // La retención de avisos sale de Ajustes (por defecto 90 días).
  const hace90d = new Date(Date.now() - Number(await getAjuste('avisos_retencion_dias')) * 86400_000).toISOString()
  // Quién vio un dato sensible y por qué se conserva MÁS tiempo (1 año por defecto, editable en Ajustes): es la garantía de privacidad.
  const haceAccesos = new Date(Date.now() - Number(await getAjuste('accesos_retencion_dias')) * 86400_000).toISOString()

  const tareas: Array<[string, PromiseLike<{ error: { message: string } | null }>]> = [
    // La actividad del equipo se conserva el mismo tiempo que el registro de avisos (90 días por defecto); las tareas viven en admin_flags.
    // Los accesos a datos sensibles (categorías de CATEGORIAS_ACCESO) se conservan según `accesos_retencion_dias`.
    ['actividad_admin', admin.from('actividad_admin').delete().lt('creado_en', hace90d).is('categoria', null)],
    ['actividad_admin (otras categorías)', admin.from('actividad_admin').delete().lt('creado_en', hace90d).not('categoria', 'in', `(${CATEGORIAS_ACCESO.join(',')})`)],
    ['accesos a datos sensibles', admin.from('actividad_admin').delete().lt('creado_en', haceAccesos).in('categoria', [...CATEGORIAS_ACCESO])],
    ['ventanas y bloqueos de pago, llamadas, enlaces, errores y vistas previas', admin.from('telegram_estados').delete().or('chat_id.like.pago_lock:%,chat_id.like.llamada_aviso:%,chat_id.like.enlace_llamada:%,chat_id.like.error_srv%,chat_id.like.preview_acceso:%').lt('updated_at', hace1d)],
    ['timbre colapsado', admin.from('telegram_estados').delete().like('chat_id', 'timbre_colapsado:%').lt('updated_at', hace1d)],
    ['onboarding_tokens', admin.from('onboarding_tokens').delete().or(`usado.eq.true,expires_at.lt.${ahora}`)],
    ['compita_edit_tokens', admin.from('compita_edit_tokens').delete().lt('expires_at', ahora)],
    ['action_tokens', admin.from('action_tokens').delete().lt('expires_at', ahora)],
    // Filas sintéticas: deduplicación de updates, confirmaciones, cooldowns y alertas de un solo uso
    ['telegram upd/conf/cod/recon', admin.from('telegram_estados').delete().or('chat_id.like.upd:%,chat_id.like.conf:%,chat_id.like.cod:%,chat_id.like.recon:%').lt('updated_at', hace1d)],
    ['telegram alertas viejas', admin.from('telegram_estados').delete().or('chat_id.like.noshow:%,chat_id.like.alerta_%,chat_id.like.sala_fail:%,chat_id.like.pend_%').lt('updated_at', hace30d)],
    // Contadores del acceso (límites por IP y por correo, intentos de código): una fila por IP o correo, sin esto crecen sin fin
    ['contadores de acceso vencidos', admin.from('telegram_estados').delete().or('chat_id.like.acc_ip:%,chat_id.like.cod_ip:%,chat_id.like.cod_fallos:%').lt('pendiente_expira', ahora)],
    ['cooldown de acceso por correo', admin.from('telegram_estados').delete().like('chat_id', 'acc_mail:%').lt('updated_at', hace1d)],
    // Retención de avisos: 90 días (decisión del usuario). Solo los que ya terminaron; un pendiente nunca se borra.
    ['avisos de más de 90 días', admin.from('avisos').delete().lt('creado_en', hace90d).in('estado', ['enviado', 'cancelado', 'fallido'])],
  ]
  const fallos: string[] = []
  for (const [nombre, q] of tareas) {
    const { error } = await q
    if (error) { console.error(`[limpieza] ${nombre}:`, error.message); fallos.push(nombre) }
  }
  // Fotos privadas cuyo plazo venció: se borran de verdad (archivo y marca) y queda un evento.
  const fotos = await borrarFotosVencidas()
  if (fotos.fallos > 0) fallos.push('fotos privadas')
  // Cuentas cuyo plazo de 7 días se cumplió: se vacían sus datos personales (pagos y visitas quedan anonimizados).
  const cuentas = await borrarCuentasVencidas()
  if (cuentas.fallos > 0) fallos.push('borrado de cuentas')
  // La lista de administradores de la base (tiempo real) se mantiene igual a ADMIN_EMAILS.
  const admins = await sincronizarAdmins()
  if (!admins.ok) { console.error('[limpieza] administradores:', admins.error); fallos.push('lista de administradores') }
  else if (admins.agregados.length || admins.quitados.length) console.log('[limpieza] administradores sincronizados', admins.agregados.length, 'agregados,', admins.quitados.length, 'quitados')
  // El latido se marca solo si todo salió bien: si la limpieza falla seguido, el equipo se entera por la vigilancia de procesos.
  if (!fallos.length) await latido('limpieza')
  return fallos.length ? err(`Fallaron: ${fallos.join(', ')}`, 500) : ok(null)
}
