// Nota que se agrega, en TODOS los correos al cliente que traen un botón al portal, justo debajo del botón: si ya tiene el portal abierto no hace falta
// hacer clic (se actualiza solo) y así no abre una segunda pestaña. Se pone aquí, en un solo lugar, porque todos los correos salen por `sendEmail`.
// Es texto de correo: los colores van en línea porque un correo no admite variables CSS.

export const MARCA_NOTA_PORTAL = 'data-nota-portal-abierto'
export const TEXTO_NOTA_PORTAL = 'Si ya tienes tu portal abierto, no hace falta que hagas clic: se actualiza solo y lo verás ahí.'

// El primer enlace que lleva al portal (/dashboard o /portal), con todo lo que tenga dentro hasta su cierre.
const ENLACE_PORTAL = /<a\s[^>]*href="[^"]*\/(?:dashboard|portal)(?:[?#"][^"]*)?"[^>]*>[\s\S]*?<\/a>/i

/** Devuelve el correo con la nota debajo del botón al portal; si no hay botón al portal, o ya tiene la nota, lo deja igual. */
export function conNotaPortalAbierto(html: string): string {
  if (html.includes(MARCA_NOTA_PORTAL)) return html
  const m = ENLACE_PORTAL.exec(html)
  if (!m) return html
  const nota = `<p ${MARCA_NOTA_PORTAL}="1" style="color:#6B5C90;font-size:13px;line-height:1.5;margin:10px 0 0">${TEXTO_NOTA_PORTAL}</p>`
  const fin = m.index + m[0].length
  return html.slice(0, fin) + nota + html.slice(fin)
}
