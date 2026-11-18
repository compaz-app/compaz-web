/* eslint-disable */
// Sistema de Confianza: reglas del CMC (espejo), motor de la demostración, su aislamiento y la vista operativa (solo lectura).
import { db, limpiar, mkCompita, net } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { evaluarHabilitacion, transicionDisponible, siguienteAccion, CRITERIOS_PUNTAJE, CRITERIOS_SI_NO, VERIF_ATRIBUTOS, VERIF_METODOS, VERIF_RESULTADOS, VERIF_ESTADOS, CAPACIDADES, type ExpedienteSeleccion } from '@/lib/confianza/reglas'
import { aplicar, escenarioInicial, leerEstadoGuardado, resumenDemo, proximaAccion, sinPrefijoDemo, PASOS_OPERACION, PASOS_SOLICITUD, type EstadoDemo } from '@/lib/confianza/demo'
import { cargarResumenOperativo, clasificarHabilitada, esPerfilDePrueba } from '@/lib/confianza/operativo'
import { seccionesVisibles } from '@/lib/panel-secciones'
import { NINGUNO, TODOS } from '@/lib/permisos-catalogo'

const AHORA = '2026-11-17T20:00:00.000Z'
const listo: ExpedienteSeleccion = {
  etapa: 'En verificación',
  entrevistas: [{ fecha: '2026-11-10', entrevistador: 'x', siNo: [true, true], puntajes: [5, 5, 5, 5, 5, 5], positivas: '', pendientes: '', alertas: '', decision: 'Avanza a verificación', razon: 'Bien en todo' }],
  verificaciones: [
    { id: 'v1', atributo: 'Identidad', metodo: 'Videollamada', resultado: 'Verificado', evidencia: 'x', verificadoPor: 'x', fecha: '2026-11-11', vence: null, estado: 'Vigente' },
    { id: 'v2', atributo: 'Referencia', metodo: 'Llamada a referencia', resultado: 'Verificado', evidencia: 'x', verificadoPor: 'x', fecha: '2026-11-11', vence: null, estado: 'Vigente' },
  ],
  onboardings: [{ id: 'o1', fecha: '2026-11-12', realizadoPor: 'x', controles: [true, true, true, true], resultado: 'Completado', observaciones: '' }],
  alertas: [],
}
const fallan = (x: ExpedienteSeleccion, op = true) => evaluarHabilitacion(x, op).controles.filter((c) => !c.cumple).map((c) => c.id)

