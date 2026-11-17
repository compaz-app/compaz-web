// ══════════════════════════════════════════════════════════════════════════════
// Sistema de Confianza — modalidad de demostración (escenario sintético + motor).
//
// AISLAMIENTO POR DISEÑO: este módulo es puro. No importa Supabase, no llama a ninguna
// API, no envía correos ni mensajes. El estado vive solo en el navegador de quien
// presenta (components/panel/confianza/ConfianzaDemo.tsx lo guarda en localStorage).
// La prueba tests/118 falla si este archivo o la pantalla de la demo empiezan a
// importar algo que pueda escribir fuera del navegador.
//
// Las reglas de selección NO se reescriben aquí: se usan las de lib/confianza/reglas.ts
// (espejo del CMC), así la demo se comporta igual que la operación real.
// ══════════════════════════════════════════════════════════════════════════════
import {
  evaluarHabilitacion, transicionDisponible, CRITERIOS_SI_NO, CRITERIOS_PUNTAJE, ONBOARDING_CONTROLES,
  type Alerta, type Entrevista, type Etapa, type ExpedienteSeleccion, type Onboarding, type OnboardingResultado,
  type Verificacion, type VerifAtributo, type VerifMetodo, type VerifResultado,
} from '@/lib/confianza/reglas'

export const VERSION_DEMO = 1
/** «Aviso al Compita por Telegram» → «aviso al Compita por Telegram» (solo la primera letra, para no romper nombres propios). */
export const enFrase = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
export const OPERADOR_DEMO = 'Operador de demostración'

export interface Pregunta { pregunta: string; respuesta: string }
/** Pasos de la operación después de habilitar (fase 3). Todos simulados. */
export const PASOS_OPERACION = ['Publicado en la web (inactivo)', 'Perfil y disponibilidad completos', 'Telegram vinculado', 'Activado y verificado por el equipo'] as const
export const PASOS_SOLICITUD = ['Solicitud de la familia', 'Aviso al Compita por Telegram', 'El Compita acepta', 'Videollamada de presentación agendada', 'Pago del cliente'] as const

export interface AspiranteDemo extends ExpedienteSeleccion {
  id: string
  nombre: string
  zona: string
  registrado: string
  origen: string
  /** Marcado al registrar: comparte teléfono o correo con otro aspirante. No cuenta en las cifras. */
  duplicadoDe: string | null
  /** Perfil interno de prueba. No cuenta en las cifras. */
  esPrueba: boolean
  preentrevista: Pregunta[]
  disponibilidad: { dias: string; horario: string; cubre: string; movilidad: string }
  servicios: string[]
  /** Cuántos pasos de PASOS_OPERACION se han dado (0 = aún no habilitado o recién habilitado). */
  operacion: number
}

export interface EventoDemo { id: string; compitaId: string; fecha: string; tipo: string; por: string; campo: string; antes: string; despues: string; motivo: string }
export interface SolicitudDemo { id: string; compitaId: string; familia: string; servicio: string; creada: string; paso: number }
export interface EstadoDemo { version: number; creado: string; aspirantes: AspiranteDemo[]; eventos: EventoDemo[]; solicitudes: SolicitudDemo[]; seq: number }

// ── Escenario sintético ───────────────────────────────────────────────────────
// Personas y familias inventadas. Ningún dato sale de la base ni del CMC.

const PRE = (motivo: string, experiencia: string, emergencia: string, dinero: string): Pregunta[] => [
  { pregunta: '¿Por qué te interesa ser Compita?', respuesta: motivo },
  { pregunta: '¿Has acompañado o ayudado anteriormente a un adulto mayor?', respuesta: experiencia },
  { pregunta: 'La persona dice que siente dolor en el pecho, pero insiste en que no llames a nadie. ¿Qué harías?', respuesta: emergencia },
  { pregunta: 'El producto cuesta más que el dinero autorizado al llegar al comercio. ¿Qué harías?', respuesta: dinero },
  { pregunta: '¿Darías referencias personales o laborales para que Compaz las contacte?', respuesta: 'Sí' },
]

