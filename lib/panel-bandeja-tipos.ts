// Bandeja "Requiere tu atención": lógica PURA (sin base de datos) que comparten el servidor y la pantalla.
// Una tarea es una fila abierta de admin_flags (la abre alertaAdmin o una persona del equipo).

export interface TareaBandeja {
  id: string
  entidad_tipo: 'visita' | 'compita' | 'cliente'
  entidad_id: string
  entidad_nombre: string
  nota: string
  reportado_por: string
  created_at: string
  tipo: string | null
  prioridad: number | null
  /** La acción principal de esta tarea (la pone el servidor). Sin ella solo se puede marcar como atendida. */
  accion?: AccionTarea
}

/** Etiqueta corta por categoría de alerta (la que guarda alertaAdmin en `tipo`). Lo que no está aquí cae en "Otras". */
export const ETIQUETA_TIPO: Record<string, string> = {
  emergencia: 'Emergencia',
  nadie_abre: 'Nadie abre',
  salida_seguridad: 'Salida por seguridad',
  visita_alargada: 'Visita alargada',
  pago_escalado: 'Pago', pago_insistido: 'Pago',
  cita_sin_confirmar: 'Cita sin confirmar', cita_sin_telegram: 'Cita sin confirmar',
  cliente_pide_ayuda: 'Duda sin resolver',
  cliente_sin_respuesta: 'Sin respuesta',
  contacto_externo: 'Contacto bloqueado',
  cuenta_pausada: 'Cuenta en pausa',
  reporte_cliente: 'Reporte', reporte_cancelacion: 'Cancelación', reporte_llamada: 'Reporte', reporte_llamada_vencida: 'Reporte',
  // Los `tipo` que otras partes del sistema guardan directo al abrir su tarea.
  cambio_lugar: 'Cambio en el lugar', cancelacion_tardia: 'Cancelación tardía', direccion_faltante: 'Falta dirección',
  duda_sin_resolver: 'Duda sin resolver', estado_no_reconocido: 'Duda sin resolver',
}
export const TIPO_OTRAS = 'Otras'
export const TIPO_TODAS = 'Todas'

export const etiquetaDeTipo = (tipo: string | null | undefined): string => (tipo && ETIQUETA_TIPO[tipo]) || TIPO_OTRAS
/** Igual, pero las tareas de la escalera (que no traen tipo) se llaman "Sin respuesta". */
export const etiquetaDeTarea = (t: Pick<TareaBandeja, 'tipo' | 'reportado_por'>): string => (t.tipo && ETIQUETA_TIPO[t.tipo]) || (t.reportado_por === 'escalera automática' ? 'Sin respuesta' : TIPO_OTRAS)
export const esEmergencia = (t: Pick<TareaBandeja, 'tipo'>) => t.tipo === 'emergencia'

/** Quita la marca interna "[clave]" que alertaAdmin pone al final de la nota para no duplicar tareas. */
export const limpiarNota = (n: string) => n.replace(/\n?\[[^\]]+\]\s*$/, '').trim()

/** Más urgente primero (prioridad 1), emergencias delante de todo, y dentro de cada nivel la más antigua primero. */
export function ordenarTareas(tareas: TareaBandeja[]): TareaBandeja[] {
  const peso = (t: TareaBandeja) => (esEmergencia(t) ? 0 : Math.min(3, Math.max(1, t.prioridad ?? 2)))
  return [...tareas].sort((a, b) => peso(a) - peso(b) || a.created_at.localeCompare(b.created_at))
}

/** Los tipos que hay ahora, con su cuántas; "Todas" siempre primero. Un tipo seleccionado se conserva aunque ya no tenga tareas. */
export function tiposConConteo(tareas: TareaBandeja[], seleccionado: string): { tipo: string; n: number }[] {
  const cuenta = new Map<string, number>()
  for (const t of tareas) { const e = etiquetaDeTarea(t); cuenta.set(e, (cuenta.get(e) ?? 0) + 1) }
  const lista = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([tipo, n]) => ({ tipo, n }))
  if (seleccionado !== TIPO_TODAS && !cuenta.has(seleccionado)) lista.push({ tipo: seleccionado, n: 0 })
  return [{ tipo: TIPO_TODAS, n: tareas.length }, ...lista]
}

export const filtrarPorTipo = (tareas: TareaBandeja[], tipo: string) => (tipo === TIPO_TODAS ? tareas : tareas.filter((t) => etiquetaDeTarea(t) === tipo))

