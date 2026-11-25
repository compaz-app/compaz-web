// El correo de respaldo al cliente (lo corre el cron de la escalera, cada 5 minutos). Con CORREO_RESPALDO=diferido, el correo de un aviso al cliente no sale al
// instante: se guarda programado (según la urgencia y si el portal está abierto, ver lib/novedades-politica.ts) y aquí se decide qué hacer cuando llega su hora:
//   1. Si el cliente ya lo vio en el portal, se cancela (no hace falta el respaldo).
//   2. Si el mismo cliente tiene varios correos listos (o por salir en los próximos minutos), se juntan en UN solo correo con la lista y un botón al portal.
//   3. Si es uno solo, sale como siempre.
// Solo toca los avisos que tienen su novedad (los que nacieron con este sistema); los demás pendientes los sigue barriendo la escalera.
import { createAdminSupabase } from '@/lib/supabase-server'
import { reintentarAviso } from '@/lib/avisos'
import { sendEmail, SITE_URL } from '@/lib/email'
import { PLANTILLAS, type NombrePlantilla, type VariablesAviso } from '@/lib/plantillas-aviso'
import { esc } from '@/lib/html'
import { alertaAdmin } from '@/lib/alertas-admin'

type Admin = ReturnType<typeof createAdminSupabase>

/** ¿Está encendido el correo diferido? Se enciende con la variable CORREO_RESPALDO=diferido en Netlify (Juan). Apagado, todo sale como antes. */
export const correoDiferidoActivo = () => process.env.CORREO_RESPALDO === 'diferido'

/** Se juntan también los que van a salir en los próximos minutos (el cron corre cada 5): un solo correo en vez de dos seguidos. */
export const ADELANTO_AGRUPAR_MIN = 5
export const CLAVE_NOVEDAD = (claveAviso: string) => `novedad:${claveAviso}`
export const NOTA_VISTO = 'ya lo vio en el portal'
export const NOTA_AGRUPADO = 'agrupado en un solo correo'

interface AvisoDiferido { id: string; destinatario_id: string; plantilla: string; variables: VariablesAviso; clave_unica: string; programado_para: string; intentos: number }
export interface ResultadoDiferidos { enviados: number; agrupados: number; cancelados: number }

/** El correo único que junta varios avisos. Cada línea es el asunto del aviso original. */
export function armarCorreoAgrupado(asuntos: string[]): { asunto: string; html: string } {
  const n = asuntos.length
  return {
    asunto: `Tienes ${n} novedades en tu portal de Compaz`,
    html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
      <img src="${SITE_URL}/logo.png" alt="Compaz" style="height:40px;margin-bottom:24px" />
      <h2 style="color:#2D1464;font-size:22px;margin:0 0 12px">Tienes ${n} novedades en Compaz</h2>
      <ol style="color:#4A3B6B;font-size:16px;line-height:1.7;padding-left:20px;margin:0 0 20px">${asuntos.map((a) => `<li>${esc(a)}</li>`).join('')}</ol>
      <a href="${SITE_URL}/portal" style="display:inline-block;background:#FF6B2B;color:white;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px">Verlo todo en mi portal →</a>
    </div>`,
  }
}

export async function procesarCorreosDiferidos(admin: Admin = createAdminSupabase(), ahora: Date = new Date()): Promise<ResultadoDiferidos> {
  const r: ResultadoDiferidos = { enviados: 0, agrupados: 0, cancelados: 0 }
  try {
    const limite = new Date(ahora.getTime() + ADELANTO_AGRUPAR_MIN * 60_000).toISOString()
    const { data } = await admin.from('avisos').select('id, destinatario_id, plantilla, variables, clave_unica, programado_para, intentos')
      .eq('estado', 'pendiente').eq('canal', 'correo').eq('destinatario_tipo', 'cliente').lte('programado_para', limite).limit(200)
    const avisos = ((data ?? []) as AvisoDiferido[]).filter((a) => a.destinatario_id && a.clave_unica)
    if (!avisos.length) return r

    // Solo los que nacieron con su novedad; y los que el cliente ya vio se cancelan.
    const { data: nov } = await admin.from('novedades_cliente').select('clave_unica, vista_en').in('clave_unica', avisos.map((a) => CLAVE_NOVEDAD(a.clave_unica)))
    const novedad = new Map(((nov ?? []) as { clave_unica: string; vista_en: string | null }[]).map((n) => [n.clave_unica, n]))
    const vivos: AvisoDiferido[] = []
    for (const a of avisos) {
      const n = novedad.get(CLAVE_NOVEDAD(a.clave_unica))
      if (!n) continue
      if (n.vista_en) {
        await admin.from('avisos').update({ estado: 'cancelado', error: NOTA_VISTO }).eq('id', a.id).eq('estado', 'pendiente')
        r.cancelados++; continue
      }
      vivos.push(a)
    }

    // Por cliente: solo si al menos uno ya está en hora (los demás se adelantan para juntarlos).
    const porCliente = new Map<string, AvisoDiferido[]>()
    for (const a of vivos) porCliente.set(a.destinatario_id, [...(porCliente.get(a.destinatario_id) ?? []), a])
    for (const [clienteId, lista] of porCliente) {
      if (!lista.some((a) => new Date(a.programado_para).getTime() <= ahora.getTime())) continue
      if (lista.length === 1) { const x = await reintentarAviso(lista[0].id, admin); if (x.estado === 'enviado') r.enviados++; else if (x.estado === 'fallido') await alertaAdmin('tarea', `⚠️ No se pudo enviar un correo a un cliente (${esc(lista[0].plantilla)}). Reenvíalo desde la Bandeja.`).catch(() => false); continue }

      const asuntos: string[] = []; const usados: AvisoDiferido[] = []
      for (const a of lista) {
        try {
          const c = await PLANTILLAS[a.plantilla as NombrePlantilla]?.render(a.variables)
          if (!c?.correo) { await admin.from('avisos').update({ estado: 'cancelado', error: 'ya no aplica' }).eq('id', a.id); r.cancelados++; continue }
          asuntos.push(c.correo.asunto); usados.push(a)
        } catch (e) { console.error('[diferidos] no se pudo armar', a.id, e) }
      }
      if (usados.length === 0) continue
      if (usados.length === 1) { const x = await reintentarAviso(usados[0].id, admin); if (x.estado === 'enviado') r.enviados++; continue }
      const { data: u } = await admin.from('usuarios').select('email').eq('id', clienteId).maybeSingle()
      const correo = (u as { email: string | null } | null)?.email
      if (!correo) { for (const a of usados) await reintentarAviso(a.id, admin); continue } // sin correo: que cada aviso deje su fallo registrado
      try {
        const c = armarCorreoAgrupado(asuntos)
        await sendEmail({ to: correo, subject: c.asunto, html: c.html })
      } catch (e) { console.error('[diferidos] el correo agrupado no salió; cada aviso lo reintenta:', e); continue }
      for (const a of usados) await admin.from('avisos').update({ estado: 'enviado', error: NOTA_AGRUPADO, intentos: a.intentos + 1, ultimo_intento_en: ahora.toISOString() }).eq('id', a.id)
      r.enviados++; r.agrupados += usados.length
    }
  } catch (e) { console.error('[diferidos] error inesperado:', e) }
  return r
}
