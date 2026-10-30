// Detección de datos de contacto en mensajes de chat entre compita y cliente.
// Al detectar: censura el texto, inserta aviso en el chat y crea un flag en Atención.

import { createAdminSupabase } from '@/lib/supabase-server'
import { avisarAdmin } from '@/lib/telegram'

// ── Patrones ──────────────────────────────────────────────────────────────────

const PATRONES: { regex: RegExp; censurar: (m: string) => string }[] = [
  // Teléfonos venezolanos: 0412 0414 0416 0422 0424 0426 + 7 dígitos (con espacios/guiones)
  {
    regex: /\b(04(?:1[246]|2[246])\s?[-.]?\s?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d)\b/g,
    censurar: (m) => m.replace(/[\d\s.-]{4}$/, '****'),
  },
  // Formato internacional +58...
  {
    regex: /\+58\s?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d/g,
    censurar: (m) => m.replace(/[\d\s.-]{4}$/, '****'),
  },
  // Correos electrónicos
  {
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    censurar: () => '[correo eliminado]',
  },
  // Menciones explícitas de canales externos
  {
    regex: /\b(whatsapp|instagram|telegram|mi\s+ig|mi\s+insta|escr[ií]beme\s+al|cont[aá]ctame\s+por|agrégame|add\s+me)\b/gi,
    censurar: (m) => m, // no se censura el texto, solo se detecta
  },
]

// ── Función principal ─────────────────────────────────────────────────────────

export function detectarContacto(texto: string): { detectado: boolean; textoCensurado: string } {
  let detectado = false
  let censurado = texto

  for (const { regex, censurar } of PATRONES) {
    regex.lastIndex = 0
    if (regex.test(texto)) {
      detectado = true
      regex.lastIndex = 0
      censurado = censurado.replace(regex, censurar)
    }
  }

  return { detectado, textoCensurado: censurado }
}

// ── Aviso automático en el chat ───────────────────────────────────────────────

const AVISO =
  '🚫 *Dato de contacto detectado y reportado al equipo Compaz.* ' +
  'Toda comunicación debe ocurrir en esta plataforma. ' +
  'Acordar servicios por fuera viola los términos y puede suspender tu cuenta sin reembolso.'

// ── Acción completa: aviso en chat + flag en Atención + Telegram al admin ─────

export async function moderarMensaje({
  visitaId,
  compitaNombre,
  clienteNombre,
  origen,
  textoOriginal,
  clienteId,
  compitaId,
}: {
  visitaId: string
  compitaNombre: string
  clienteNombre: string
  origen: 'cliente' | 'compita'
  textoOriginal: string
  clienteId: string
  compitaId: string
}): Promise<void> {
  const admin = createAdminSupabase()

  // 1. Insertar aviso en el chat (origen admin)
  await admin.from('mensajes').insert({
    visit_id: visitaId,
    origen: 'admin',
    tipo: 'texto',
    contenido: AVISO,
  })

  // 2. Crear flag en Atención (entidad: visita)
  const quien = origen === 'cliente' ? clienteNombre : compitaNombre
  const nota =
    `⚠️ Intento de contacto externo detectado en chat.\n` +
    `Quien envió: ${quien} (${origen})\n` +
    `Mensaje original: "${textoOriginal.slice(0, 200)}"`

  await admin.from('admin_flags').insert({
    entidad_tipo: 'visita',
    entidad_id: visitaId,
    entidad_nombre: `🚨 Contacto externo — ${compitaNombre} / ${clienteNombre}`,
    nota,
    reportado_por: 'moderación automática',
    resuelto: false,
  })

  // 3. Alerta Telegram al admin
  const msg =
    `⚠️ <b>Contacto externo detectado</b>\n\n` +
    `Visita: <code>${visitaId.slice(0, 8)}</code>\n` +
    `Quien: ${quien} (${origen})\n` +
    `Compita: ${compitaNombre} · Cliente: ${clienteNombre}\n\n` +
    `Mensaje: <i>${textoOriginal.slice(0, 300)}</i>`

  await avisarAdmin(msg).catch(() => {})
}
