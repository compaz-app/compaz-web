// Una sola fuente de administradores: la variable ADMIN_EMAILS. La tabla public.admin_emails (que lee is_admin() para el
// tiempo real del panel) es una COPIA que este módulo mantiene igual. Se ejecuta a diario en el cron de limpieza.
// Nunca lanza: devuelve el resultado para que quien llama decida.

import { createAdminSupabase } from '@/lib/supabase-server'

export function adminsDeEntorno(): string[] {
  return [...new Set((process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))]
}

export type ResultadoSync = { ok: true; agregados: string[]; quitados: string[] } | { ok: false; error: string }

export async function sincronizarAdmins(): Promise<ResultadoSync> {
  const deseados = adminsDeEntorno()
  // Con la variable vacía (error de configuración) NO se toca nada: vaciar la tabla dejaría al equipo sin tiempo real.
  if (deseados.length === 0) return { ok: false, error: 'ADMIN_EMAILS está vacío: no se sincronizó nada' }
  try {
    const db = createAdminSupabase()
    const { data, error } = await db.from('admin_emails').select('email')
    if (error) return { ok: false, error: error.message }
    const actuales = new Set((data ?? []).map((r: { email: string }) => r.email.toLowerCase()))
    const agregados = deseados.filter((e) => !actuales.has(e))
    const quitados = [...actuales].filter((e) => !deseados.includes(e))
    if (agregados.length) {
      const { error: e1 } = await db.from('admin_emails').insert(agregados.map((email) => ({ email })))
      if (e1) return { ok: false, error: e1.message }
    }
    if (quitados.length) {
      const { error: e2 } = await db.from('admin_emails').delete().in('email', quitados)
      if (e2) return { ok: false, error: e2.message }
    }
    return { ok: true, agregados, quitados }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'error desconocido' }
  }
}
