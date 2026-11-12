// Escalera de respaldo de los avisos (la corre el cron escalera-avisos cada 5 minutos).
// Se mide la ACCIÓN de la persona, no la entrega: un aviso entregado que nadie atiende también escala.
//   1. Avisos que quedaron "pendiente" porque el servidor se cayó entre guardarlos y enviarlos: se despachan.
//   2. Avisos fallidos por una causa pasajera: se reintentan unas pocas veces.
//   3. Avisos enviados sin acción cuyo plazo venció: primero un respaldo por correo, y si tampoco hay acción,
//      una tarea para el equipo (alerta en Atención y aviso al admin).
// Ver docs/ciclo-comunicaciones.md (regla 7) y docs/esquema-avisos-eventos.md.

import { createAdminSupabase } from '@/lib/supabase-server'
import { avisarAdmin } from '@/lib/telegram'
import { alertaAdmin } from '@/lib/alertas-admin'
import { esc } from '@/lib/html'
import { notificar, reintentarAviso } from '@/lib/avisos'
import { PLANTILLAS, type Canal, type NombrePlantilla, type VariablesAviso } from '@/lib/plantillas-aviso'
import type { EntidadEvento } from '@/lib/eventos'

type Admin = ReturnType<typeof createAdminSupabase>

const ESPERA_PENDIENTE_MIN = 3
const ESPERA_REINTENTO_MIN = 5
const REINTENTOS_AUTOMATICOS = 3
const LOTE = 50
/** Fallos que no se arreglan reintentando: el siguiente paso es el respaldo o la tarea, no repetir. */
const ERRORES_PERMANENTES = ['sin Telegram vinculado', 'sin correo registrado', 'ya no aplica', 'plantilla o canal no soportado']

interface Regla {
  /** Canal del respaldo cuando el aviso original no tuvo acción. null: no hay respaldo, va directo a la tarea. */
  respaldo: { canal: Canal } | null
  /** Minutos que se espera una acción tras el respaldo antes de abrir la tarea para el equipo. */
  siguienteMin: number
}

// Una regla por plantilla que espera acción de la persona. Las demás (informativas) no escalan.
const REGLAS: Partial<Record<NombrePlantilla, Regla>> = {
  solicitud_nueva: { respaldo: { canal: 'correo' }, siguienteMin: 18 * 60 },
  llamada_terminada_cliente: { respaldo: { canal: 'correo' }, siguienteMin: 22 * 60 },
}

interface Fila {
  id: string
  destinatario_tipo: 'cliente' | 'compita' | 'admin'
  destinatario_id: string | null
  canal: Canal
  plantilla: string
  variables: VariablesAviso
  entidad: string | null
  entidad_id: string | null
  paso: number | null
  respaldo_de: string | null
  estado: string
  intentos: number
  error: string | null
}
const COLUMNAS = 'id, destinatario_tipo, destinatario_id, canal, plantilla, variables, entidad, entidad_id, paso, respaldo_de, estado, intentos, error'

export interface ResultadoEscalera {
  barridos: number
  reintentos: number
  respaldos: number
  tareas: number
  cancelados: number
}

async function tieneRespaldo(admin: Admin, id: string): Promise<boolean> {
  const { data } = await admin.from('avisos').select('id').eq('respaldo_de', id).limit(1)
  return (data ?? []).length > 0
}

/** Deja de vigilar el aviso (ya escaló o ya no hace falta). */
async function cerrar(admin: Admin, id: string): Promise<void> {
  await admin.from('avisos').update({ plazo_accion_hasta: null }).eq('id', id)
}

/** Textos de la tarea para el equipo. */
async function describir(admin: Admin, v: Fila): Promise<{ titulo: string; nota: string }> {
  let cliente = 'el cliente'
  let compita = 'el compita'
  if (v.entidad === 'solicitud' && v.entidad_id) {
    const { data: s } = await admin.from('solicitudes').select('cliente_id, compita_id').eq('id', v.entidad_id).maybeSingle()
    if (s) {
      const [{ data: c }, { data: m }] = await Promise.all([
        admin.from('usuarios').select('nombre').eq('id', s.cliente_id).maybeSingle(),
        admin.from('compitas').select('nombre').eq('id', s.compita_id).maybeSingle(),
      ])
      cliente = c?.nombre ?? cliente
      compita = m?.nombre ?? compita
    }
  }
  if (v.plantilla === 'solicitud_nueva') {
    return {
      titulo: `${compita} no respondió una solicitud`,
      nota: `${compita} no ha respondido la solicitud de entrevista de ${cliente}. Se le avisó por Telegram y por correo. Contáctalo para que responda, o ofrécele al cliente otro compita.`,
    }
  }
  return {
    titulo: `${cliente} no ha decidido`,
    nota: `${cliente} no ha decidido si contrata a ${compita} después de la entrevista. Se le preguntó por correo y se le recordó. Contáctalo.`,
  }
}

/**
 * Abre la tarea para el equipo. Es idempotente: antes deja una marca con clave única, así que dos corridas
 * del cron (o dos instancias a la vez) no crean dos tareas. Devuelve true si la creó.
 */
