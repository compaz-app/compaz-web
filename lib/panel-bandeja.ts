// Datos de la Bandeja del panel nuevo (servidor). La query vive aquí, no en la página.
// El recorte de contactos se aplica ANTES de que los datos viajen al navegador (ver lib/panel-datos.ts).
// Cada tarea lleva su acción principal, calculada con los datos reales y los permisos de quien mira.

import { createAdminSupabase } from '@/lib/supabase-server'
import type { Actor } from '@/lib/permisos'
import { puede } from '@/lib/permisos'
import { recortarTexto } from '@/lib/panel-datos'
import { pausasActivas } from '@/lib/pausas'
import { reportesPendientes } from '@/lib/bloqueos-compita'
import { pendientesDeTodos } from '@/lib/solicitudes-pago'
import { avisoParaInsistir, esperaDeReenvio, reenviosDe } from '@/lib/insistir-aviso'
import {
  INFO_DECIDIR_CUENTA, INFO_LLAMADA, INFO_PAGO, INFO_SITIO, PERMISO_FALTA, claseInsistir, idReporteDeNota, ordenarTareas, textoCerrar, tipoDeAccion,
  type AccionTarea, type TareaBandeja,
} from '@/lib/panel-bandeja-tipos'

export const TOPE_BANDEJA = 500
const TIPOS_ENTIDAD = ['visita', 'compita', 'cliente'] as const

/** Tareas abiertas, ya ordenadas, con su acción y sin teléfonos ni correos si quien mira no tiene el permiso 'telefonos'. */
export async function cargarBandeja(actor: Actor): Promise<TareaBandeja[]> {
  const { data, error } = await createAdminSupabase()
    .from('admin_flags')
    .select('id, entidad_tipo, entidad_id, entidad_nombre, nota, reportado_por, created_at, tipo, prioridad')
    .eq('resuelto', false)
    .order('created_at', { ascending: true })
    .limit(TOPE_BANDEJA)
  if (error) throw new Error(`No se pudo leer la bandeja: ${error.message}`)
  const filas = (data ?? []).map((f): TareaBandeja => ({
    id: String(f.id),
    entidad_tipo: (TIPOS_ENTIDAD as readonly string[]).includes(f.entidad_tipo) ? f.entidad_tipo : 'cliente',
    entidad_id: String(f.entidad_id ?? ''),
    entidad_nombre: recortarTexto(actor, String(f.entidad_nombre ?? '')),
    // La nota SIN recortar se usa solo para sacar el id del reporte; al navegador viaja recortada.
    nota: recortarTexto(actor, String(f.nota ?? '')),
    reportado_por: String(f.reportado_por ?? ''),
    created_at: String(f.created_at),
    tipo: f.tipo ?? null,
    prioridad: typeof f.prioridad === 'number' ? f.prioridad : null,
  }))
  const ids = new Map((data ?? []).map((f) => [String(f.id), idReporteDeNota(String(f.nota ?? ''))]))
  return ordenarTareas(await conAcciones(actor, filas, ids))
}

async function conAcciones(actor: Actor, tareas: TareaBandeja[], reporteDe: Map<string, string | null>): Promise<TareaBandeja[]> {
  const necesita = (k: string) => tareas.some((t) => tipoDeAccion(t.tipo) === k)
  // Solo se piden los datos de las clases de tarea que hay abiertas.
  const [pausas, reportes, pagos] = await Promise.all([
    necesita('decidir') ? pausasActivas() : [], necesita('llamada') ? reportesPendientes() : [], necesita('pago') ? pendientesDeTodos() : new Map(),
  ])
  return Promise.all(tareas.map(async (t): Promise<TareaBandeja> => {
    const cerrar = (): AccionTarea => ({ tipo: 'cerrar', ...textoCerrar(t.tipo) })
    const bloqueada = (texto: string, motivo: string = PERMISO_FALTA): AccionTarea => ({ tipo: 'bloqueada', texto, motivo })
    switch (tipoDeAccion(t.tipo)) {
      case 'pago': {
        const sol = pagos.get(t.entidad_id)
        if (!sol) return { ...t, accion: cerrar() }
        return { ...t, accion: puede(actor, 'pagos') ? { tipo: 'pago', texto: 'Confirmar pago', info: INFO_PAGO, monto: Number(sol.monto_usd) || null } : bloqueada('Confirmar pago') }
      }
      case 'decidir': {
        const p = pausas.find((x) => x.persona_id === t.entidad_id && x.rol === t.entidad_tipo)
        if (!p) return { ...t, accion: cerrar() }
        const texto = p.rol === 'compita' ? 'Decidir sobre el compita' : 'Decidir sobre la cuenta'
        return { ...t, accion: puede(actor, 'cuentas') ? { tipo: 'decidir', texto, info: INFO_DECIDIR_CUENTA, pausa: { id: p.id, rol: p.rol, nombre: recortarTexto(actor, p.nombre), reincidente: p.reincidente, visitas_abiertas: p.visitas_abiertas } } : bloqueada(texto) }
      }
      case 'llamada': {
        const r = reportes.find((x) => x.id === reporteDe.get(t.id))
        if (!r) return { ...t, accion: cerrar() }
        return { ...t, accion: { tipo: 'llamada', texto: 'Registrar la llamada', info: INFO_LLAMADA, reporte: {
          id: r.id, compita_nombre: recortarTexto(actor, r.compita_nombre), cliente_nombre: recortarTexto(actor, r.cliente_nombre), motivo: r.motivo, plazo_llamada: r.plazo_llamada, vencido: r.vencido, abiertas: r.abiertas,
        } } }
      }
      default: {
        // Insistir con un aviso (solo si hay un aviso que reenviar) o contactar al sitio de una visita donde nadie abre.
        const clase = claseInsistir(t)
        if (clase) {
          if (!puede(actor, 'atender')) return { ...t, accion: cerrar() }
          const aviso = await avisoParaInsistir(t)
          if (!aviso) return { ...t, accion: cerrar() }
          const r = await reenviosDe(aviso.id)
          const espera = esperaDeReenvio(r)
          return { ...t, accion: espera ? bloqueada(clase.texto, `${espera.resumen} ${espera.porQue}`) : { tipo: 'insistir', texto: clase.texto, info: clase.info, reenvios: r.usados } }
        }
        if (t.tipo === 'nadie_abre' && t.entidad_tipo === 'visita') {
          return { ...t, accion: puede(actor, 'telefonos') ? { tipo: 'sitio', texto: 'Contactar al sitio', info: INFO_SITIO, visitaId: t.entidad_id } : bloqueada('Contactar al sitio') }
        }
        return { ...t, accion: cerrar() }
      }
    }
  }))
}
