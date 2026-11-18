// Resumen diario al cliente (7 pm hora de Caracas). Recoge lo que pasó en el día y NO mandó correo propio (el compita salió, llegó, falta decidir…), pero solo si
// el cliente no entró a su portal hoy y hay algo sin ver. Sin novedades, no sale nada. Una sola vez por cliente y día. Decidido 2026-11-18.
import { createAdminSupabase } from '@/lib/supabase-server'
import { sendEmail, SITE_URL } from '@/lib/email'
import { reclamarUnaVez } from '@/lib/cron'
import { hoyVE } from '@/lib/format'
import { esc } from '@/lib/html'
import { TIPOS_RESUMEN_DIARIO } from '@/lib/novedades-politica'

type Admin = ReturnType<typeof createAdminSupabase>
const diaVE = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })

/** El contenido del correo: las frases del portal, sin repetir, y el botón. */
export function armarResumenDiario(nombre: string, titulos: string[]): { asunto: string; html: string } {
  const unicos = [...new Set(titulos)]
  return {
    asunto: 'Lo que pasó hoy en tu portal de Compaz',
    html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
      <h2 style="color:#2D1464;font-size:22px;margin:0 0 12px">Hola, ${esc(nombre.split(' ')[0] || 'tú')}. Esto pasó hoy</h2>
      <ol style="color:#4A3B6B;font-size:16px;line-height:1.7;padding-left:20px;margin:0 0 20px">${unicos.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      <a href="${SITE_URL}/portal" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px">Verlo en mi portal →</a>
    </div>`,
  }
}

export async function enviarResumenesDiarios(admin: Admin = createAdminSupabase(), ahora: Date = new Date()): Promise<{ enviados: number; omitidos: number }> {
  const r = { enviados: 0, omitidos: 0 }
  try {
    const desde = new Date(ahora.getTime() - 24 * 3_600_000).toISOString()
    const { data } = await admin.from('novedades_cliente').select('usuario_id, titulo').in('tipo', [...TIPOS_RESUMEN_DIARIO]).is('vista_en', null).gte('created_at', desde).limit(500)
    const porCliente = new Map<string, string[]>()
    for (const n of (data ?? []) as { usuario_id: string; titulo: string }[]) porCliente.set(n.usuario_id, [...(porCliente.get(n.usuario_id) ?? []), n.titulo])
    const hoy = hoyVE()
    for (const [usuarioId, titulos] of porCliente) {
      try {
        const { data: u } = await admin.from('usuarios').select('nombre, email, portal_visto_en').eq('id', usuarioId).maybeSingle()
        const c = u as { nombre: string | null; email: string | null; portal_visto_en: string | null } | null
        if (!c?.email || (c.portal_visto_en && diaVE(c.portal_visto_en) === hoy)) { r.omitidos++; continue }
        if (!(await reclamarUnaVez(`resumen_diario:${usuarioId}:${hoy}`))) { r.omitidos++; continue }
        const m = armarResumenDiario(c.nombre ?? '', titulos)
        await sendEmail({ to: c.email, subject: m.asunto, html: m.html })
        r.enviados++
      } catch (e) { console.error('[resumen-diario] cliente', usuarioId, e) }
    }
  } catch (e) { console.error('[resumen-diario] error:', e) }
  return r
}
