// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Compitas habilitadas en el CMC → tabla compitas (unidireccional)
//
// El CMC (Apps Script, docs/cmc/publicar-compitas.gs) envía cada hora una FOTO COMPLETA
// de las filas de «03 · Compitas» con «Etapa de selección» = Habilitado. Este módulo la
// convierte en un plan y lo aplica por `codigo` (COM-NNNN), de forma idempotente.
//
// Reparto de autoridad (decisión de Luis, 10-nov-2026):
//   · El CMC decide si alguien PUEDE trabajar  → compitas.cmc_permite.
//   · La web decide si YA PUEDE recibir solicitudes → estado = activo ∧ verificado
//     (lo verifica Juan) ∧ Telegram vinculado ∧ cmc_permite ≠ false.
//
// Reglas (ver docs/cmc/compitas-desde-cmc.md):
//   1. La sincronización solo RESTRINGE: nunca pone estado = activo ni verificado = true.
//      Una Compita suspendida que el CMC reactiva sigue oculta hasta que Juan la verifica.
//   2. Compitas nuevas: se insertan inactivas y sin verificar. Antes de insertar se buscan
//      conflictos con perfiles existentes (mismo email o, en perfiles sin código, mismo
//      nombre): con conflicto no se crea nada y se avisa.
//   3. Nunca se tocan estado/verificado de filas bloqueadas, ni ninguna columna de las
//      demos ni de las Compitas anteriores sin código.
//   4. Restringir conserva clientes, visitas y solicitudes existentes, y avisa a Juan.
//   5. Fotos anómalas (vacías, incompletas, con muchos códigos inválidos o duplicados,
//      con caída brusca de filas leídas o que restringirían demasiadas Compitas a la
//      vez) se rechazan ENTERAS: no se aplica nada (falla cerrado).
//   6. Simulación: solo lecturas. Ni escrituras, ni correos, ni avisos, ni registro.
// ══════════════════════════════════════════════════════════════════════════════
import { createAdminSupabase } from '@/lib/supabase-server'
import { avisarAdmin } from '@/lib/telegram'
import { sendBienvenidaCompita } from '@/lib/resend'
import { esc } from '@/lib/html'

export const VERSION_FOTO = 1
export const MAX_REGISTROS_FOTO = 2000
export const CODIGO_COM = /^COM-\d{4,6}$/
const ZONA_POR_DEFECTO = 'Por confirmar'
const CAIDA_MAXIMA_FILAS = 0.2 // rechaza si la hoja «encoge» más de un 20 % entre fotos
const VENTANA_AVISO_RECHAZO_H = 6

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type RegistroFoto = {
  codigo: string
  nombre: string
  email: string
  ubicacion: string
  etapa: string
  estado_operativo: string
  acepta_nuevos: string
}

export type FotoCmc = {
  version: number
  generado_en: string
  filas_leidas: number
  completo: boolean
  /** Lo activa Luis a mano para UNA ejecución (propiedad del script). */
  desactivacion_masiva_autorizada: boolean
  compitas: RegistroFoto[]
}

/** Columnas de compitas que necesita el plan. */
export type CompitaActual = {
  id: string
  codigo: string | null
  nombre: string
  email: string | null
  estado: string
  verificado: boolean
  es_demo: boolean | null
  telegram_chat_id?: string | null
  cmc_permite: boolean | null
  cmc_estado: string | null
  cmc_bienvenida_enviada_en: string | null
}

export type Antecedente = { filas_leidas: number | null; conflictos: string[]; cuarentena: string[] } | null

type EstadoWeb = { estado: string; verificado: boolean }
type CmcCampos = { cmc_permite: boolean; cmc_estado: string }

export type Alta = { codigo: string; nombre: string; email: string | null; zona: string } & CmcCampos
export type Actualizacion = {
  compita_id: string
  codigo: string
  nombre: string
  motivo: 'cambio_cmc' | 'ausente'
  antes: CmcCampos & EstadoWeb
  despues: CmcCampos & EstadoWeb
  /** cmc_permite pasa de true a false (cuenta para el freno). */
  pierdePermiso: boolean
  /** Se saca de la oferta pública (estado/verificado cambian). */
  restringe: boolean
}
export type Conflicto = { codigo: string; motivo: 'email_existente' | 'nombre_existente' | 'codigo_en_demo'; compita_id: string }
export type Cuarentena = { codigo: string; motivo: 'codigo_invalido' | 'codigo_duplicado' | 'sin_nombre' }

