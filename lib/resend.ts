import { Resend } from 'resend'
import type { Visita, Compita, Usuario, Mensaje } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'Compaz <visitas@micompaz.com>'

export async function sendCodigoTelegram(email: string, nombre: string, codigo: string): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Tu código de verificación Compaz: ${codigo}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <p style="font-size: 16px; color: #1A0A3C;">Hola <strong>${nombre}</strong>,</p>
        <p style="font-size: 16px; color: #1A0A3C;">Tu código para activar tu cuenta en el bot de Telegram es:</p>
        <div style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #FF6B2B; text-align: center; padding: 24px 0;">${codigo}</div>
        <p style="font-size: 14px; color: #6B5C90;">Expira en 15 minutos. Ingrésalo en el chat de Telegram con el bot de Compaz.</p>
      </div>
    `,
  })
}

export async function sendBienvenidaCompita(
  email: string,
  nombre: string,
  telegramBotUsername: string,
): Promise<void> {
  const botUrl = `https://t.me/${telegramBotUsername}`
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `¡Bienvenido a Compaz, ${nombre}! Así funciona todo`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#FDFAF6">
        <img src="https://micompaz.com/logo.png" alt="Compaz" style="height:40px;margin-bottom:24px" />

        <h1 style="color:#2D1464;font-size:26px;margin-bottom:8px">¡Hola, ${nombre}! 👋</h1>
        <p style="color:#4A3B6B;font-size:16px;line-height:1.6;margin-bottom:24px">
          Ya eres parte de la familia Compaz. Aquí te explicamos todo lo que necesitas saber para comenzar.
        </p>

        <!-- Paso 1 -->
        <div style="background:white;border:2px solid #E8E0D4;border-radius:16px;padding:24px;margin-bottom:16px">
          <p style="color:#FF6B2B;font-weight:800;font-size:13px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:1px">Paso 1</p>
          <h2 style="color:#2D1464;font-size:18px;margin:0 0 12px 0">Conecta tu Telegram 📱</h2>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0 0 16px 0">
            Toda la comunicación con Compaz es a través de Telegram. Así recibirás solicitudes de clientes, confirmaciones de llamadas y mucho más.
          </p>
          <ol style="color:#4A3B6B;font-size:15px;line-height:2;padding-left:20px;margin:0 0 16px 0">
            <li>Abre Telegram y busca <strong>@${telegramBotUsername}</strong></li>
            <li>Pulsa <strong>Iniciar</strong> o escribe <strong>/start</strong></li>
            <li>El bot te pedirá tu nombre completo. Escríbelo tal como apareces aquí.</li>
            <li>Te enviará un código de 6 dígitos a este correo.</li>
            <li>Ingresa ese código en el chat para activar tu cuenta.</li>
          </ol>
          <a href="${botUrl}" style="display:inline-block;background:#FF6B2B;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:15px">
            Abrir bot de Telegram →
          </a>
        </div>

        <!-- Paso 2 -->
        <div style="background:white;border:2px solid #E8E0D4;border-radius:16px;padding:24px;margin-bottom:16px">
          <p style="color:#FF6B2B;font-weight:800;font-size:13px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:1px">Paso 2</p>
          <h2 style="color:#2D1464;font-size:18px;margin:0 0 12px 0">Completa tu perfil ✏️</h2>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0 0 12px 0">
            Un perfil completo atrae más familias. Desde Telegram puedes escribir <strong>/perfil</strong> para obtener un enlace directo a tu página de edición.
          </p>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0">
            Desde ahí puedes actualizar tu foto 📸, tu descripción personal ✍️, los servicios que ofreces 🛎️, tus horarios disponibles 🕐 y agregar un video de presentación en YouTube 🎥. Mientras más completo esté tu perfil, más fácil será que las familias te escojan.
          </p>
        </div>

        <!-- Paso 3 -->
        <div style="background:white;border:2px solid #E8E0D4;border-radius:16px;padding:24px;margin-bottom:24px">
          <p style="color:#FF6B2B;font-weight:800;font-size:13px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:1px">Paso 3</p>
          <h2 style="color:#2D1464;font-size:18px;margin:0 0 12px 0">Espera a que lleguen clientes 🤝</h2>
          <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin:0">
            Cuando una familia quiera conocerte, recibirás un mensaje de Telegram con los detalles. Desde ahí puedes <strong>aceptar o rechazar</strong> la solicitud y escoger el horario de la videollamada.
          </p>
        </div>

        <!-- Comandos útiles -->
        <div style="background:#F5F0FF;border-radius:16px;padding:20px;margin-bottom:24px">
          <h3 style="color:#2D1464;font-size:16px;margin:0 0 12px 0">Comandos útiles en Telegram</h3>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#FF6B2B;font-weight:700;font-size:14px;padding:4px 8px;white-space:nowrap">/menu</td><td style="color:#4A3B6B;font-size:14px;padding:4px 8px">Ver todas las opciones disponibles</td></tr>
            <tr><td style="color:#FF6B2B;font-weight:700;font-size:14px;padding:4px 8px;white-space:nowrap">/perfil</td><td style="color:#4A3B6B;font-size:14px;padding:4px 8px">Obtener tu enlace para editar tu perfil</td></tr>
            <tr><td style="color:#FF6B2B;font-weight:700;font-size:14px;padding:4px 8px;white-space:nowrap">/visita</td><td style="color:#4A3B6B;font-size:14px;padding:4px 8px">Ver tu visita activa (si tienes una)</td></tr>
            <tr><td style="color:#FF6B2B;font-weight:700;font-size:14px;padding:4px 8px;white-space:nowrap">/ayuda</td><td style="color:#4A3B6B;font-size:14px;padding:4px 8px">Contactar al equipo Compaz</td></tr>
          </table>
        </div>

        <p style="color:#4A3B6B;font-size:15px;line-height:1.6;margin-bottom:8px">
          Cualquier duda, escríbenos directamente en Telegram o responde a este correo. ¡Estamos para ayudarte!
        </p>
        <p style="color:#2D1464;font-size:15px;font-weight:700;margin-bottom:32px">El equipo Compaz 💙</p>
        <p style="color:#9990A8;font-size:13px;margin:0">Compaz — <em>Cerca aunque estés lejos</em></p>
      </div>
    `,
  })
}

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
          Compaz — <em>Cerca aunque estés lejos</em>
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
          Compaz — <em>Cerca aunque estés lejos</em>
        </p>
      </div>
    `,
  })
}
