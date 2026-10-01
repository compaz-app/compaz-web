import { Resend } from 'resend'
import type { Visita, Compita, Usuario, Mensaje } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'Compaz <visitas@micompaz.com>'

export async function sendVisitaInicio(
  usuario: Usuario,
  compita: Compita,
  visita: Visita
): Promise<void> {
  const hora = new Date(visita.inicio!).toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Caracas',
  })

  await resend.emails.send({
    from: FROM,
    to: usuario.email,
    subject: `${compita.nombre} llegó con tu familiar`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <img src="https://micompaz.com/logo.png" alt="Compaz" style="height: 40px; margin-bottom: 24px;" />
        <h2 style="color: #2D1464; font-size: 24px; margin-bottom: 16px;">
          ${compita.nombre} comenzó la visita
        </h2>
        <p style="color: #4A3B6B; font-size: 16px; line-height: 1.6;">
          ${compita.nombre} llegó a las <strong>${hora}</strong> y la visita ya está en curso.
        </p>
        <p style="color: #4A3B6B; font-size: 16px; line-height: 1.6;">
          Puedes seguirla en tiempo real desde tu portal:
        </p>
        <a href="https://micompaz.com/dashboard"
           style="display: inline-block; background: #FF6B2B; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; margin-top: 8px;">
          Ver visita en vivo
        </a>
        <p style="color: #6B5C90; font-size: 14px; margin-top: 32px;">
          Compaz — Cuidado con compañía
        </p>
      </div>
    `,
  })
}

export async function sendVisitaResumen(
  usuario: Usuario,
  compita: Compita,
  visita: Visita,
  mensajes: Mensaje[]
): Promise<void> {
  const inicio = new Date(visita.inicio!)
  const fin = new Date(visita.fin!)
  const duracionMs = fin.getTime() - inicio.getTime()
  const duracionMin = Math.round(duracionMs / 60000)
  const horas = Math.floor(duracionMin / 60)
  const minutos = duracionMin % 60
  const duracion = horas > 0 ? `${horas}h ${minutos}min` : `${minutos} minutos`

  const mensajesTexto = mensajes
    .filter((m) => m.tipo === 'texto')
    .map((m) => {
      const hora = new Date(m.created_at).toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Caracas',
      })
      const quien = m.origen === 'compita' ? compita.nombre : 'Tú'
      return `<tr>
        <td style="color: #6B5C90; font-size: 13px; padding: 4px 8px; white-space: nowrap;">${hora}</td>
        <td style="color: #4A3B6B; font-size: 14px; padding: 4px 8px;"><strong>${quien}:</strong> ${m.contenido}</td>
      </tr>`
    })
    .join('')

  const fotos = mensajes.filter((m) => m.tipo === 'foto')
  const fotosHtml = fotos.length > 0
    ? `<div style="margin-top: 24px;">
        <p style="color: #4A3B6B; font-size: 15px; font-weight: 600; margin-bottom: 12px;">Fotos de la visita</p>
        ${fotos.map((f) => `<img src="${f.contenido}" alt="Foto de la visita" style="max-width: 100%; border-radius: 12px; margin-bottom: 12px; display: block;" />`).join('')}
       </div>`
    : ''

  await resend.emails.send({
    from: FROM,
    to: usuario.email,
    subject: `Resumen de la visita de hoy con ${compita.nombre}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <img src="https://micompaz.com/logo.png" alt="Compaz" style="height: 40px; margin-bottom: 24px;" />
        <h2 style="color: #2D1464; font-size: 24px; margin-bottom: 8px;">
          Resumen de la visita
        </h2>
        <p style="color: #6B5C90; font-size: 15px; margin-bottom: 24px;">
          La visita de ${compita.nombre} duró <strong>${duracion}</strong>.
        </p>
        ${mensajesTexto ? `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          ${mensajesTexto}
        </table>` : ''}
        ${fotosHtml}
        <a href="https://micompaz.com/dashboard"
           style="display: inline-block; background: #2D1464; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; margin-top: 16px;">
          Ver historial completo
        </a>
        <p style="color: #6B5C90; font-size: 14px; margin-top: 32px;">
          Compaz — Cuidado con compañía
        </p>
      </div>
    `,
  })
}
