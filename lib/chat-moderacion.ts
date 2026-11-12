// Detección de datos de contacto en mensajes de chat entre compita y cliente.
// Al detectar: censura el texto, inserta aviso en el chat y crea un flag en Atención.

import { createAdminSupabase } from '@/lib/supabase-server'
import { avisarAdmin } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { detectarContacto } from '@/lib/detectar-contacto'
import { getAjuste } from '@/lib/ajustes'
import { registrarContactoBloqueado } from '@/lib/pausas'
export { detectarContacto }


// ── Aviso automático en el chat ───────────────────────────────────────────────


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
    contenido: String(await getAjuste('recordatorio_chat_contactos')),
  })

  // 2. Crear flag en Atención (entidad: visita)
  const quien = origen === 'cliente' ? clienteNombre : compitaNombre
  const nota =
    `Intento de contacto externo detectado en chat.\n` +
    `Quien envió: ${quien} (${origen})\n` +
    `Mensaje original: "${textoOriginal.slice(0, 200)}"`

  await admin.from('admin_flags').insert({
    entidad_tipo: 'visita',
    entidad_id: visitaId,
    entidad_nombre: `Contacto externo — ${compitaNombre} / ${clienteNombre}`,
    nota,
    reportado_por: 'moderación automática',
    resuelto: false,
  })

  // 3. Alerta Telegram al admin
  const msg =
    `<b>Contacto externo detectado</b>\n\n` +
    `Visita: <code>${visitaId.slice(0, 8)}</code>\n` +
    `Quien: ${quien} (${origen})\n` +
    `Compita: ${compitaNombre} · Cliente: ${clienteNombre}\n\n` +
    `Mensaje: <i>${textoOriginal.slice(0, 300)}</i>`

  await alertaAdmin('actividad', msg, { categoria: 'contacto_externo' }).catch(() => {})

  // 4. La segunda detección en 30 días pausa la cuenta de quien lo envió.
  await registrarContactoBloqueado({ rol: origen, personaId: origen === 'cliente' ? clienteId : compitaId, nombre: quien, donde: 'el chat' })
}

// ── Contacto externo en textos que no son el chat (solicitud, horarios sugeridos) ──
// Mismo criterio que el chat: el texto se censura antes de llegar a la otra parte y el equipo recibe una alerta.

/** Crea el flag en Atención y avisa al admin. Nunca lanza: reportar no debe romper el flujo. */
export async function reportarContactoEnTexto(p: {
  origen: 'cliente' | 'compita'
  /** dónde ocurrió, para la nota (ej. "la solicitud de entrevista") */
  donde: string
  quien: string
  entidadTipo: 'cliente' | 'compita'
  entidadId: string
  textoOriginal: string
}): Promise<void> {
  try {
    const admin = createAdminSupabase()
    await admin.from('admin_flags').insert({
      entidad_tipo: p.entidadTipo,
      entidad_id: p.entidadId,
      entidad_nombre: `Contacto externo — ${p.quien} (${p.origen})`,
      nota:
        `Intento de contacto externo detectado en ${p.donde}.\n` +
        `Quien lo escribió: ${p.quien} (${p.origen})\n` +
        `Texto original: "${p.textoOriginal.slice(0, 200)}"`,
      reportado_por: 'moderación automática',
      resuelto: false,
    })
    await alertaAdmin('actividad', 
      `<b>Contacto externo detectado</b>\n\n` +
      `Dónde: ${p.donde}\n` +
      `Quien: ${p.quien} (${p.origen})\n\n` +
      `Texto: <i>${p.textoOriginal.slice(0, 300)}</i>`,
    ).catch(() => {})
    await registrarContactoBloqueado({ rol: p.origen, personaId: p.entidadId, nombre: p.quien, donde: p.donde })
  } catch (e) {
    console.error('[moderación] no se pudo reportar el contacto externo:', e)
  }
}