const ent = (fecha: string, decision: Entrevista['decision'], puntajes: number[], razon: string): Entrevista => ({
  fecha, entrevistador: OPERADOR_DEMO, siNo: [true, true], puntajes, positivas: 'Respuestas concretas y trato cálido.', pendientes: '', alertas: '', decision, razon,
})
const verif = (id: string, atributo: VerifAtributo, metodo: VerifMetodo, fecha: string): Verificacion => ({
  id, atributo, metodo, resultado: 'Verificado', evidencia: `DEMOSTRACIÓN: registro ficticio (${metodo.toLowerCase()}).`, verificadoPor: OPERADOR_DEMO, fecha, vence: null, estado: 'Vigente',
})

function base(id: string, nombre: string, zona: string, registrado: string, etapa: Etapa): AspiranteDemo {
  return {
    id, nombre, zona, registrado, etapa, origen: 'Formulario web', duplicadoDe: null, esPrueba: false,
    preentrevista: PRE(
      'Quiero un trabajo con propósito y me gusta acompañar a personas mayores.',
      'Sí, cuidé a mi abuela durante dos años.',
      'Llamo a emergencias y aviso a la familia y a Compaz de inmediato, aunque insista en que no.',
      'No pago la diferencia por mi cuenta: aviso a la familia y espero su autorización.',
    ),
    disponibilidad: { dias: 'Lunes a viernes', horario: 'Mañanas', cubre: zona, movilidad: 'Transporte público' },
    servicios: ['Compañía', 'Acompañar al médico', 'Diligencias'],
    entrevistas: [], verificaciones: [], onboardings: [], alertas: [], operacion: 0,
  }
}

export function escenarioInicial(ahora: string): EstadoDemo {
  const a1 = base('DEMO-101', 'Valentina Ríos', 'Chacao, Caracas', '2026-11-12', 'Registrado')
  const a2 = base('DEMO-102', 'Andrés Salcedo', 'El Cafetal, Caracas', '2026-11-10', 'Preseleccionado')
  const a3 = { ...base('DEMO-103', 'Gabriela Moncada', 'Los Palos Grandes, Caracas', '2026-11-06', 'Entrevistado'), entrevistas: [ent('2026-11-14', 'Segunda conversación', [3, 4, 4, 4, 3, 3], 'Buena disposición; falta confirmar su disponibilidad de los sábados.')] }
  const a4 = {
    ...base('DEMO-104', 'Luis Alberto Peña', 'La Candelaria, Caracas', '2026-11-03', 'En verificación'),
    entrevistas: [ent('2026-11-11', 'Avanza a verificación', [5, 5, 4, 5, 4, 5], 'Criterio sólido ante emergencias y respuestas coherentes con el formulario.')],
    verificaciones: [verif('VER-D01', 'Identidad', 'Videollamada', '2026-11-13')],
  }
  const a5 = {
    ...base('DEMO-105', 'Daniela Ferrer', 'Altamira, Caracas', '2026-10-29', 'En verificación'),
    entrevistas: [ent('2026-11-05', 'Avanza a verificación', [4, 5, 5, 4, 4, 4], 'Experiencia previa comprobable con adultos mayores.')],
    verificaciones: [verif('VER-D02', 'Identidad', 'Documento revisado', '2026-11-07'), verif('VER-D03', 'Referencia', 'Llamada a referencia', '2026-11-08')],
    onboardings: [{ id: 'ONB-D01', fecha: '2026-11-09', realizadoPor: OPERADOR_DEMO, controles: [true, true, true, true], resultado: 'Completado' as OnboardingResultado, observaciones: '' }],
    alertas: [{ id: 'ALT-D01', tipo: 'Inconsistencia', severidad: 'Media' as const, motivo: 'La zona declarada no coincide con la que dijo en la entrevista.', abierta: true, bloquea: true }],
  }
  const a6 = {
    ...base('DEMO-106', 'Rosa Elena Guzmán', 'Santa Mónica, Caracas', '2026-10-20', 'Habilitado'),
    entrevistas: [ent('2026-10-24', 'Avanza a verificación', [5, 5, 5, 5, 5, 4], 'Perfil completo y referencias muy buenas.')],
    verificaciones: [verif('VER-D04', 'Identidad', 'Documento revisado', '2026-10-27'), verif('VER-D05', 'Referencia', 'Llamada a referencia', '2026-10-28')],
    onboardings: [{ id: 'ONB-D02', fecha: '2026-10-30', realizadoPor: OPERADOR_DEMO, controles: [true, true, true, true], resultado: 'Completado' as OnboardingResultado, observaciones: '' }],
    operacion: PASOS_OPERACION.length,
  }
  const a7 = { ...base('DEMO-107', 'Héctor Villamizar', 'Petare, Miranda', '2026-10-25', 'Descartado'), entrevistas: [ent('2026-10-31', 'No avanza', [2, 3, 2, 2, 1, 2], 'Respuestas de seguridad inadecuadas: no avisaría ante una emergencia.')] }
  const a8 = { ...base('DEMO-108', 'Valentina Ríos', 'Chacao, Caracas', '2026-11-13', 'Registrado'), duplicadoDe: 'DEMO-101', origen: 'Formulario web (segundo envío)' }
  const a9 = { ...base('DEMO-109', 'Perfil interno de prueba', 'Caracas', '2026-11-15', 'Registrado'), esPrueba: true, origen: 'Prueba interna del equipo' }

  const aspirantes = [a1, a2, a3, a4, a5, a6, a7, a8, a9]
  const eventos: EventoDemo[] = aspirantes.map((a, i) => ({ id: `EVT-D${String(i + 1).padStart(3, '0')}`, compitaId: a.id, fecha: `${a.registrado}T12:00:00.000Z`, tipo: 'Alta', por: 'Formulario web', campo: 'Etapa de selección', antes: '', despues: 'Registrado', motivo: 'Postulación recibida' }))
  return { version: VERSION_DEMO, creado: ahora, aspirantes, eventos, solicitudes: [{ id: 'SOL-D01', compitaId: 'DEMO-106', familia: 'Familia Méndez (ficticia)', servicio: 'Acompañar al médico', creada: '2026-11-15T15:00:00.000Z', paso: 3 }], seq: eventos.length + 1 }
}