describe('reglas del CMC (espejo de panel_evaluarHabilitacion_)', () => {
  test('con los 7 controles cumplidos se puede habilitar', () => assert.equal(evaluarHabilitacion(listo, true).puede, true))
  test('cada control, por separado, impide habilitar', () => {
    assert.deepEqual(fallan({ ...listo, entrevistas: [{ ...listo.entrevistas[0], decision: 'Segunda conversación' }] }), ['decision'])
    assert.deepEqual(fallan({ ...listo, etapa: 'Entrevistado' }), ['etapa'])
    assert.deepEqual(fallan({ ...listo, verificaciones: [listo.verificaciones[1]] }), ['identidad'])
    assert.deepEqual(fallan({ ...listo, verificaciones: [listo.verificaciones[0]] }), ['referencia'])
    assert.deepEqual(fallan({ ...listo, onboardings: [{ ...listo.onboardings[0], resultado: 'Pendiente' }] }), ['onboarding'])
    assert.deepEqual(fallan({ ...listo, alertas: [{ id: 'a', tipo: 't', severidad: 'Alta', motivo: 'm', abierta: true, bloquea: true }] }), ['alertas'])
    assert.deepEqual(fallan(listo, false), ['operador'])
  })
  test('una verificación anulada, no verificada o inconclusa no cuenta; una alerta que no bloquea o cerrada, tampoco frena', () => {
    for (const cambio of [{ estado: 'Anulada' }, { estado: 'Vencida' }, { resultado: 'No verificado' }, { resultado: 'Inconcluso' }] as any[])
      assert.deepEqual(fallan({ ...listo, verificaciones: [{ ...listo.verificaciones[0], ...cambio }, listo.verificaciones[1]] }), ['identidad'])
    assert.equal(evaluarHabilitacion({ ...listo, alertas: [{ id: 'a', tipo: 't', severidad: 'Baja', motivo: 'm', abierta: true, bloquea: false }, { id: 'b', tipo: 't', severidad: 'Alta', motivo: 'm', abierta: false, bloquea: true }] }, true).puede, true)
  })
  test('manda la ÚLTIMA entrevista y el ÚLTIMO onboarding', () => {
    assert.deepEqual(fallan({ ...listo, entrevistas: [...listo.entrevistas, { ...listo.entrevistas[0], fecha: '2026-11-15', decision: 'No avanza' }] }), ['decision'])
    assert.deepEqual(fallan({ ...listo, onboardings: [...listo.onboardings, { ...listo.onboardings[0], fecha: '2026-11-16', resultado: 'Requiere refuerzo' }] }), ['onboarding'])
  })
  test('las listas son las del CMC (hojas 08 y 12)', () => {
    assert.equal(CRITERIOS_SI_NO.length + CRITERIOS_PUNTAJE.length, 8)
    assert.deepEqual([...VERIF_ATRIBUTOS], ['Identidad', 'Referencia', 'Ubicación / residencia', 'Redes sociales', 'Otro'])
    assert.deepEqual([...VERIF_RESULTADOS], ['Verificado', 'No verificado', 'Inconcluso'])
    assert.deepEqual([...VERIF_ESTADOS], ['Vigente', 'Vencida', 'Anulada'])
    assert.ok(VERIF_METODOS.includes('Otro'))
  })
  test('transiciones: solo las que ofrece la V2', () => {
    assert.equal(transicionDisponible({ ...listo, etapa: 'Registrado' })?.a, 'Preseleccionado')
    assert.equal(transicionDisponible({ ...listo, etapa: 'Entrevistado' })?.a, 'En verificación')
    assert.equal(transicionDisponible({ ...listo, etapa: 'Entrevistado', entrevistas: [{ ...listo.entrevistas[0], decision: 'No avanza' }] })?.a, 'Descartado')
    assert.equal(transicionDisponible({ ...listo, etapa: 'Entrevistado', entrevistas: [{ ...listo.entrevistas[0], decision: 'Segunda conversación' }] }), null)
    assert.equal(transicionDisponible({ ...listo, etapa: 'Preseleccionado' }), null, 'de preseleccionado se sale registrando la entrevista')
    assert.equal(transicionDisponible({ ...listo, etapa: 'En verificación' }), null, 'a habilitado solo se llega con la habilitación (7 controles), nunca con un salto directo')
    assert.match(siguienteAccion(listo), /se puede habilitar/)
  })
  test('lo que se dice comprobado, simulado o pendiente: pago y visita siguen pendientes; verificación y onboarding, simulados', () => {
    const m = Object.fromEntries(CAPACIDADES.map((c) => [c.id, c.madurez]))
    assert.equal(m.pago, 'pendiente'); assert.equal(m.visita, 'pendiente'); assert.equal(m.verificacion, 'simulado'); assert.equal(m.onboarding, 'simulado')
  })
})

