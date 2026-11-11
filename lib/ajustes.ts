// Ajustes: fuente única de precios, plazos, topes y textos que el administrador puede cambiar sin tocar el código.
// El CATÁLOGO de abajo tiene el valor por defecto de cada ajuste (precios desde lib/planes.ts). La tabla `ajustes`
// solo guarda lo que el administrador cambió. Si falta una fila, está inválida o la base falla, se usa el valor del
// catálogo: el sistema nunca se rompe por un ajuste. Cada cambio queda en `ajustes_historial` (solo inserción).
// Ver docs/construccion-real.md y docs/plan-construccion.md ("AJUSTES COMO FUENTE ÚNICA").

import { createAdminSupabase } from '@/lib/supabase-server'
import { PLANES, PRECIO_HORA_EXTRA_USD, PRECIO_MANDADO_USD } from '@/lib/planes'

export type TipoAjuste = 'numero' | 'texto'
export type ValorAjuste = number | string

export interface DefAjuste {
  clave: string
  grupo: 'Precios' | 'Pagos' | 'Plazos de las citas' |'Cancelaciones de compitas' | 'Ayuda automática' | 'Llamadas' | 'Seguridad y datos'
  etiqueta: string
  tipo: TipoAjuste
  defecto: ValorAjuste
  unidad?: '$' | 'h' | 'min' | 'días' | '%'
  min?: number
  max?: number
  /** Dónde se usa: es lo que el administrador ve antes de guardar un cambio. */
  usa: string[]
  /** true cuando la cifra es una propuesta todavía sin confirmar por el dueño. */
  propuesto?: boolean
}

const TEXTO_ANTIFRAUDE_CLIENTE = 'Compaz nunca te pedirá por teléfono, mensaje o llamada tus datos personales, claves, códigos, depósitos ni transferencias. Los pagos se hacen solo con los datos que ves aquí, en tu portal. Si alguien te los pide por otro medio, no respondas y avísanos.'
const TEXTO_ANTIFRAUDE_COMPITA = 'Compaz nunca te pedirá por teléfono o mensaje dinero, depósitos, transferencias ni claves, y nunca te da el contacto del cliente. Si alguien te los pide en nombre de Compaz, no respondas y avísanos aquí.'