export const PAGINA_BANDEJA = 10

/** Cuántas mostrar: múltiplo de la página, nunca menos de una página ni más de lo razonable (viene de la dirección, no se confía). */
export function cuantasMostrar(v: unknown): number {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n < PAGINA_BANDEJA) return PAGINA_BANDEJA
  return Math.min(500, Math.ceil(n / PAGINA_BANDEJA) * PAGINA_BANDEJA)
}

export function hace(iso: string, ahora = Date.now()): string {
  const m = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60_000))
  return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`
}

/** Qué hace el botón de resolver, para el ⓘ. */
export const INFO_RESOLVER = 'Marca la tarea como atendida y la quita de la bandeja. Queda anotado quién la resolvió y cuándo. No le escribe nada al cliente ni al compita.'

// ── Acciones por tipo de tarea ───────────────────────────────────────────────────────────────
// Cada tarea tiene UNA acción principal según su tipo. Lo calcula el servidor (lib/panel-bandeja.ts) con los datos reales y los permisos
// de quien mira; la pantalla solo la dibuja. Si la acción ya no aplica (el pago ya se confirmó, la pausa ya se decidió), cae en "Marcar atendida".
export interface PausaDecision { id: string; rol: 'cliente' | 'compita'; nombre: string; reincidente: boolean; visitas_abiertas: number }
export interface ReporteLlamada {
  id: string; compita_nombre: string; cliente_nombre: string; motivo: string; plazo_llamada: string; vencido: boolean
  abiertas: { visitas: { id: string; estado: string; fecha: string | null; cancelable: boolean }[]; solicitudes: { id: string; estado: string }[] }
}
export type AccionTarea =
  | { tipo: 'cerrar'; texto: string; info: string }
  | { tipo: 'pago'; texto: string; info: string; monto: number | null }
  | { tipo: 'decidir'; texto: string; info: string; pausa: PausaDecision }
  | { tipo: 'llamada'; texto: string; info: string; reporte: ReporteLlamada }
  | { tipo: 'insistir'; texto: string; info: string; reenvios: number }
  | { tipo: 'sitio'; texto: string; info: string; visitaId: string }
  | { tipo: 'bloqueada'; texto: string; motivo: string }

export type TipoAccion = 'cerrar' | 'pago' | 'decidir' | 'llamada'
/** Qué clase de acción pide cada categoría de tarea (lo que no está aquí solo se cierra). */
export function tipoDeAccion(tipo: string | null | undefined): TipoAccion {
  if (tipo === 'pago_insistido' || tipo === 'pago_escalado') return 'pago'
  if (tipo === 'cuenta_pausada') return 'decidir'
  if (tipo === 'reporte_cliente') return 'llamada'
  return 'cerrar'
}

/** El texto del botón que solo cierra la tarea, y lo que hace (el ⓘ), según su tipo. */
export function textoCerrar(tipo: string | null | undefined): { texto: string; info: string } {
  if (tipo === 'emergencia') return { texto: 'Marcar atendida', info: 'Indica que ya atendiste la emergencia. Quita la alerta roja y queda anotado quién y cuándo.' }
  if (tipo === 'contacto_externo') return { texto: 'Marcar revisada', info: 'Indica que ya revisaste el mensaje bloqueado. Quita la tarea y queda anotado. No se envía nada a nadie.' }
  if (tipo === 'salida_seguridad') return { texto: 'Marcar atendida', info: 'Indica que ya hablaste con el compita tras salir de una visita por seguridad y decidiste si se cobra. Quita la tarea y queda anotado. Nunca le pidas datos por teléfono.' }
  if (tipo === 'reporte_cancelacion') return { texto: 'Marcar revisada', info: 'Indica que ya revisaste las cancelaciones del compita. Quita la tarea y queda anotado. No cambia nada más.' }
  return { texto: 'Marcar atendida', info: INFO_RESOLVER }
}

export const INFO_PAGO = 'Confirma que el dinero llegó. El cliente puede completar su ficha y agendar, y le llega un correo. Queda anotado quién lo confirmó.'
export const INFO_DECIDIR_CUENTA = 'Abre una ventana para reactivar la cuenta, darle otra oportunidad o bloquearla. Tu decisión queda anotada en Actividad.'
export const INFO_LLAMADA = 'Abre una ventana con el plazo, lo que sigue abierto con ese cliente y las cuatro decisiones. Al registrar, la tarea se cierra y queda quién llamó.'
/**
 * Las tareas en las que se puede INSISTIR: reenviar el aviso que la persona no atendió (con tope; ver lib/insistir-aviso.ts).
 * Escalera automática (compita que no respondió o cliente que no decidió), cambio en el lugar y cita sin confirmar van al compita;
 * la dirección faltante, al cliente por correo.
 */
export type ClaseInsistir = { destinatario: 'compita' | 'cliente'; texto: string; info: string }
const INFO_INSISTIR_COMPITA = 'Le manda de nuevo el aviso por Telegram al compita que no respondió. Queda anotado que se insistió. Hay un tope: uno cada 30 minutos y 3 por aviso.'
export function claseInsistir(t: { tipo: string | null; reportado_por: string; entidad_tipo: string }): ClaseInsistir | null {
  if (t.tipo === 'cambio_lugar' || t.tipo === 'cita_sin_confirmar') return { destinatario: 'compita', texto: 'Insistir al compita', info: INFO_INSISTIR_COMPITA }
  if (t.tipo === 'direccion_faltante') return { destinatario: 'cliente', texto: 'Recordarle por correo', info: 'Le manda de nuevo el correo de Compaz al cliente para que registre la dirección de su visita. Queda anotado. Hay un tope: uno cada 30 minutos y 3 por aviso.' }
  if (t.reportado_por === 'escalera automática') {
    if (t.entidad_tipo === 'compita') return { destinatario: 'compita', texto: 'Insistir al compita', info: INFO_INSISTIR_COMPITA }
    if (t.entidad_tipo === 'cliente') return { destinatario: 'cliente', texto: 'Recordar al cliente', info: 'Le manda de nuevo el correo de Compaz al cliente para que decida. No lleva datos del compita. Queda anotado. Hay un tope: uno cada 30 minutos y 3 por aviso.' }
  }
  return null
}
export const INFO_SITIO = 'Te muestra el nombre y el teléfono de la persona de contacto en el sitio para que le escribas por WhatsApp. Es un dato sensible: si no eres administrador te pide un motivo, y queda anotado en Actividad. No le des datos del compita.'

export const PERMISO_FALTA = 'No tienes este permiso. Pídeselo a un administrador.'

export const OPCIONES_DECISION = [
  { id: 'reactivar', t: 'Reactivar', d: 'Vuelve a usar el sistema con normalidad y sus visitas en espera siguen. Se le avisa.' },
  { id: 'otra_oportunidad', t: 'Dar otra oportunidad', d: 'Se reactiva con una advertencia por escrito. Si se repite, se bloquea.' },
  { id: 'bloquear', t: 'Bloquear', d: 'Pierde el acceso. Sus visitas en espera se cancelan y se avisa a la otra parte.' },
] as const

export const OPCIONES_LLAMADA = [
  { id: 'resuelto', t: 'Resuelto', d: 'Ya hablaste con el compita y no hace falta nada más. Se cierra la tarea y queda anotado quién llamó y cuándo.' },
  { id: 'hablar_cliente', t: 'Hablar con el cliente', d: 'Tras hablar con el compita, falta llamar o escribirle al cliente. Se cierra esta tarea; el seguimiento con el cliente lo haces tú.' },
  { id: 'mantener_bloqueo', t: 'Mantener el bloqueo', d: 'Decides que el compita no vuelve con este cliente. El bloqueo sigue y ese cliente no podrá pedirle más visitas. Se cierra la tarea.' },
  { id: 'levantar_bloqueo', t: 'Levantar el bloqueo', d: 'Decides que no hacía falta separarlos. El cliente vuelve a poder pedirle visitas a este compita. Se cierra la tarea.' },
] as const

/** El id del reporte que va en la nota de la tarea ("[reporte:<uuid>]"). */
export const idReporteDeNota = (nota: string) => /\[reporte:([0-9a-f-]{36})\]/.exec(nota)?.[1] ?? null

/** Para qué sirve la Bandeja (el ⓘ del encabezado). */
export const INFO_BANDEJA = 'La Bandeja es tu lista de trabajo: cada fila es algo que una persona del equipo debe hacer o revisar, lo más urgente primero. Cada tarea trae su botón (confirmar un pago, decidir sobre una cuenta, registrar una llamada, reenviar un aviso o marcarla como atendida); pasa el cursor por su ⓘ para ver qué hace. Toca el nombre para abrir la ficha de la persona. Cuando haces lo que pide la tarea, la cierras y queda anotado quién.'