describe('motor de la demostración', () => {
  const paso = (e: EstadoDemo, acc: any) => { const r = aplicar(e, acc, AHORA); assert.ok(r.ok, r.ok ? '' : r.error); return (r as any).estado as EstadoDemo }
  const falla = (e: EstadoDemo, acc: any, re: RegExp) => { const r = aplicar(e, acc, AHORA); assert.equal(r.ok, false); assert.match((r as any).error, re) }
  const entrevista = { siNo: [true, true], puntajes: [5, 4, 5, 5, 4, 5], positivas: '', pendientes: '', alertas: '', decision: 'Avanza a verificación', razon: 'Respuestas coherentes y buen criterio' }

  test('recorrido completo de DEMO-101: registrado → habilitado → activo → solicitud, con historial', () => {
    let e = escenarioInicial(AHORA)
    const id = 'DEMO-101'
    falla(e, { tipo: 'habilitar', id }, /No se puede habilitar/)
    e = paso(e, { tipo: 'cambiarEtapa', id, a: 'Preseleccionado' })
    e = paso(e, { tipo: 'guardarEntrevista', id, entrevista })
    e = paso(e, { tipo: 'cambiarEtapa', id, a: 'En verificación' })
    falla(e, { tipo: 'habilitar', id }, /identidad/)
    e = paso(e, { tipo: 'registrarVerificacion', id, atributo: 'Identidad', metodo: 'Videollamada', resultado: 'Verificado', evidencia: 'Cédula vista en videollamada', vence: null })
    e = paso(e, { tipo: 'registrarVerificacion', id, atributo: 'Referencia', metodo: 'Llamada a referencia', resultado: 'Verificado', evidencia: 'Exempleadora confirma', vence: null })
    falla(e, { tipo: 'habilitar', id }, /onboarding/)
    e = paso(e, { tipo: 'registrarOnboarding', id, controles: [true, true, true, true], resultado: 'Completado', observaciones: '' })
    e = paso(e, { tipo: 'habilitar', id })
    for (let i = 1; i < PASOS_OPERACION.length; i++) e = paso(e, { tipo: 'avanzarOperacion', id })
    falla(e, { tipo: 'avanzarOperacion', id }, /Ya está activo/)
    e = paso(e, { tipo: 'crearSolicitud', id })
    const s = e.solicitudes.find((x) => x.compitaId === id)!
    for (let i = 1; i < PASOS_SOLICITUD.length - 1; i++) e = paso(e, { tipo: 'avanzarSolicitud', solicitudId: s.id })
    assert.equal(e.solicitudes.find((x) => x.id === s.id)!.paso, PASOS_SOLICITUD.length - 2, 'llega hasta antes del pago')
    falla(e, { tipo: 'avanzarSolicitud', solicitudId: s.id }, /pago no se simula/)
    const a = e.aspirantes.find((x) => x.id === id)!
    assert.equal(a.etapa, 'Habilitado')
    const historial = e.eventos.filter((x) => x.compitaId === id)
    assert.ok(historial.length >= 12, `historial con ${historial.length} eventos`)
    assert.equal(new Set(e.eventos.map((x) => x.id)).size, e.eventos.length, 'los ids de los eventos no se repiten')
    assert.ok(historial.some((x) => x.tipo === 'Habilitación' && x.despues === 'Habilitado' && x.por))
  })
  test('la evidencia es obligatoria y SIEMPRE queda marcada como de demostración', () => {
    let e = escenarioInicial(AHORA)
    falla(e, { tipo: 'registrarVerificacion', id: 'DEMO-104', atributo: 'Referencia', metodo: 'Otro', resultado: 'Verificado', evidencia: 'DEMOSTRACIÓN: ', vence: null }, /obligatoria/)
    e = paso(e, { tipo: 'registrarVerificacion', id: 'DEMO-104', atributo: 'Referencia', metodo: 'Otro', resultado: 'Verificado', evidencia: 'Referencia ficticia', vence: null })
    assert.match(e.aspirantes.find((x) => x.id === 'DEMO-104')!.verificaciones.at(-1)!.evidencia, /^DEMOSTRACIÓN: Referencia ficticia$/)
  })
  test('no se saltan pasos: ni entrevistar a un registrado, ni verificar antes de la entrevista, ni pasar de etapa sin la decisión', () => {
    const e = escenarioInicial(AHORA)
    falla(e, { tipo: 'guardarEntrevista', id: 'DEMO-101', entrevista }, /Preseleccionado/)
    falla(e, { tipo: 'registrarVerificacion', id: 'DEMO-102', atributo: 'Identidad', metodo: 'Otro', resultado: 'Verificado', evidencia: 'algo de texto', vence: null }, /después de la entrevista/)
    falla(e, { tipo: 'cambiarEtapa', id: 'DEMO-103', a: 'En verificación' }, /No se puede pasar/)
    falla(e, { tipo: 'cambiarEtapa', id: 'DEMO-101', a: 'Habilitado' }, /No se puede pasar/)
    falla(e, { tipo: 'guardarEntrevista', id: 'DEMO-102', entrevista: { ...entrevista, puntajes: [5, 5, 5, 5, 5, 9] } }, /1 a 5/)
    falla(e, { tipo: 'guardarEntrevista', id: 'DEMO-102', entrevista: { ...entrevista, razon: 'ok' } }, /razón/)
    falla(e, { tipo: 'guardarEntrevista', id: 'DEMO-102', entrevista: { ...entrevista, siNo: [false, true] } }, /no están confirmadas/)
    falla(e, { tipo: 'registrarOnboarding', id: 'DEMO-104', controles: [true, true, false, true], resultado: 'Completado', observaciones: '' }, /cuatro controles/)
  })
  test('una alerta que bloquea impide habilitar hasta cerrarla con su resolución', () => {
    let e = escenarioInicial(AHORA)
    falla(e, { tipo: 'habilitar', id: 'DEMO-105' }, /alerta/)
    falla(e, { tipo: 'cerrarAlerta', id: 'DEMO-105', alertaId: 'ALT-D01', resolucion: '' }, /resolvió/)
    e = paso(e, { tipo: 'cerrarAlerta', id: 'DEMO-105', alertaId: 'ALT-D01', resolucion: 'Confirmó su zona por videollamada' })
    e = paso(e, { tipo: 'habilitar', id: 'DEMO-105' })
    assert.equal(e.aspirantes.find((x) => x.id === 'DEMO-105')!.etapa, 'Habilitado')
  })
  test('anular deja la verificación en el historial y vuelve a frenar la habilitación', () => {
    let e = escenarioInicial(AHORA)
    e = paso(e, { tipo: 'anularVerificacion', id: 'DEMO-104', verificacionId: 'VER-D01', motivo: 'Documento ilegible' })
    const a = e.aspirantes.find((x) => x.id === 'DEMO-104')!
    assert.equal(a.verificaciones.find((v) => v.id === 'VER-D01')!.estado, 'Anulada')
    assert.ok(e.eventos.some((x) => x.tipo === 'Verificación anulada' && x.motivo === 'Documento ilegible'))
  })
  test('las cifras separan duplicados y perfiles de prueba', () => {
    const r = resumenDemo(escenarioInicial(AHORA))
    assert.deepEqual({ registrados: r.registrados, duplicados: r.duplicados, pruebas: r.pruebas, habilitados: r.habilitados, enEvaluacion: r.enEvaluacion }, { registrados: 7, duplicados: 1, pruebas: 1, habilitados: 1, enEvaluacion: 4 })
  })
  test('el motor no cambia el estado que recibe (cada acción devuelve uno nuevo)', () => {
    const e = escenarioInicial(AHORA); const antes = JSON.stringify(e)
    aplicar(e, { tipo: 'cambiarEtapa', id: 'DEMO-101', a: 'Preseleccionado' }, AHORA)
    assert.equal(JSON.stringify(e), antes)
  })
  test('lo guardado en el navegador se valida: basura o datos que no son de la demo se descartan', () => {
    const e = escenarioInicial(AHORA)
    assert.ok(leerEstadoGuardado(JSON.stringify(e)))
    assert.equal(leerEstadoGuardado('{no es json'), null)
    assert.equal(leerEstadoGuardado(JSON.stringify({ ...e, version: 99 })), null)
    assert.equal(leerEstadoGuardado(JSON.stringify({ ...e, aspirantes: [{ ...e.aspirantes[0], id: 'COM-1064' }] })), null, 'un código real nunca entra en la demo')
  })
  test('el escenario es sintético: códigos DEMO y ningún código COM real', () => {
    const e = escenarioInicial(AHORA)
    assert.ok(e.aspirantes.every((a) => /^DEMO-\d+$/.test(a.id)))
    assert.doesNotMatch(JSON.stringify(e), /COM-\d{4}/)
  })
})