export type Plan = {
  rechazo: string | null
  altas: Alta[]
  actualizaciones: Actualizacion[]
  conflictos: Conflicto[]
  cuarentena: Cuarentena[]
  /** Valores de etapa/estado/acepta que no se reconocen (se tratan como «no permite»). */
  valoresDesconocidos: string[]
  gestionadasConPermiso: number
  pierdenPermiso: number
  limitePerdidas: number
}

// ── Validación estructural ────────────────────────────────────────────────────

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function validarFoto(body: unknown): { ok: true; foto: FotoCmc } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Cuerpo no válido' }
  const b = body as Record<string, unknown>
  if (b.version !== VERSION_FOTO) return { ok: false, error: `Versión de foto no soportada (se espera ${VERSION_FOTO})` }
  if (!Array.isArray(b.compitas)) return { ok: false, error: 'Falta la lista compitas' }
  if (b.compitas.length > MAX_REGISTROS_FOTO) return { ok: false, error: 'Foto demasiado grande' }
  const filas = Number(b.filas_leidas)
  if (!Number.isInteger(filas) || filas < 0) return { ok: false, error: 'filas_leidas no válido' }
  const generado = txt(b.generado_en, 40)
  if (!generado || Number.isNaN(Date.parse(generado))) return { ok: false, error: 'generado_en no válido' }
  const compitas: RegistroFoto[] = []
  for (const r of b.compitas) {
    if (!r || typeof r !== 'object') return { ok: false, error: 'Registro no válido en compitas' }
    const x = r as Record<string, unknown>
    compitas.push({
      codigo: txt(x.codigo, 20).toUpperCase(),
      nombre: txt(x.nombre, 120),
      email: txt(x.email, 200).toLowerCase(),
      ubicacion: txt(x.ubicacion, 100),
      etapa: txt(x.etapa, 60),
      estado_operativo: txt(x.estado_operativo, 60),
      acepta_nuevos: txt(x.acepta_nuevos, 10),
    })
  }
  return {
    ok: true,
    foto: {
      version: VERSION_FOTO,
      generado_en: new Date(generado).toISOString(),
      filas_leidas: filas,
      completo: b.completo === true,
      desactivacion_masiva_autorizada: b.desactivacion_masiva_autorizada === true,
      compitas,
    },
  }
}

// ── Reglas de estado ──────────────────────────────────────────────────────────

const norm = (s: string | null | undefined) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const ETAPAS = new Set(['habilitado'])
const ESTADOS_OPERATIVOS = new Set(['activo', 'pausado', 'suspendido', 'baja', ''])
const SI_NO = new Set(['si', 'no', ''])

/** Permiso del CMC: Habilitado ∧ Activo ∧ Acepta nuevos = Sí. Cualquier otro valor = no. */
export function permiteCmc(r: Pick<RegistroFoto, 'etapa' | 'estado_operativo' | 'acepta_nuevos'>): boolean {
  return norm(r.etapa) === 'habilitado' && norm(r.estado_operativo) === 'activo' && norm(r.acepta_nuevos) === 'si'
}

export function estadoCmcTexto(r: Pick<RegistroFoto, 'etapa' | 'estado_operativo' | 'acepta_nuevos'>): string {
  return [r.etapa || '—', r.estado_operativo || 'Sin estado operativo', `Acepta: ${r.acepta_nuevos || '—'}`].join(' · ')
}
export const ESTADO_CMC_AUSENTE = 'Ya no figura como Habilitado en el CMC'

/** Cuántas Compitas pueden perder el permiso en una sola foto sin autorización expresa. */
export function limitePerdidas(gestionadasConPermiso: number): number {
  return Math.max(1, Math.floor(gestionadasConPermiso * 0.25))
}

/** Estado web resultante cuando el CMC no permite: fuera de la oferta, sin tocar bloqueadas. */
function estadoRestringido(c: EstadoWeb): EstadoWeb {
  if (c.estado === 'bloqueado') return { estado: c.estado, verificado: c.verificado }
  return { estado: 'inactivo', verificado: false }
}

// ── Plan (función pura) ───────────────────────────────────────────────────────