// ── Motor: cada acción valida, cambia el estado y deja su evento ──────────────

export type AccionDemo =
  | { tipo: 'cambiarEtapa'; id: string; a: Etapa }
  | { tipo: 'guardarEntrevista'; id: string; entrevista: Omit<Entrevista, 'fecha' | 'entrevistador'> }
  | { tipo: 'registrarVerificacion'; id: string; atributo: VerifAtributo; metodo: VerifMetodo; resultado: VerifResultado; evidencia: string; vence: string | null }
  | { tipo: 'anularVerificacion'; id: string; verificacionId: string; motivo: string }
  | { tipo: 'registrarOnboarding'; id: string; controles: boolean[]; resultado: OnboardingResultado; observaciones: string }
  | { tipo: 'cerrarAlerta'; id: string; alertaId: string; resolucion: string }
  | { tipo: 'habilitar'; id: string }
  | { tipo: 'avanzarOperacion'; id: string }
  | { tipo: 'crearSolicitud'; id: string }
  | { tipo: 'avanzarSolicitud'; solicitudId: string }

export type Resultado = { ok: true; estado: EstadoDemo; mensaje: string } | { ok: false; error: string }

const ETAPAS_ENTREVISTA: Etapa[] = ['Preseleccionado', 'Entrevistado']
const ETAPAS_VERIFICACION: Etapa[] = ['Entrevistado', 'En verificación']
const FAMILIAS = ['Familia Carrasco (ficticia)', 'Familia Uzcátegui (ficticia)', 'Familia Briceño (ficticia)']