describe('aislamiento de la demostración', () => {
  const ARCHIVOS = ['lib/confianza/demo.ts', 'lib/confianza/reglas.ts', 'components/panel/confianza/MarcoConfianza.tsx', 'components/panel/confianza/ConfianzaDemo.tsx', 'components/panel/confianza/FichaDemo.tsx', 'components/panel/confianza/FormulariosDemo.tsx', 'components/panel/confianza/piezas.tsx']
  test('ni el motor ni la pantalla de la demo pueden escribir fuera del navegador', () => {
    const PROHIBIDO = [/\bfetch\s*\(/, /['"`]\/api\//, /from ['"][^'"]*supabase/i, /createClient|createBrowserClient/, /@\/lib\/(telegram|resend|daily|compitas|solicitudes|usuarios|acciones-equipo|cmc-compitas)\b/, /XMLHttpRequest|sendBeacon|WebSocket|EventSource/, /'use server'/, /router\.(push|replace|refresh)/]
    for (const f of ARCHIVOS) { const s = readFileSync(f, 'utf8'); for (const re of PROHIBIDO) assert.doesNotMatch(s, re, `${f} no debe contener ${re}`) }
  })
  test('ejecutar el recorrido completo no envía nada ni escribe en la base', () => {
    limpiar()
    const antes = JSON.stringify(db.tables)
    let e = escenarioInicial(AHORA)
    for (const acc of [{ tipo: 'cambiarEtapa', id: 'DEMO-105', a: 'x' }, { tipo: 'cerrarAlerta', id: 'DEMO-105', alertaId: 'ALT-D01', resolucion: 'Resuelta en la llamada' }, { tipo: 'habilitar', id: 'DEMO-105' }, { tipo: 'crearSolicitud', id: 'DEMO-106' }] as any[]) {
      const r = aplicar(e, acc, AHORA); if (r.ok) e = r.estado
    }
    assert.equal(net.tg.length, 0); assert.equal(net.emails.length, 0)
    assert.equal(JSON.stringify(db.tables), antes)
  })
  test('en la demostración el marco esconde el correo, el "ver como" y los puntos rojos', () => {
    const marco = readFileSync('components/panel/MarcoPanel.tsx', 'utf8')
    assert.match(marco, /presentacion \? null/); assert.match(marco, /correoVisible = presentacion \? ''/); assert.match(marco, /elegirVista = puedeElegirVista && !presentacion/)
    assert.match(readFileSync('app/panel/page.tsx', 'utf8'), /presentacion = actual === 'confianza' && un\('cf_modo'\) === 'demo'/)
  })
})

describe('vista operativa (solo lectura) y sección', () => {
  beforeEach(limpiar)
  test('reconoce perfiles de prueba por código, por palabras y por cuenta del equipo', () => {
    assert.ok(esPerfilDePrueba({ codigo: 'COM-1064' }, []))
    assert.ok(esPerfilDePrueba({ nombre: 'Luis M Prueba' }, []))
    assert.ok(esPerfilDePrueba({ email: 'equipo@compaz.test' }, ['equipo@compaz.test']))
    assert.equal(esPerfilDePrueba({ codigo: 'COM-0025', nombre: 'Carmen Pérez', email: 'carmen@correo.com' }, []), null)
    assert.equal(esPerfilDePrueba({ nombre: 'Demóstenes Ruiz' }, []), null, 'una palabra que solo contiene demo no basta')
  })
  test('un perfil de prueba visible en el catálogo sale como alerta', () => {
    const c = clasificarHabilitada({ id: '1', codigo: 'COM-1064', nombre: 'Luis M Prueba', email: null, estado: 'activo', verificado: true, cmc_permite: true, telegram_chat_id: '9' }, [])
    assert.equal(c.enWeb, 'catalogo'); assert.ok(c.prueba); assert.match(c.nota!, /catálogo público/)
    assert.equal(clasificarHabilitada({ id: '2', codigo: 'COM-0300', nombre: 'Ana', email: null, estado: 'activo', verificado: true, cmc_permite: false, telegram_chat_id: '9' }, []).enWeb, 'bloqueada')
  })
  test('lee de la base sin escribir nada y separa reales, pruebas y demos', async () => {
    mkCompita({ codigo: 'COM-0025', nombre: 'Real Uno', email: 'real@correo.com', estado: 'inactivo', verificado: false, cmc_permite: true, telegram_chat_id: '1' } as any)
    mkCompita({ codigo: 'COM-1064', nombre: 'Luis M Prueba', estado: 'activo', verificado: true, cmc_permite: true, telegram_chat_id: '2' } as any)
    mkCompita({ codigo: null, nombre: 'Demo', es_demo: true, estado: 'activo', verificado: true } as any)
    db.tables.postulaciones = [
      { id: 'p1', tipo: 'compita', clasificacion: 'pendiente', nombre_declarado: 'Ana Real', email_declarado: 'ana@correo.com', resolucion: null },
      { id: 'p2', tipo: 'compita', clasificacion: 'repetida', nombre_declarado: 'Ana Real', email_declarado: 'ana@correo.com', resolucion: null },
      { id: 'p3', tipo: 'compita', clasificacion: 'pendiente', nombre_declarado: 'test test', email_declarado: 'x@correo.com', resolucion: null },
      { id: 'p4', tipo: 'familia', clasificacion: 'pendiente', nombre_declarado: 'Familia', email_declarado: 'f@correo.com', resolucion: null },
    ] as any
    const antes = JSON.stringify(db.tables)
    const r = await cargarResumenOperativo()
    assert.equal(JSON.stringify(db.tables), antes, 'solo lectura')
    assert.deepEqual(r.postulaciones, { recibidas: 1, porResolver: 1, repetidas: 1, pruebas: 1 })
    assert.equal(r.habilitadas.length, 2); assert.equal(r.habilitadas.filter((c) => !c.prueba).length, 1)
    assert.equal(r.demos, 1)
  })
  test('la sección se ve con el permiso de monitorear y en el teléfono no ocupa la barra inferior', () => {
    const colab = (p: any) => ({ rol: 'colaborador' as const, permisos: { ...NINGUNO, ...p } })
    assert.ok(seccionesVisibles({ rol: 'admin', permisos: TODOS }).some((s) => s.id === 'confianza'))
    assert.ok(seccionesVisibles(colab({ monitorear: true })).some((s) => s.id === 'confianza'))
    assert.ok(!seccionesVisibles(colab({ atender: true })).some((s) => s.id === 'confianza'))
    assert.equal(seccionesVisibles({ rol: 'admin', permisos: TODOS }).find((s) => s.id === 'confianza')!.enBarraMovil, false)
  })
})

describe('correcciones del rediseño (17-nov-2026)', () => {
  const paso = (e: EstadoDemo, acc: any) => { const r = aplicar(e, acc, AHORA); assert.ok(r.ok, r.ok ? '' : r.error); return (r as any).estado as EstadoDemo }
  test('la evidencia nunca queda con el prefijo duplicado, lo escriba quien lo escriba', () => {
    for (const t of ['DEMOSTRACIÓN: DEMOSTRACIÓN: verificación ficticia', 'demostracion: verificación ficticia', '  DEMOSTRACIÓN:DEMOSTRACIÓN:   verificación ficticia', 'verificación ficticia']) {
      const e = paso(escenarioInicial(AHORA), { tipo: 'registrarVerificacion', id: 'DEMO-104', atributo: 'Referencia', metodo: 'Otro', resultado: 'Verificado', evidencia: t, vence: null })
      assert.equal(e.aspirantes.find((x) => x.id === 'DEMO-104')!.verificaciones.at(-1)!.evidencia, 'DEMOSTRACIÓN: verificación ficticia', t)
    }
    assert.equal(sinPrefijoDemo('DEMOSTRACIÓN: '), '')
  })
  test('próxima acción según el estado efectivo: incorporación, disponible y solicitud en curso, sin confundirlas', () => {
    let e = escenarioInicial(AHORA)
    const a = () => e.aspirantes.find((x) => x.id === 'DEMO-105')!
    assert.equal(proximaAccion(a(), e.solicitudes).tipo, 'seleccion')
    e = paso(e, { tipo: 'cerrarAlerta', id: 'DEMO-105', alertaId: 'ALT-D01', resolucion: 'Confirmó su zona' })
    e = paso(e, { tipo: 'habilitar', id: 'DEMO-105' })
    assert.match(proximaAccion(a(), e.solicitudes).texto, /^Incorporación: falta perfil/)
    for (let i = 1; i < PASOS_OPERACION.length; i++) e = paso(e, { tipo: 'avanzarOperacion', id: 'DEMO-105' })
    const disp = proximaAccion(a(), e.solicitudes)
    assert.equal(disp.texto, 'Disponible para recibir solicitudes.'); assert.equal(disp.solicitud, null)
    assert.doesNotMatch(disp.texto, /pasa al panel operativo/)
    e = paso(e, { tipo: 'crearSolicitud', id: 'DEMO-105' })
    const s = e.solicitudes.at(-1)!
    assert.match(proximaAccion(a(), e.solicitudes).solicitud!.texto, /aviso al Compita/i)
    e = paso(e, { tipo: 'avanzarSolicitud', solicitudId: s.id }); e = paso(e, { tipo: 'avanzarSolicitud', solicitudId: s.id })
    assert.match(proximaAccion(a(), e.solicitudes).solicitud!.texto, /videollamada/i)
    e = paso(e, { tipo: 'avanzarSolicitud', solicitudId: s.id })
    const fin = proximaAccion(a(), e.solicitudes)
    assert.equal(fin.texto, 'Disponible para recibir solicitudes.'); assert.match(fin.solicitud!.texto, /pendiente de validación real/)
  })
  test('una solicitud aceptada no muestra los botones Aceptar / No puedo, y el pago nunca se da por hecho', () => {
    const f = readFileSync('components/panel/confianza/FichaDemo.tsx', 'utf8')
    assert.match(f, /s\.paso === 1\s*\n?\s*\? <p aria-hidden/, 'los botones del mensaje solo se ven mientras espera respuesta, y no son interactivos')
    assert.match(f, /Solicitud aceptada por el Compita/)
    assert.match(f, /Pago del cliente: pendiente de validación real/)
  })
  test('los colores del módulo viven en lib/design.ts con prefijo cf y solo los usa el Sistema de Confianza', () => {
    const fuera: string[] = []
    const recorrer = (d: string) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) { if (f.name !== 'node_modules') recorrer(p) } else if (/\.(tsx?|css)$/.test(f.name) && /\b(bg|text|border|divide|ring|accent|outline)-cf-/.test(readFileSync(p, 'utf8'))) fuera.push(p) } }
    recorrer('app'); recorrer('components'); recorrer('lib')
    assert.deepEqual(fuera.filter((p) => !p.startsWith('components/panel/confianza/') && p !== 'app/tokens.generated.css' && p !== 'lib/design.ts'), [])
  })
})