export const CATALOGO = [
  // ── Precios
  { clave: 'precio_hora', grupo: 'Precios', etiqueta: 'Hora de servicio', tipo: 'numero', defecto: PRECIO_HORA_EXTRA_USD, unidad: '$', min: 1, max: 500, usa: ['Página de pago', 'Agendar otra visita', 'Registrar pago (admin)', 'Correos de pago', 'Asistente de la página', 'Precio tachado de los planes'] },
  { clave: 'precio_mandado', grupo: 'Precios', etiqueta: 'Mandado (tarifa plana, máximo 1 hora)', tipo: 'numero', defecto: PRECIO_MANDADO_USD, unidad: '$', min: 1, max: 500, usa: ['Formulario de mandado', 'Aviso al compita', 'Correos de pago', 'Asistente de la página'] },
  { clave: 'precio_plan_quincenal', grupo: 'Precios', etiqueta: 'Plan Compañía (2 visitas de 2 h)', tipo: 'numero', defecto: PLANES.quincenal.precioUsd, unidad: '$', min: 1, max: 5000, usa: ['Página de pago', 'Registrar pago (admin)', 'Correos de pago', 'Asistente de la página'] },
  { clave: 'precio_plan_semanal', grupo: 'Precios', etiqueta: 'Plan Compañía Plus (4 visitas de 2 h)', tipo: 'numero', defecto: PLANES.semanal.precioUsd, unidad: '$', min: 1, max: 5000, usa: ['Página de pago', 'Registrar pago (admin)', 'Correos de pago', 'Asistente de la página'] },
  // ── Plazos de las citas
  { clave: 'cancelacion_gratis_horas', grupo: 'Plazos de las citas', etiqueta: 'Cancelación gratuita, horas antes', tipo: 'numero', defecto: 24, unidad: 'h', min: 1, max: 168, usa: ['Portal del cliente (cambiar o cancelar)', 'Términos que acepta el cliente', 'Regla de "cuenta como usada"', 'Avisos al compita'] },
  { clave: 'nadie_abre_espera_min', grupo: 'Plazos de las citas', etiqueta: 'Espera si nadie abre', tipo: 'numero', defecto: 30, unidad: 'min', min: 10, max: 120, usa: ['Cuenta atrás del cliente', 'Aviso al compita', 'Cierre automático', 'Términos que acepta el cliente'] },
  { clave: 'nadie_abre_contacto1_min', grupo: 'Plazos de las citas', etiqueta: 'Primer contacto si nadie abre', tipo: 'numero', defecto: 5, unidad: 'min', min: 1, max: 60, usa: ['Tarea en la Bandeja', 'Mensaje al contacto en el sitio'] },
  { clave: 'nadie_abre_contacto2_min', grupo: 'Plazos de las citas', etiqueta: 'Segundo contacto si nadie abre', tipo: 'numero', defecto: 15, unidad: 'min', min: 2, max: 90, usa: ['Tarea en la Bandeja', 'Mensaje al contacto en el sitio'] },
  { clave: 'reporte_llamada_horas', grupo: 'Plazos de las citas', etiqueta: 'Plazo para llamar al compita que reportó un problema con un cliente', tipo: 'numero', defecto: 24, unidad: 'h', min: 24, max: 72, usa: ['Mensaje al compita con el plazo', 'Tarea y alerta si se pasa el plazo'] },
  { clave: 'todo_bien_min', grupo: 'Plazos de las citas', etiqueta: '"¿Todo bien?" después de la hora de fin', tipo: 'numero', defecto: 15, unidad: 'min', min: 5, max: 120, usa: ['Aviso al compita', 'Alerta al equipo si no responde'] },
  { clave: 'cambio_lugar_pct', grupo: 'Plazos de las citas', etiqueta: 'Cambio en el lugar sin respuesta del compita: avisar al admin tras este % del tiempo que falta para la visita', tipo: 'numero', defecto: 25, unidad: '%', min: 5, max: 100, usa: ['Tarea "Cambio en el lugar" en la Bandeja'] },
  { clave: 'cambio_lugar_max_horas', grupo: 'Plazos de las citas', etiqueta: 'Cambio en el lugar: espera máxima antes de avisar al admin', tipo: 'numero', defecto: 6, unidad: 'h', min: 1, max: 48, usa: ['Tarea "Cambio en el lugar" en la Bandeja'] },
  { clave: 'todo_bien_respuesta_min', grupo: 'Plazos de las citas', etiqueta: 'Minutos para responder al "¿Todo bien?" antes de alertar al equipo', tipo: 'numero', defecto: 10, unidad: 'min', min: 3, max: 60, usa: ['Alerta urgente al equipo si el compita no responde'] },
  { clave: 'direccion_horas_antes', grupo: 'Plazos de las citas', etiqueta: 'Dirección exacta al compita, horas antes', tipo: 'numero', defecto: 3, unidad: 'h', min: 1, max: 24, usa: ['Aviso al compita en Telegram'] },
  { clave: 'reserva_horario_horas', grupo: 'Plazos de las citas', etiqueta: 'Reserva de un horario sin confirmar, horas (nunca pasa de la hora de la cita)', tipo: 'numero', defecto: 2, unidad: 'h', min: 1, max: 48, usa: ['Reserva de la entrevista', 'Recordatorio al compita'] },
  { clave: 'entrevista_anticipacion_horas', grupo: 'Plazos de las citas', etiqueta: 'Anticipación mínima para pedir una entrevista (0 = sin mínimo)', tipo: 'numero', defecto: 0, unidad: 'h', min: 0, max: 72, usa: ['Horas libres que ve el cliente'] },
  // ── Pagos
  { clave: 'pago_insistencia_min', grupo: 'Pagos', etiqueta: 'Entre alertas URGENTES cuando el cliente insiste en que ya pagó', tipo: 'numero', defecto: 30, unidad: 'min', min: 5, max: 240, usa: ['Aviso URGENTE de pago al equipo en Telegram'] },
  { clave: 'pago_escalada_horas', grupo: 'Pagos', etiqueta: 'Horas sin confirmar un pago insistido antes de avisar a todos los administradores por correo', tipo: 'numero', defecto: 6, unidad: 'h', min: 1, max: 72, usa: ['Correo a los administradores', 'Aviso en Telegram'] },
  // ── Cancelaciones de compitas
  { clave: 'compita_aviso_minimo_horas', grupo: 'Cancelaciones de compitas', etiqueta: 'Aviso mínimo para que una cancelación sea a tiempo', tipo: 'numero', defecto: 24, unidad: 'h', min: 1, max: 168, usa: ['Columna y filtro de Personas', 'Ficha del compita', 'Aviso al compita al cancelar'] },
  { clave: 'canc_revision', grupo: 'Cancelaciones de compitas', etiqueta: 'Cancelaciones tardías para abrir una revisión', tipo: 'numero', defecto: 2, min: 1, max: 10, usa: ['Bandeja (tarea "Cancelación tardía")', 'Semáforo del compita (amarillo)'] },
  { clave: 'canc_pausa', grupo: 'Cancelaciones de compitas', etiqueta: 'Cancelaciones tardías para pausar sus solicitudes nuevas', tipo: 'numero', defecto: 3, min: 2, max: 20, usa: ['Solicitudes nuevas del compita', 'Semáforo del compita (rojo)', 'Bandeja'] },
  { clave: 'canc_ventana_dias', grupo: 'Cancelaciones de compitas', etiqueta: 'Ventana para contar las cancelaciones', tipo: 'numero', defecto: 30, unidad: 'días', min: 7, max: 365, usa: ['Columna y filtro de Personas', 'Ficha del compita'] },
  // ── Ayuda automática
  { clave: 'ayuda_intentos', grupo: 'Ayuda automática', etiqueta: 'Intentos del bot antes de pasar la duda a una persona', tipo: 'numero', defecto: 2, min: 1, max: 5, usa: ['Menú "Tengo una duda" del compita', 'Tarea "Duda sin resolver" en la Bandeja', 'Ayuda del cliente'] },
  { clave: 'timbre_max_hora', grupo: 'Ayuda automática', etiqueta: 'Máximo de urgencias por hora que suenan por Telegram (el resto se resume en un solo mensaje)', tipo: 'numero', defecto: 8, min: 1, max: 60, usa: ['Telegram del administrador', 'Bandeja del panel'] },
  { clave: 'recordatorio_cliente_horas', grupo: 'Ayuda automática', etiqueta: 'Horas mínimas entre un recordatorio y otro que el compita le manda al cliente', tipo: 'numero', defecto: 12, unidad: 'h', min: 1, max: 72, usa: ['Botón "Recordarle al cliente" del compita'] },
  { clave: 'recordatorio_cliente_max', grupo: 'Ayuda automática', etiqueta: 'Máximo de recordatorios al cliente por el mismo pendiente', tipo: 'numero', defecto: 3, min: 1, max: 10, usa: ['Botón "Recordarle al cliente" del compita'] },
  // ── Llamadas (sin límite de cantidad: solo de duración)
  { clave: 'llamada_aviso_min', grupo: 'Llamadas', etiqueta: 'Aviso de fin de una llamada fuera de visita', tipo: 'numero', defecto: 20, unidad: 'min', min: 5, max: 60, usa: ['Videollamadas', 'Llamadas de voz', 'Aviso de fin dentro de la sala'] },
  { clave: 'llamada_corte_min', grupo: 'Llamadas', etiqueta: 'Corte automático de la llamada', tipo: 'numero', defecto: 23, unidad: 'min', min: 6, max: 70, usa: ['Salas de videollamada', 'Costo de la videollamada'] },
  { clave: 'llamada_visita_min', grupo: 'Llamadas', etiqueta: 'Llamada durante una visita', tipo: 'numero', defecto: 5, unidad: 'min', min: 1, max: 20, usa: ['Botón "Llamar al cliente"', 'Aviso en la sala'] },
  // ── Seguridad y datos
  { clave: 'antifraude_cliente', grupo: 'Seguridad y datos', etiqueta: 'Texto de la advertencia antifraude para clientes (no se puede quitar, solo cambiar el texto)', tipo: 'texto', defecto: TEXTO_ANTIFRAUDE_CLIENTE, max: 600, usa: ['Pantalla de acceso', 'Tarjeta de pago', 'Ficha', 'Chat de la visita', 'Pie del portal', 'Correos'] },
  { clave: 'antifraude_compita', grupo: 'Seguridad y datos', etiqueta: 'Texto de la advertencia antifraude para compitas (no se puede quitar, solo cambiar el texto)', tipo: 'texto', defecto: TEXTO_ANTIFRAUDE_COMPITA, max: 600, usa: ['Telegram del compita', 'Correo de bienvenida del compita'] },
  { clave: 'recordatorio_chat_contactos', grupo: 'Seguridad y datos', etiqueta: 'Recordatorio visible en el chat sobre no compartir contactos (no se puede quitar, solo cambiar el texto)', tipo: 'texto', defecto: 'Recuerda: no se pueden compartir teléfonos, correos ni otros contactos directos. Es por seguridad y quien lo haga puede ser penalizado.', max: 400, usa: ['Chat de coordinación y de la visita (cliente)', 'Aviso al compita al abrir la coordinación'] },
  { clave: 'detecciones_umbral', grupo: 'Seguridad y datos', etiqueta: 'Detecciones de contacto antes de alertar al equipo', tipo: 'numero', defecto: 2, min: 1, max: 10, usa: ['Aviso al escribir', 'Alerta en la Bandeja', 'Ficha de la persona'] },
  { clave: 'detecciones_ventana_dias', grupo: 'Seguridad y datos', etiqueta: 'Ventana para contar las detecciones', tipo: 'numero', defecto: 30, unidad: 'días', min: 1, max: 365, usa: ['Conteo por persona'] },
  { clave: 'cita_recordatorio_horas', grupo: 'Plazos de las citas', etiqueta: 'Recordar al compita que confirme la cita de la visita tras estas horas sin respuesta', tipo: 'numero', defecto: 6, unidad: 'h', min: 1, max: 48, usa: ['Recordatorio por Telegram al compita'] },
  { clave: 'cita_escalada_horas', grupo: 'Plazos de las citas', etiqueta: 'Avisar al equipo y al cliente si el compita no confirma la cita tras estas horas', tipo: 'numero', defecto: 24, unidad: 'h', min: 2, max: 96, usa: ['Tarea en la Bandeja', 'Correo al cliente'] },
  { clave: 'portal_nuevo', grupo: 'Seguridad y datos', etiqueta: 'Portal nuevo del cliente (1 = lo ven todos los clientes, 0 = solo el equipo en vista previa; así se reemplaza el viejo por etapas)', tipo: 'numero', defecto: 0, min: 0, max: 1, usa: ['Ruta /portal del cliente', 'Portal actual (/dashboard)'] },
  { clave: 'llegada_foto_obligatoria', grupo: 'Seguridad y datos', etiqueta: 'Foto de llegada obligatoria antes de iniciar la visita (1 = sí, 0 = no)', tipo: 'numero', defecto: 1, min: 0, max: 1, usa: ['Bot del compita (botón Iniciar visita)', 'Aviso de llegada al cliente'] },
  { clave: 'foto_retencion_dias', grupo: 'Seguridad y datos', etiqueta: 'Borrado de fotos privadas (llegada, cliente, familiar)', tipo: 'numero', defecto: 90, unidad: 'días', min: 7, max: 730, usa: ['Limpieza diaria', 'Aviso al cliente y al compita', 'Términos y /privacidad'] },
  { clave: 'avisos_retencion_dias', grupo: 'Seguridad y datos', etiqueta: 'Retención del registro de avisos', tipo: 'numero', defecto: 90, unidad: 'días', min: 30, max: 730, usa: ['Limpieza diaria'] },
] as const satisfies readonly DefAjuste[]