export function aplicar(e: EstadoDemo, acc: AccionDemo, ahora: string): Resultado {
  const ev = (compitaId: string, tipo: string, campo: string, antes: string, despues: string, motivo: string): EventoDemo =>
    ({ id: `EVT-D${String(e.seq).padStart(3, '0')}`, compitaId, fecha: ahora, tipo, por: OPERADOR_DEMO, campo, antes, despues, motivo })
  const fecha = ahora.slice(0, 10)

  if (acc.tipo === 'avanzarSolicitud') {
    const s = e.solicitudes.find((x) => x.id === acc.solicitudId)
    if (!s) return { ok: false, error: 'Esa solicitud no existe en la demostración.' }
    // El último paso (el pago) NO se simula: es lo que falta validar en la operación real.
    if (s.paso + 1 >= PASOS_SOLICITUD.length - 1) return { ok: false, error: 'El pago no se simula: es la parte pendiente de validar.' }
    const solicitudes = e.solicitudes.map((x) => (x.id === s.id ? { ...x, paso: x.paso + 1 } : x))
    const evento = ev(s.compitaId, 'Solicitud', PASOS_SOLICITUD[s.paso + 1], PASOS_SOLICITUD[s.paso], PASOS_SOLICITUD[s.paso + 1], `${s.familia} · ${s.servicio}`)
    return { ok: true, estado: { ...e, solicitudes, eventos: [...e.eventos, evento], seq: e.seq + 1 }, mensaje: `Simulado: ${enFrase(PASOS_SOLICITUD[s.paso + 1])}.` }
  }

  const a = e.aspirantes.find((x) => x.id === acc.id)
  if (!a) return { ok: false, error: 'Ese aspirante no existe en la demostración.' }
  const cambia = (nuevo: AspiranteDemo, eventos: EventoDemo[], mensaje: string): Resultado =>
    ({ ok: true, mensaje, estado: { ...e, aspirantes: e.aspirantes.map((x) => (x.id === a.id ? nuevo : x)), eventos: [...e.eventos, ...eventos.map((x, i) => ({ ...x, id: `EVT-D${String(e.seq + i).padStart(3, '0')}` }))], seq: e.seq + eventos.length } })

  switch (acc.tipo) {
    case 'cambiarEtapa': {
      const t = transicionDisponible(a)
      if (!t || t.a !== acc.a) return { ok: false, error: `No se puede pasar de «${a.etapa}» a «${acc.a}»: el CMC no lo permite desde esta etapa.` }
      return cambia({ ...a, etapa: acc.a }, [ev(a.id, 'Cambio de etapa', 'Etapa de selección', a.etapa, acc.a, t.texto)], `${t.texto}: ahora está en «${acc.a}».`)
    }
    case 'guardarEntrevista': {
      if (!ETAPAS_ENTREVISTA.includes(a.etapa)) return { ok: false, error: `La entrevista se registra en «Preseleccionado» o «Entrevistado»; está en «${a.etapa}».` }
      const x = acc.entrevista
      if (x.siNo.length !== CRITERIOS_SI_NO.length || x.puntajes.length !== CRITERIOS_PUNTAJE.length) return { ok: false, error: 'Faltan criterios por evaluar.' }
      if (x.puntajes.some((n) => !Number.isInteger(n) || n < 1 || n > 5)) return { ok: false, error: 'Cada criterio se puntúa de 1 a 5.' }
      if (x.razon.trim().length < 10) return { ok: false, error: 'Escribe la razón objetiva de la decisión (mínimo 10 caracteres).' }
      if (x.decision === 'Avanza a verificación' && x.siNo.some((s) => !s)) return { ok: false, error: 'No puede avanzar si la identidad, la ubicación o la disponibilidad no están confirmadas.' }
      const nueva: Entrevista = { ...x, razon: x.razon.trim(), fecha, entrevistador: OPERADOR_DEMO }
      const eventos = [ev(a.id, 'Entrevista', 'Decisión', '', x.decision, nueva.razon)]
      if (a.etapa !== 'Entrevistado') eventos.push(ev(a.id, 'Cambio de etapa', 'Etapa de selección', a.etapa, 'Entrevistado', 'Entrevista registrada'))
      return cambia({ ...a, etapa: 'Entrevistado', entrevistas: [...a.entrevistas, nueva] }, eventos, `Entrevista guardada: «${x.decision}».`)
    }
    case 'registrarVerificacion': {
      if (!ETAPAS_VERIFICACION.includes(a.etapa)) return { ok: false, error: `Las verificaciones se registran después de la entrevista; está en «${a.etapa}».` }
      // La evidencia es obligatoria (como en el CMC) y en la demostración SIEMPRE dice que es ficticia, para que nunca pase por real.
      const texto = acc.evidencia.trim().replace(/^DEMOSTRACIÓN:\s*/i, '')
      if (texto.length < 5) return { ok: false, error: 'La evidencia o referencia es obligatoria: describe qué se revisó.' }
      const v: Verificacion = { id: `VER-D${String(e.seq).padStart(3, '0')}`, atributo: acc.atributo, metodo: acc.metodo, resultado: acc.resultado, evidencia: `DEMOSTRACIÓN: ${texto}`.slice(0, 500), verificadoPor: OPERADOR_DEMO, fecha, vence: acc.vence, estado: 'Vigente' }
      return cambia({ ...a, verificaciones: [...a.verificaciones, v] }, [ev(a.id, 'Verificación', acc.atributo, '', `${acc.resultado} · ${acc.metodo}`, v.evidencia)], `Verificación de ${acc.atributo.toLowerCase()} registrada: ${acc.resultado}.`)
    }
    case 'anularVerificacion': {
      const v = a.verificaciones.find((x) => x.id === acc.verificacionId)
      if (!v || v.estado === 'Anulada') return { ok: false, error: 'Esa verificación no existe o ya está anulada.' }
      if (acc.motivo.trim().length < 5) return { ok: false, error: 'Escribe por qué se anula.' }
      if (a.etapa === 'Habilitado') return { ok: false, error: 'Ya está habilitado: para retirar la habilitación se usa el flujo de suspensión del CMC.' }
      return cambia({ ...a, verificaciones: a.verificaciones.map((x) => (x.id === v.id ? { ...x, estado: 'Anulada' as const } : x)) }, [ev(a.id, 'Verificación anulada', v.atributo, 'Vigente', 'Anulada', acc.motivo.trim())], 'Verificación anulada. Queda en el historial.')
    }
    case 'registrarOnboarding': {
      if (a.etapa !== 'En verificación') return { ok: false, error: `El onboarding se registra en «En verificación»; está en «${a.etapa}».` }
      if (acc.controles.length !== ONBOARDING_CONTROLES.length) return { ok: false, error: 'Faltan controles por marcar.' }
      if (acc.resultado === 'Completado' && acc.controles.some((c) => !c)) return { ok: false, error: 'Solo puede quedar «Completado» si los cuatro controles están comprendidos.' }
      const o: Onboarding = { id: `ONB-D${String(e.seq).padStart(3, '0')}`, fecha, realizadoPor: OPERADOR_DEMO, controles: acc.controles, resultado: acc.resultado, observaciones: acc.observaciones.trim().slice(0, 500) }
      return cambia({ ...a, onboardings: [...a.onboardings, o] }, [ev(a.id, 'Onboarding', 'Resultado', '', acc.resultado, o.observaciones)], `Onboarding registrado: ${acc.resultado}.`)
    }
    case 'cerrarAlerta': {
      const al = a.alertas.find((x) => x.id === acc.alertaId)
      if (!al || !al.abierta) return { ok: false, error: 'Esa alerta no existe o ya está cerrada.' }
      if (acc.resolucion.trim().length < 5) return { ok: false, error: 'Escribe cómo se resolvió.' }
      return cambia({ ...a, alertas: a.alertas.map((x): Alerta => (x.id === al.id ? { ...x, abierta: false } : x)) }, [ev(a.id, 'Alerta cerrada', al.tipo, 'Abierta', 'Cerrada', acc.resolucion.trim())], 'Alerta cerrada.')
    }
    case 'habilitar': {
      const r = evaluarHabilitacion(a, true)
      if (!r.puede) return { ok: false, error: `No se puede habilitar. ${r.controles.filter((c) => !c.cumple).map((c) => c.falta).join(' ')}` }
      return cambia({ ...a, etapa: 'Habilitado', operacion: 1 }, [
        ev(a.id, 'Habilitación', 'Etapa de selección', a.etapa, 'Habilitado', 'Cumple los 7 controles'),
        ev(a.id, 'Publicación', 'Web', '', 'Inactivo y sin verificar', 'Simulado: el CMC lo publica en la web, sin correo real'),
      ], 'Habilitado. Simulado: se publica en la web, inactivo hasta que el equipo lo active.')
    }
    case 'avanzarOperacion': {
      if (a.etapa !== 'Habilitado') return { ok: false, error: 'Primero hay que habilitarlo.' }
      if (a.operacion >= PASOS_OPERACION.length) return { ok: false, error: 'Ya está activo en el catálogo de la demostración.' }
      const paso = PASOS_OPERACION[a.operacion]
      return cambia({ ...a, operacion: a.operacion + 1 }, [ev(a.id, 'Operación', paso, '', 'Hecho', 'Simulado')], `Simulado: ${enFrase(paso)}.`)
    }
    case 'crearSolicitud': {
      if (a.etapa !== 'Habilitado' || a.operacion < PASOS_OPERACION.length) return { ok: false, error: 'Solo un Compita activo en el catálogo puede recibir solicitudes.' }
      const s: SolicitudDemo = { id: `SOL-D${String(e.seq).padStart(3, '0')}`, compitaId: a.id, familia: FAMILIAS[e.solicitudes.length % FAMILIAS.length], servicio: a.servicios[0] ?? 'Compañía', creada: ahora, paso: 0 }
      const evento = { ...ev(a.id, 'Solicitud', PASOS_SOLICITUD[0], '', 'Creada', `${s.familia} · ${s.servicio}`), id: `EVT-D${String(e.seq + 1).padStart(3, '0')}` }
      return { ok: true, mensaje: 'Simulado: una familia ficticia pidió a este Compita.', estado: { ...e, solicitudes: [...e.solicitudes, s], eventos: [...e.eventos, evento], seq: e.seq + 2 } }
    }
  }
}

