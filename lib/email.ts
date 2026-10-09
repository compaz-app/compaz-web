// Único punto de envío de emails. El SDK de Resend NO lanza excepciones: devuelve { error }.
// Este wrapper convierte ese error en excepción para que los flags solo se marquen tras un envío real.
import { Resend } from 'resend'

let cliente: Resend | null = null
function getResend(): Resend {
  if (!cliente) cliente = new Resend(process.env.RESEND_API_KEY)
  return cliente
}

export const FROM = process.env.EMAIL_FROM ?? 'Compaz <visitas@micompaz.com>'
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://micompaz.com'

export async function sendEmail(p: { to: string | string[]; subject: string; html: string }): Promise<void> {
  const { error } = await getResend().emails.send({ from: FROM, ...p })
  if (error) throw new Error(`Resend: ${error.name}: ${error.message}`)
}