export function planificar(foto: FotoCmc, actuales: CompitaActual[], anterior: Antecedente): Plan {
  const plan: Plan = {
    rechazo: null, altas: [], actualizaciones: [], conflictos: [], cuarentena: [], valoresDesconocidos: [],
    gestionadasConPermiso: 0, pierdenPermiso: 0, limitePerdidas: 0,
  }
  const rechazar = (motivo: string) => { plan.rechazo = motivo; plan.altas = []; plan.actualizaciones = []; return plan }

  // Gestionadas por el CMC: con código y no demo. Las anteriores sin código no se tocan nunca.
  const gestionadas = actuales.filter((c) => c.codigo && !c.es_demo)
  const porCodigo = new Map(actuales.filter((c) => c.codigo).map((c) => [c.codigo as string, c]))
  plan.gestionadasConPermiso = gestionadas.filter((c) => c.cmc_permite === true).length
  plan.limitePerdidas = limitePerdidas(plan.gestionadasConPermiso)

  // 1. Integridad de la foto
  if (!foto.completo) return rechazar('La foto no está marcada como completa')
  if (foto.filas_leidas < foto.compitas.length) return rechazar('La foto trae más registros que filas leídas')
  if (anterior?.filas_leidas && foto.filas_leidas < anterior.filas_leidas * (1 - CAIDA_MAXIMA_FILAS)) {
    return rechazar(`Lectura incompleta de la hoja: ${foto.filas_leidas} filas frente a ${anterior.filas_leidas} en la última foto aplicada`)
  }
  if (foto.compitas.length === 0 && plan.gestionadasConPermiso > 0) {
    return rechazar(`Lista vacía con ${plan.gestionadasConPermiso} Compita(s) habilitada(s) en la web`)
  }

  // 2. Cuarentena por registro (no se crean ni se cambian)
  const vistos = new Map<string, number>()
  for (const r of foto.compitas) vistos.set(r.codigo, (vistos.get(r.codigo) ?? 0) + 1)
  const validos: RegistroFoto[] = []
  const enCuarentena = new Set<string>()
  for (const r of foto.compitas) {
    if (!CODIGO_COM.test(r.codigo)) { plan.cuarentena.push({ codigo: r.codigo || '(vacío)', motivo: 'codigo_invalido' }); continue }
    if ((vistos.get(r.codigo) ?? 0) > 1) {
      if (!enCuarentena.has(r.codigo)) plan.cuarentena.push({ codigo: r.codigo, motivo: 'codigo_duplicado' })
      enCuarentena.add(r.codigo)
      continue
    }
    if (!r.nombre && !porCodigo.has(r.codigo)) { plan.cuarentena.push({ codigo: r.codigo, motivo: 'sin_nombre' }); enCuarentena.add(r.codigo); continue }
    validos.push(r)
    for (const [campo, permitidos] of [[r.etapa, ETAPAS], [r.estado_operativo, ESTADOS_OPERATIVOS], [r.acepta_nuevos, SI_NO]] as const) {
      if (!permitidos.has(norm(campo))) plan.valoresDesconocidos.push(`${r.codigo}: «${campo}»`)
    }
  }
  const maxCuarentena = Math.max(2, Math.ceil(foto.compitas.length * 0.1))
  if (plan.cuarentena.length > maxCuarentena) {
    return rechazar(`Demasiados registros inválidos o duplicados (${plan.cuarentena.length} de ${foto.compitas.length})`)
  }

  // 3. Altas, conflictos y cambios
  const emails = new Map<string, CompitaActual>()
  const nombresSinCodigo = new Map<string, CompitaActual>()
  for (const c of actuales) {
    if (c.es_demo) continue
    if (c.email) emails.set(norm(c.email), c)
    if (!c.codigo) nombresSinCodigo.set(norm(c.nombre), c)
  }
  const enFoto = new Set<string>()

  for (const r of validos) {
    enFoto.add(r.codigo)
    const cmc: CmcCampos = { cmc_permite: permiteCmc(r), cmc_estado: estadoCmcTexto(r) }
    const actual = porCodigo.get(r.codigo)
    if (!actual) {
      const choqueEmail = r.email ? emails.get(norm(r.email)) : undefined
      const choqueNombre = nombresSinCodigo.get(norm(r.nombre))
      if (choqueEmail) { plan.conflictos.push({ codigo: r.codigo, motivo: 'email_existente', compita_id: choqueEmail.id }); continue }
      if (choqueNombre) { plan.conflictos.push({ codigo: r.codigo, motivo: 'nombre_existente', compita_id: choqueNombre.id }); continue }
      plan.altas.push({ codigo: r.codigo, nombre: r.nombre, email: r.email || null, zona: r.ubicacion || ZONA_POR_DEFECTO, ...cmc })
      // Evita dos altas con el mismo email dentro de la misma foto (personas repetidas en el CMC)
      if (r.email) emails.set(norm(r.email), { id: `nueva:${r.codigo}` } as CompitaActual)
      continue
    }
    if (actual.es_demo) { plan.conflictos.push({ codigo: r.codigo, motivo: 'codigo_en_demo', compita_id: actual.id }); continue }
    const a = cambio(actual, cmc, 'cambio_cmc')
    if (a) plan.actualizaciones.push(a)
  }

  // 4. Gestionadas que ya no aparecen como Habilitado (excepto las que están en cuarentena)
  for (const c of gestionadas) {
    if (enFoto.has(c.codigo as string) || enCuarentena.has(c.codigo as string)) continue
    const a = cambio(c, { cmc_permite: false, cmc_estado: ESTADO_CMC_AUSENTE }, 'ausente')
    if (a) plan.actualizaciones.push(a)
  }

  // 5. Freno: demasiadas pérdidas de permiso a la vez = probable lectura rota
  plan.pierdenPermiso = plan.actualizaciones.filter((a) => a.pierdePermiso).length
  if (!foto.desactivacion_masiva_autorizada && plan.pierdenPermiso > 0) {
    const todas = plan.gestionadasConPermiso >= 2 && plan.pierdenPermiso >= plan.gestionadasConPermiso
    if (todas || plan.pierdenPermiso > plan.limitePerdidas) {
      return rechazar(`Freno de seguridad: ${plan.pierdenPermiso} de ${plan.gestionadasConPermiso} Compitas habilitadas perderían el permiso a la vez (límite ${plan.limitePerdidas})`)
    }
  }
  return plan
}

