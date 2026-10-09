// Correo al administrador cuando hay movimiento de pagos. Nunca lanza: un fallo de correo no debe romper el pago.
import { sendEmail, SITE_URL } from '@/lib/email'
import { esc } from '@/lib/html'

export async function emailAdminPago(asunto: string, detalle: string): Promise<void> {
  const destinos = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)
  if (destinos.length === 0) { console.error('[emailAdminPago] ADMIN_EMAILS vacío'); return }
  try {
    await sendEmail({
      to: destinos, subject: asunto,
      html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px">
        <h2 style="color:#2D1464;font-size:20px">${esc(asunto)}</h2>
        <p style="color:#4A3B6B;font-size:16px;line-height:1.6">${esc(detalle)}</p>
        <a href="${SITE_URL}/admin?tab=clientes" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:14px">Abrir el panel →</a></div>`,
    })
  } catch (e) { console.error('[emailAdminPago] falló:', e) }
}