export type ClaveAjuste = (typeof CATALOGO)[number]['clave']
export type Ajustes = Record<ClaveAjuste, ValorAjuste>

const POR_CLAVE = new Map<string, DefAjuste>(CATALOGO.map((d) => [d.clave, d]))

export function defAjuste(clave: string): DefAjuste | undefined {
  return POR_CLAVE.get(clave)
}

/** Valores por defecto de todo el catálogo (lo que rige si la base está vacía o no responde). */
export function ajustesPorDefecto(): Ajustes {
  return Object.fromEntries(CATALOGO.map((d) => [d.clave, d.defecto])) as Ajustes
}

// ── Validación ─────────────────────────────────────────────────────────────────────────────────────

export type ResultadoValidacion = { ok: true; valor: ValorAjuste } | { ok: false; error: string }

/** Valida un valor contra la definición de su ajuste (tipo, mínimo y máximo). */
export function validarValor(clave: string, crudo: unknown): ResultadoValidacion {
  const d = POR_CLAVE.get(clave)
  if (!d) return { ok: false, error: 'Ajuste desconocido' }
  if (d.tipo === 'texto') {
    if (typeof crudo !== 'string') return { ok: false, error: 'Debe ser un texto' }
    const t = crudo.trim()
    if (!t) return { ok: false, error: 'No puede quedar vacío' }
    if (d.max !== undefined && t.length > d.max) return { ok: false, error: `Máximo ${d.max} caracteres` }
    return { ok: true, valor: t }
  }
  const n = typeof crudo === 'string' && crudo.trim() !== '' ? Number(crudo) : crudo
  if (typeof n !== 'number' || !Number.isFinite(n)) return { ok: false, error: 'Debe ser un número' }
  if (d.min !== undefined && n < d.min) return { ok: false, error: `Debe estar entre ${d.min} y ${d.max}` }
  if (d.max !== undefined && n > d.max) return { ok: false, error: `Debe estar entre ${d.min} y ${d.max}` }
  return { ok: true, valor: n }
}