// ── Lecturas para la pantalla ─────────────────────────────────────────────────

export const EN_EVALUACION: Etapa[] = ['Preseleccionado', 'Entrevistado', 'En verificación']

/** ¿Necesita que alguien del equipo haga algo? (para el indicador «Pendientes»). */
export function requiereAtencion(a: AspiranteDemo): boolean {
  if (a.duplicadoDe || a.esPrueba) return false
  if (a.etapa === 'Registrado' || a.etapa === 'Preseleccionado') return true
  if (a.etapa === 'Entrevistado') return true
  if (a.etapa === 'En verificación') return true
  if (a.etapa === 'Habilitado') return a.operacion < PASOS_OPERACION.length
  return false
}

export function resumenDemo(e: EstadoDemo) {
  const validos = e.aspirantes.filter((a) => !a.duplicadoDe && !a.esPrueba)
  return {
    registrados: validos.length,
    enEvaluacion: validos.filter((a) => EN_EVALUACION.includes(a.etapa)).length,
    habilitados: validos.filter((a) => a.etapa === 'Habilitado').length,
    pendientes: validos.filter(requiereAtencion).length,
    duplicados: e.aspirantes.filter((a) => a.duplicadoDe).length,
    pruebas: e.aspirantes.filter((a) => a.esPrueba).length,
    descartados: validos.filter((a) => a.etapa === 'Descartado').length,
  }
}

/** Valida lo que llega de localStorage: si no es un estado de esta versión, se descarta y se empieza de nuevo. */
export function leerEstadoGuardado(crudo: string | null): EstadoDemo | null {
  if (!crudo) return null
  try {
    const x = JSON.parse(crudo) as EstadoDemo
    if (x?.version !== VERSION_DEMO || !Array.isArray(x.aspirantes) || !Array.isArray(x.eventos) || !Array.isArray(x.solicitudes) || typeof x.seq !== 'number') return null
    if (!x.aspirantes.every((a) => typeof a.id === 'string' && a.id.startsWith('DEMO-'))) return null
    return x
  } catch { return null }
}
