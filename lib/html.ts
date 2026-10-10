// Escapado central para HTML (emails, páginas) y para Telegram (parse_mode HTML).
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escapa los comodines de ILIKE para búsquedas literales. */
export function escLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Solo permite rutas internas ("/algo"), nunca "//host" ni esquemas. */
export function rutaInterna(destino: string | null | undefined, fallback = '/dashboard'): string {
  if (!destino || /[\u0000-\u001f\u007f]/.test(destino) || !/^\/(?![/\\])/.test(destino)) return fallback
  return destino
}