/** Reglas que relacionan varios ajustes entre sí. Devuelve el mensaje del primer conflicto, o null. */
export function conflictoEntreAjustes(v: Ajustes): string | null {
  const n = (k: ClaveAjuste) => Number(v[k])
  if (n('llamada_corte_min') <= n('llamada_aviso_min')) return 'El corte de la llamada debe ser posterior al aviso de fin'
  if (n('canc_pausa') <= n('canc_revision')) return 'Las cancelaciones para pausar deben ser más que las de la revisión'
  if (n('nadie_abre_contacto1_min') >= n('nadie_abre_contacto2_min')) return 'El primer contacto debe ser antes que el segundo'
  if (n('nadie_abre_contacto2_min') >= n('nadie_abre_espera_min')) return 'El segundo contacto debe ser antes de que termine la espera'
  return null
}

/** Un plan que sale más caro que comprar las mismas horas sueltas no tiene sentido comercial. */
export function planesIncoherentes(v: Ajustes): { quincenal: number; semanal: number } | null {
  const hora = Number(v.precio_hora)
  const q = hora * 4 - Number(v.precio_plan_quincenal)
  const s = hora * 8 - Number(v.precio_plan_semanal)
  return q < 0 || s < 0 ? { quincenal: q, semanal: s } : null
}