async function crearTarea(admin: Admin, raizId: string, v: Fila): Promise<boolean> {
  const { error } = await admin.from('avisos').insert({
    destinatario_tipo: 'admin', canal: 'telegram', plantilla: 'escalera_tarea', estado: 'enviado',
    entidad: v.entidad, entidad_id: v.entidad_id, paso: v.paso, respaldo_de: raizId,
    clave_unica: `escalera_tarea:${raizId}`,
  })
  if (error) return false // ya existía (o no se pudo guardar): no se duplica

  const { titulo, nota } = await describir(admin, v)
  await admin.from('admin_flags').insert({
    entidad_tipo: v.destinatario_tipo === 'compita' ? 'compita' : 'cliente',
    entidad_id: v.destinatario_id ?? 'sin-id',
    entidad_nombre: `Sin respuesta: ${titulo}`,
    nota,
    reportado_por: 'escalera automática',
    resuelto: false,
  })
  await alertaAdmin('actividad', `<b>${esc(titulo)}</b>\n\n${esc(nota)}`).catch(() => false)
  return true
}

export async function procesarEscalera(admin: Admin = createAdminSupabase()): Promise<ResultadoEscalera> {
  const r: ResultadoEscalera = { barridos: 0, reintentos: 0, respaldos: 0, tareas: 0, cancelados: 0 }
  const ahora = Date.now()
  const hace = (min: number) => new Date(ahora - min * 60_000).toISOString()

  // 1. Pendientes atascados (el servidor se cayó entre guardar y enviar)
  try {
    const { data } = await admin.from('avisos').select('id').eq('estado', 'pendiente').lte('programado_para', hace(ESPERA_PENDIENTE_MIN)).limit(LOTE)
    for (const a of data ?? []) {
      await reintentarAviso(a.id as string, admin)
      r.barridos++
    }
  } catch (e) { console.error('[escalera] pendientes:', e) }

  // 2. Fallidos por causas pasajeras
  try {
    const { data } = await admin.from('avisos').select(COLUMNAS).eq('estado', 'fallido').lt('intentos', REINTENTOS_AUTOMATICOS).lte('ultimo_intento_en', hace(ESPERA_REINTENTO_MIN)).limit(LOTE)
    for (const f of (data ?? []) as Fila[]) {
      if (ERRORES_PERMANENTES.some((e) => (f.error ?? '').startsWith(e))) continue
      if (await tieneRespaldo(admin, f.id)) continue // el respaldo ya salió: reintentar el original lo duplicaría
      await reintentarAviso(f.id, admin)
      r.reintentos++
    }
  } catch (e) { console.error('[escalera] fallidos:', e) }

  // 3. Enviados sin acción cuyo plazo venció
  try {
    const { data } = await admin.from('avisos').select(COLUMNAS).eq('estado', 'enviado').is('accion_en', null).lte('plazo_accion_hasta', new Date(ahora).toISOString()).limit(LOTE)
    for (const v of (data ?? []) as Fila[]) {
      try {
        const regla = REGLAS[v.plantilla as NombrePlantilla]
        if (!regla) { await cerrar(admin, v.id); continue }

        // ¿El hecho sigue vigente? (la plantilla sabe si la persona ya respondió por otro camino)
        let vigente = true
        try { vigente = (await PLANTILLAS[v.plantilla as NombrePlantilla].render(v.variables)) !== null } catch { vigente = true }
        if (!vigente) {
          await admin.from('avisos').update({ estado: 'cancelado', error: 'ya no aplica', plazo_accion_hasta: null }).eq('id', v.id)
          r.cancelados++
          continue
        }

        const raizId = v.respaldo_de ?? v.id
        if (!v.respaldo_de) {
          if (await tieneRespaldo(admin, v.id)) { await cerrar(admin, v.id); continue } // el respaldo ya vigila
          if (regla.respaldo) {
            const res = await notificar({
              plantilla: v.plantilla as NombrePlantilla,
              canal: regla.respaldo.canal,
              destinatario: { tipo: v.destinatario_tipo, id: v.destinatario_id ?? undefined },
              variables: { ...v.variables, recordatorio: true },
              entidad: (v.entidad ?? undefined) as EntidadEvento | undefined,
              entidadId: v.entidad_id ?? undefined,
              paso: v.paso ?? undefined,
              plazoAccionMin: regla.siguienteMin,
              claveUnica: `respaldo:${v.id}`,
              respaldoDe: v.id,
            }, admin)
            await cerrar(admin, v.id)
            if (res.ok) { r.respaldos++; continue }
            // el respaldo tampoco se pudo (sin correo, por ejemplo): va directo a la tarea
          }
        }
        if (await crearTarea(admin, raizId, v)) r.tareas++
        await cerrar(admin, v.id)
      } catch (e) { console.error('[escalera] aviso', v.id, e) }
    }
  } catch (e) { console.error('[escalera] sin acción:', e) }

  return r
}