describe('identidad del CMC (rediseño visual)', () => {
  test('el menú dice solo «CMC» y el encabezado «CMC» con el subtítulo pedido', () => {
    assert.equal(seccionesVisibles({ rol: 'admin', permisos: TODOS }).find((s) => s.id === 'confianza')!.texto, 'CMC')
    const marco = readFileSync('components/panel/confianza/MarcoConfianza.tsx', 'utf8')
    assert.match(marco, /<LogoCmc \/>CMC<\/span>/); assert.match(marco, /descripcion="Centro de Mando Compaz · Sistema de Confianza"/)
  })
  test('no se usa el símbolo anterior ni un logo provisional; el del CMC sale de su archivo original', () => {
    for (const f of readdirSync('components/panel/confianza')) assert.doesNotMatch(readFileSync(`components/panel/confianza/${f}`, 'utf8'), /simbolo-compaz|logo-nav|logo-icon/, f)
    assert.match(readFileSync('components/panel/confianza/LogoCmc.tsx', 'utf8'), /export const LOGO_CMC: string \| null =/)
  })
  test('el fondo blanco del área principal se aplica SOLO en el CMC; el resto del panel sigue igual', () => {
    assert.match(readFileSync('components/panel/MarcoPanel.tsx', 'utf8'), /actual === 'confianza' \? 'bg-blanco' : 'bg-fondo-claro'/)
  })
  test('el módulo no trae tipografías propias: usa la del panel', () => {
    for (const f of readdirSync('components/panel/confianza')) assert.doesNotMatch(readFileSync(`components/panel/confianza/${f}`, 'utf8'), /font-(display|serif|mono|bricolage)|fontFamily|next\/font/, f)
  })
})