// ── Lectura con caché corta y respaldo ─────────────────────────────────────────────────────────────

const TTL_MS = 30_000
let cache: { en: number; valores: Ajustes } | null = null

/** Solo para pruebas y para después de guardar un cambio. */
export function limpiarCacheAjustes() { cache = null }

/** Todos los ajustes vigentes: lo guardado, válido y ya vigente, y el valor por defecto para el resto. */
export async function getAjustes(): Promise<Ajustes> {
  if (cache && Date.now() - cache.en < TTL_MS) return cache.valores
  const valores = ajustesPorDefecto()
  try {
    const { data, error } = await createAdminSupabase().from('ajustes').select('clave, valor, vigente_desde')
    if (error) throw new Error(error.message)
    const ahora = Date.now()
    for (const fila of (data ?? []) as { clave: string; valor: unknown; vigente_desde: string | null }[]) {
      if (fila.vigente_desde && new Date(fila.vigente_desde).getTime() > ahora) continue
      const r = validarValor(fila.clave, fila.valor)
      if (r.ok) (valores as Record<string, ValorAjuste>)[fila.clave] = r.valor
      else console.error('[ajustes] valor guardado inválido, se usa el predeterminado:', fila.clave, r.error)
    }
  } catch (e) {
    console.error('[ajustes] no se pudo leer la base, se usan los valores predeterminados:', e)
    return valores // no se guarda en caché: se reintenta en la próxima lectura
  }
  cache = { en: Date.now(), valores }
  return valores
}