function cambio(c: CompitaActual, cmc: CmcCampos, motivo: Actualizacion['motivo']): Actualizacion | null {
  const antes = { cmc_permite: c.cmc_permite as boolean, cmc_estado: c.cmc_estado as string, estado: c.estado, verificado: c.verificado }
  // Solo restringe: si el CMC no permite, fuera de la oferta. Si permite, el estado web no cambia.
  const web = cmc.cmc_permite ? { estado: c.estado, verificado: c.verificado } : estadoRestringido(c)
  const despues = { ...cmc, ...web }
  const igual = antes.cmc_permite === despues.cmc_permite && antes.cmc_estado === despues.cmc_estado
    && antes.estado === despues.estado && antes.verificado === despues.verificado
  if (igual) return null
  return {
    compita_id: c.id, codigo: c.codigo as string, nombre: c.nombre, motivo, antes, despues,
    pierdePermiso: c.cmc_permite === true && cmc.cmc_permite === false,
    // La sincronización solo restringe: cualquier cambio de estado web es una retirada de la oferta.
    restringe: antes.estado !== despues.estado || antes.verificado !== despues.verificado,
  }
}

// ── Lecturas ──────────────────────────────────────────────────────────────────

const COLUMNAS = 'id, codigo, nombre, email, estado, verificado, es_demo, telegram_chat_id, cmc_permite, cmc_estado, cmc_bienvenida_enviada_en'

