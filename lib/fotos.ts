// Helper seguro para cliente: resuelve el src de una foto de visita sin exponer jamás el token del bot.
export function fotoSrc(m: { id: string; contenido: string | null }): string {
  const c = m.contenido ?? ''
  if (c.startsWith('tg:')) return `/api/foto/${m.id}`
  if (c.includes('/file/bot')) return '' // legado con token: nunca renderizar
  return c
}