export async function getAjuste<K extends ClaveAjuste>(clave: K): Promise<Ajustes[K]> {
  return (await getAjustes())[clave]
}

// ── Escritura (solo desde rutas de administrador) ──────────────────────────────────────────────────

export type ResultadoGuardado =
  | { ok: true }
  | { ok: false; error: string; codigo: 'invalido' | 'conflicto' | 'incoherente' | 'base' }

/**
 * Guarda un cambio de ajuste: valida, revisa coherencia con los demás, escribe el valor nuevo y deja el
 * historial. Un plan más caro que las horas sueltas se rechaza salvo que el administrador lo confirme.
 */
export async function setAjuste(p: { clave: string; valor: unknown; actor: string; confirmarIncoherente?: boolean }): Promise<ResultadoGuardado> {
  const r = validarValor(p.clave, p.valor)
  if (!r.ok) return { ok: false, error: r.error, codigo: 'invalido' }
  const clave = p.clave as ClaveAjuste

  const actuales = await getAjustes()
  const propuestos: Ajustes = { ...actuales, [clave]: r.valor }
  const conflicto = conflictoEntreAjustes(propuestos)
  if (conflicto) return { ok: false, error: conflicto, codigo: 'conflicto' }
  if (!p.confirmarIncoherente && planesIncoherentes(propuestos) && !planesIncoherentes(actuales)) {
    return { ok: false, error: 'Con estos precios un plan sale más caro que comprar las mismas horas sueltas. Confirma si es lo que quieres.', codigo: 'incoherente' }
  }
  if (actuales[clave] === r.valor) return { ok: true } // sin cambio: no se ensucia el historial

  // Valor y historial se guardan juntos, en una sola operación de la base (función guardar_ajuste).
  const { error } = await createAdminSupabase().rpc('guardar_ajuste', {
    p_clave: clave, p_valor: r.valor, p_anterior: actuales[clave], p_actor: p.actor,
  })
  if (error) { console.error('[ajustes] guardar:', error.message); return { ok: false, error: 'No se pudo guardar el cambio', codigo: 'base' } }
  limpiarCacheAjustes()
  return { ok: true }
}