async function leerEstado(): Promise<{ actuales: CompitaActual[]; anterior: Antecedente }> {
  const supabase = createAdminSupabase()
  const [{ data, error }, { data: ult, error: eUlt }] = await Promise.all([
    supabase.from('compitas').select(COLUMNAS),
    supabase.from('cmc_sincronizaciones').select('filas_leidas, resumen').eq('estado', 'aplicada')
      .order('recibida_en', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (error) throw new Error(`compitas: ${error.message}`)
  if (eUlt) throw new Error(`cmc_sincronizaciones: ${eUlt.message}`)
  const r = (ult?.resumen ?? {}) as { conflictos?: string[]; cuarentena?: string[] }
  return {
    actuales: (data ?? []) as CompitaActual[],
    anterior: ult ? { filas_leidas: ult.filas_leidas ?? null, conflictos: r.conflictos ?? [], cuarentena: r.cuarentena ?? [] } : null,
  }
}

// ── Aplicación ────────────────────────────────────────────────────────────────

export type ResultadoSincronizacion = {
  modo: 'simular' | 'aplicar'
  rechazo: string | null
  resumen: {
    recibidas: number
    altas: string[]
    actualizadas: string[]
    restringidas: string[]
    conflictos: string[]
    cuarentena: string[]
    valores_desconocidos: string[]
    bienvenidas: string[]
    errores: string[]
    gestionadas_con_permiso: number
    pierden_permiso: number
    limite_perdidas: number
  }
}

function resumenDe(foto: FotoCmc, plan: Plan): ResultadoSincronizacion['resumen'] {
  return {
    recibidas: foto.compitas.length,
    altas: plan.altas.map((a) => a.codigo),
    actualizadas: plan.actualizaciones.map((a) => a.codigo),
    restringidas: plan.actualizaciones.filter((a) => a.restringe).map((a) => a.codigo),
    conflictos: plan.conflictos.map((c) => `${c.codigo} (${c.motivo})`),
    cuarentena: plan.cuarentena.map((c) => `${c.codigo} (${c.motivo})`),
    valores_desconocidos: plan.valoresDesconocidos,
    bienvenidas: [],
    errores: [],
    gestionadas_con_permiso: plan.gestionadasConPermiso,
    pierden_permiso: plan.pierdenPermiso,
    limite_perdidas: plan.limitePerdidas,
  }
}

/** Simulación: SOLO lecturas. No escribe, no envía correos ni avisos, no registra. */
export async function simularFotoCmc(foto: FotoCmc): Promise<ResultadoSincronizacion> {
  const { actuales, anterior } = await leerEstado()
  const plan = planificar(foto, actuales, anterior)
  const resumen = resumenDe(foto, plan)
  // Bienvenidas que se enviarían: altas que permiten + existentes pendientes
  resumen.bienvenidas = [
    ...plan.altas.filter((a) => a.cmc_permite && a.email).map((a) => a.codigo),
    ...actuales.filter((c) => pendienteBienvenida(c, plan)).map((c) => c.codigo as string),
  ]
  return { modo: 'simular', rechazo: plan.rechazo, resumen }
}

export async function aplicarFotoCmc(foto: FotoCmc): Promise<ResultadoSincronizacion> {
  const supabase = createAdminSupabase()
  const { actuales, anterior } = await leerEstado()
  const plan = planificar(foto, actuales, anterior)
  const resumen = resumenDe(foto, plan)

  if (plan.rechazo) {
    await supabase.from('cmc_sincronizaciones').insert({
      estado: 'rechazada', motivo: plan.rechazo, generado_en: foto.generado_en, filas_leidas: foto.filas_leidas,
      recibidas: foto.compitas.length, resumen,
    })
    await avisarConLimite(`alerta_cmc:rechazo`, `🛑 <b>CMC → web: foto rechazada</b>\n\n${esc(plan.rechazo)}\n\nNo se aplicó ningún cambio. Revisa la hoja «03 · Compitas» y el registro de ejecuciones del Apps Script.`)
    return { modo: 'aplicar', rechazo: plan.rechazo, resumen }
  }

  const cambios: Array<Record<string, unknown>> = []
  const ahora = new Date().toISOString()

  // Altas: siempre inactivas y sin verificar
  for (const a of plan.altas) {
    const { data, error } = await supabase.from('compitas').insert({
      codigo: a.codigo, nombre: a.nombre, email: a.email, zona: a.zona,
      descripcion: null, servicios: [], horarios_disponibles: [],
      estado: 'inactivo', verificado: false, visitas_realizadas: 0, es_demo: false,
      cmc_permite: a.cmc_permite, cmc_estado: a.cmc_estado, cmc_actualizado_en: ahora,
    }).select('id').single()
    if (error) {
      // 23505: otra ejecución la creó (la próxima foto la verá como existente)
      resumen.errores.push(`${a.codigo}: alta (${error.code === '23505' ? 'ya existe' : error.message})`)
      continue
    }
    cambios.push({ compita_id: data.id, codigo: a.codigo, accion: 'alta', antes: null, despues: { estado: 'inactivo', verificado: false, cmc_permite: a.cmc_permite, cmc_estado: a.cmc_estado } })
    actuales.push({ id: data.id, codigo: a.codigo, nombre: a.nombre, email: a.email, estado: 'inactivo', verificado: false, es_demo: false, cmc_permite: a.cmc_permite, cmc_estado: a.cmc_estado, cmc_bienvenida_enviada_en: null })
  }

  // Cambios: guardados por codigo; nunca tocan estado/verificado de bloqueadas
  for (const u of plan.actualizaciones) {
    const set: Record<string, unknown> = { cmc_permite: u.despues.cmc_permite, cmc_estado: u.despues.cmc_estado, cmc_actualizado_en: ahora }
    if (u.antes.estado !== u.despues.estado || u.antes.verificado !== u.despues.verificado) {
      set.estado = u.despues.estado
      set.verificado = u.despues.verificado
    }
    let q = supabase.from('compitas').update(set).eq('id', u.compita_id).eq('codigo', u.codigo)
    if ('estado' in set) q = q.neq('estado', 'bloqueado')
    const { data, error } = await q.select('id')
    if (error || !data?.length) { resumen.errores.push(`${u.codigo}: ${error?.message ?? 'sin fila actualizada'}`); continue }
    cambios.push({ compita_id: u.compita_id, codigo: u.codigo, accion: u.motivo, antes: u.antes, despues: u.despues })
    if (u.restringe) await avisarRestriccion(u)
  }

  // Bienvenidas: una por Compita, con reserva atómica (sin duplicados aunque haya reintentos)
  for (const c of actuales) {
    if (!pendienteBienvenida(c, plan)) continue
    const enviada = await enviarBienvenidaUnaVez(c)
    if (enviada === true) resumen.bienvenidas.push(c.codigo as string)
    else if (enviada) resumen.errores.push(`${c.codigo}: bienvenida (${enviada})`)
  }

  const nuevosConflictos = plan.conflictos.filter((c) => !anterior?.conflictos.some((x) => x.startsWith(`${c.codigo} `)))
  const nuevaCuarentena = plan.cuarentena.filter((c) => !anterior?.cuarentena.some((x) => x.startsWith(`${c.codigo} `)))
  for (const c of nuevosConflictos) await marcarConflicto(c, actuales)

  await supabase.from('cmc_sincronizaciones').insert({
    estado: 'aplicada', generado_en: foto.generado_en, filas_leidas: foto.filas_leidas,
    recibidas: foto.compitas.length, resumen, cambios,
  })

  const lineas: string[] = []
  if (resumen.altas.length) lineas.push(`🆕 Nuevas en el dashboard (inactivas): ${resumen.altas.join(', ')}`)
  if (resumen.restringidas.length) lineas.push(`⛔ Retiradas de la oferta (revisa sus casos en Atención): ${resumen.restringidas.join(', ')}`)
  const sinPermiso = plan.actualizaciones.filter((a) => a.pierdePermiso && !a.restringe).map((a) => a.codigo)
  if (sinPermiso.length) lineas.push(`🔒 Pierden el permiso del CMC (ya estaban fuera de la oferta): ${sinPermiso.join(', ')}`)
  const recuperan = plan.actualizaciones.filter((a) => a.antes.cmc_permite === false && a.despues.cmc_permite).map((a) => a.codigo)
  if (recuperan.length) lineas.push(`🔓 El CMC vuelve a permitir (siguen ocultas hasta que Juan las verifique): ${recuperan.join(', ')}`)
  if (nuevosConflictos.length) lineas.push(`⚠️ Conflictos (no se creó nada): ${nuevosConflictos.map((c) => `${c.codigo} (${c.motivo})`).join(', ')}`)
  if (nuevaCuarentena.length) lineas.push(`⚠️ Registros ignorados: ${nuevaCuarentena.map((c) => `${c.codigo} (${c.motivo})`).join(', ')}`)
  if (resumen.errores.length) lineas.push(`❗ Errores: ${resumen.errores.join('; ')}`)
  if (foto.desactivacion_masiva_autorizada && plan.pierdenPermiso > plan.limitePerdidas) lineas.push(`ℹ️ Desactivación masiva autorizada en el CMC: ${plan.pierdenPermiso} Compitas.`)
  if (lineas.length) await avisarAdmin(`🔄 <b>CMC → web</b>\n\n${lineas.map(esc).join('\n')}`)

  return { modo: 'aplicar', rechazo: null, resumen }
}

function pendienteBienvenida(c: CompitaActual, plan: Plan): boolean {
  if (!c.codigo || c.es_demo || !c.email || c.cmc_bienvenida_enviada_en || c.estado === 'bloqueado') return false
  const u = plan.actualizaciones.find((a) => a.compita_id === c.id)
  const permite = u ? u.despues.cmc_permite : c.cmc_permite
  return permite === true
}

/** true si se envió; string con el motivo si falló; false si otra ejecución ya la reservó. */
async function enviarBienvenidaUnaVez(c: CompitaActual): Promise<true | false | string> {
  const supabase = createAdminSupabase()
  const { data } = await supabase.from('compitas').update({ cmc_bienvenida_enviada_en: new Date().toISOString() })
    .eq('id', c.id).is('cmc_bienvenida_enviada_en', null).select('id').maybeSingle()
  if (!data) return false
  try {
    await sendBienvenidaCompita(c.email as string, c.nombre, process.env.TELEGRAM_BOT_USERNAME ?? '')
    return true
  } catch (e) {
    // Libera la reserva para reintentarlo en la próxima foto
    await supabase.from('compitas').update({ cmc_bienvenida_enviada_en: null }).eq('id', c.id)
    return e instanceof Error ? e.message : 'error'
  }
}

async function avisarRestriccion(u: Actualizacion): Promise<void> {
  const supabase = createAdminSupabase()
  const [{ count: clientes }, { count: solicitudes }, { count: visitas }] = await Promise.all([
    supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('compita_id', u.compita_id),
    supabase.from('solicitudes').select('id', { count: 'exact', head: true }).eq('compita_id', u.compita_id).in('estado', ['pendiente', 'aceptada']),
    supabase.from('visitas').select('id', { count: 'exact', head: true }).eq('compita_id', u.compita_id).in('estado', ['pre_visita', 'programada', 'en_curso']),
  ])
  const nota = `El CMC dejó de permitir a ${u.codigo} (${u.despues.cmc_estado}). Se retiró de la oferta pública y no recibe solicitudes nuevas. `
    + `Conserva ${clientes ?? 0} cliente(s) asignado(s), ${solicitudes ?? 0} solicitud(es) abierta(s) y ${visitas ?? 0} visita(s) activa(s): revisa cada caso.`
  await supabase.from('admin_flags').insert({
    entidad_tipo: 'compita', entidad_id: u.compita_id, entidad_nombre: `CMC — ${u.nombre} (${u.codigo})`,
    nota, reportado_por: 'sincronización CMC', resuelto: false,
  })
}

async function marcarConflicto(c: Conflicto, actuales: CompitaActual[]): Promise<void> {
  const existente = actuales.find((x) => x.id === c.compita_id)
  const texto = c.motivo === 'email_existente' ? 'tiene el mismo email que'
    : c.motivo === 'nombre_existente' ? 'tiene el mismo nombre que' : 'usa el código de la demo'
  await createAdminSupabase().from('admin_flags').insert({
    entidad_tipo: 'compita', entidad_id: c.compita_id, entidad_nombre: `CMC — conflicto ${c.codigo}`,
    nota: `${c.codigo} (habilitada en el CMC) ${texto} «${existente?.nombre ?? c.compita_id}». No se creó ningún perfil. Decidid si es la misma persona antes de vincular el código a mano.`,
    reportado_por: 'sincronización CMC', resuelto: false,
  })
}

/** Aviso al admin como máximo una vez cada VENTANA_AVISO_RECHAZO_H horas por clave. */
async function avisarConLimite(clave: string, texto: string): Promise<void> {
  const supabase = createAdminSupabase()
  const { data: prev } = await supabase.from('telegram_estados').select('updated_at').eq('chat_id', clave).maybeSingle()
  if (prev && Date.now() - new Date(prev.updated_at).getTime() < VENTANA_AVISO_RECHAZO_H * 3600_000) return
  await supabase.from('telegram_estados').upsert({ chat_id: clave, registro_pendiente: false, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })
  await avisarAdmin(texto)
}
