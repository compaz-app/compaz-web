/* eslint-disable */
// En qué paso está el cliente. La decisión es una función PURA (sin base de datos): se prueba caso por caso, y una prueba de cobertura exige
// que CADA estado sea alcanzable y tenga su tarjeta completa (título, texto, botones con su ⓘ). Más recorridos reales contra la base falsa.
import { db, limpiar, mkCliente, mkCompita, mkSolicitud, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { decidirEstado, estadoDelCliente, CODIGOS_ESTADO, PASOS_PORTAL, pasoDe, inicioVisita, type FotoCliente, type SolicitudFoto, type VisitaFoto, type CodigoEstado } from '@/lib/estado-cliente'
import { tarjetaDelEstado, CATALOGO_PORTAL } from '@/lib/portal-estados'

beforeEach(limpiar)
const AHORA = new Date('2026-11-10T15:00:00.000Z') // 11:00 am en Caracas
const min = (n: number) => new Date(AHORA.getTime() + n * 60_000).toISOString()
const foto = (o: Partial<FotoCliente> = {}): FotoCliente => ({ ahora: AHORA, pausada: false, fichaCompleta: true, zonaHoraria: null, nombre: 'Carolina Rojas', compitaAsignado: null, solicitudes: [], pagoPendiente: null, cupo: null, visitas: [], cancelaciones: [], ...o })
const sol = (o: Partial<SolicitudFoto> = {}): SolicitudFoto => ({ id: 's1', estado: 'pendiente', tipo: 'entrevista', compitaId: 'c1', compitaNombre: 'María Pérez Gómez', slotConfirmado: null, slotsPropuestos: 0, seguimientoEnviado: false, tokenRespuesta: true, clienteDijoNo: false, motivoRegistrado: false, avisoEntregado: false, reserva: null, creadaEn: min(-120), ...o })
const vis = (o: Partial<VisitaFoto> = {}): VisitaFoto => ({ id: 'v1', estado: 'programada', compitaNombre: 'María Pérez Gómez', fechaProgramada: '2026-11-12', horaInicio: '10:00', llegadaEn: null, sinAccesoEn: null, fin: null, creadaEn: min(-5000), ...o })
const COMPITA = { id: 'c1', nombre: 'María Pérez Gómez' }
const codigo = (f: FotoCliente) => decidirEstado(f).codigo

// Cada caso es un estado distinto y su foto mínima. La prueba de cobertura exige que no falte ninguno.
const CASOS: Record<CodigoEstado, FotoCliente> = {
  bienvenida: foto(),
  solicitud_enviada: foto({ solicitudes: [sol()] }),
  solicitud_recibida: foto({ solicitudes: [sol({ avisoEntregado: true })] }),
  directa_enviada: foto({ solicitudes: [sol({ tipo: 'directa' })] }),
  mandado_enviado: foto({ solicitudes: [sol({ tipo: 'mandado' })] }),
  todas_rechazadas: foto({ solicitudes: [sol({ estado: 'rechazada' }), sol({ id: 's2', estado: 'rechazada' })] }),
  elegir_horario: foto({ solicitudes: [sol({ estado: 'aceptada' })] }),
  horario_pedido: foto({ solicitudes: [sol({ estado: 'aceptada', reserva: 'reservada' })] }),
  horario_rechazado: foto({ solicitudes: [sol({ estado: 'aceptada', reserva: 'rechazada' })] }),
  entrevista_programada: foto({ solicitudes: [sol({ estado: 'aceptada', slotConfirmado: min(24 * 60) })] }),
  entrevista_ahora: foto({ solicitudes: [sol({ estado: 'aceptada', slotConfirmado: min(30) })] }),
  decidir: foto({ solicitudes: [sol({ estado: 'aceptada', slotConfirmado: min(-40) })] }),
  motivo_no: foto({ solicitudes: [sol({ estado: 'rechazada', clienteDijoNo: true })] }),
  directa_aceptada: foto({ solicitudes: [sol({ estado: 'aceptada', tipo: 'directa' })] }),
  pagar: foto({ pagoPendiente: { id: 'p1', insistido: false } }),
  pago_revision: foto({ pagoPendiente: { id: 'p1', insistido: true }, fichaCompleta: false }),
  ficha_lista_espera: foto({ pagoPendiente: { id: 'p1', insistido: true } }),
  ficha: foto({ compitaAsignado: COMPITA, fichaCompleta: false, visitas: [vis({ estado: 'pre_visita', fechaProgramada: null })] }),
  agendar_visita: foto({ compitaAsignado: COMPITA, visitas: [vis({ estado: 'pre_visita', fechaProgramada: null })] }),
  cita_pendiente: foto({ compitaAsignado: COMPITA, visitas: [vis({ estado: 'pre_visita', fechaProgramada: null, citaPropuesta: { fecha: '2026-11-12', inicio: '10:00' } })] }),
  visita_programada: foto({ compitaAsignado: COMPITA, visitas: [vis()] }),
  compita_llego: foto({ visitas: [vis({ estado: 'confirmando_inicio', llegadaEn: min(-2) })] }),
  nadie_abre: foto({ visitas: [vis({ llegadaEn: min(-10), sinAccesoEn: min(-9) })] }),
  visita_en_curso: foto({ visitas: [vis({ estado: 'en_curso' })] }),
  visita_interrumpida: foto({ cancelaciones: [{ visitaId: 'v1', por: 'compita', justificadaPor: 'sistema: salida por seguridad', creadaEn: min(-60) }] }),
  visita_cancelada_equipo: foto({ cancelaciones: [{ visitaId: 'v1', por: 'compita', justificadaPor: 'admin: equipo@compaz.com', creadaEn: min(-60) }] }),
  visita_terminada: foto({ compitaAsignado: COMPITA, visitas: [vis({ estado: 'terminada', fin: min(-90) })] }),
  agendar_otra: foto({ compitaAsignado: COMPITA, cupo: { restantes: 2 } }),
  plan_agotado: foto({ compitaAsignado: COMPITA, cupo: { restantes: 0 } }),
  cuenta_pausada: foto({ pausada: true }),
}

describe('cada estado se decide como debe (función pura)', () => {
  for (const c of CODIGOS_ESTADO) test(`${c}`, () => { assert.equal(codigo(CASOS[c]), c); assert.equal(decidirEstado(CASOS[c]).paso, pasoDe(c)) })
  test('COBERTURA: los casos cubren TODOS los estados y ninguno sobra', () => {
    assert.deepEqual(Object.keys(CASOS).sort(), [...CODIGOS_ESTADO].sort())
  })
  test('cada estado cae en un paso real de la barra de progreso', () => {
    for (const c of CODIGOS_ESTADO) assert.ok(pasoDe(c) >= 0 && pasoDe(c) < PASOS_PORTAL.length, c)
  })
  test('la misma foto siempre da el mismo estado, y la foto no se modifica', () => {
    for (const c of CODIGOS_ESTADO) { const f = CASOS[c]; const copia = JSON.stringify(f); assert.equal(codigo(f), codigo(f)); assert.equal(JSON.stringify(f), copia) }
  })
})

describe('prioridades: lo que pasa en vivo manda', () => {
  const todo = { solicitudes: [sol({ estado: 'aceptada', slotConfirmado: min(30) })], pagoPendiente: { id: 'p', insistido: false } }
  test('una visita en curso gana a solicitudes, pagos y entrevistas', () => assert.equal(codigo(foto({ ...todo, visitas: [vis({ estado: 'en_curso' })] })), 'visita_en_curso'))
  test('el compita que llegó gana a una visita programada', () => assert.equal(codigo(foto({ visitas: [vis(), vis({ id: 'v2', estado: 'confirmando_inicio' })] })), 'compita_llego'))
  test('una cuenta pausada gana a todo', () => assert.equal(codigo(foto({ ...todo, pausada: true, visitas: [vis({ estado: 'en_curso' })] })), 'cuenta_pausada'))
  test('con varias visitas programadas muestra la más próxima', () => {
    const e = decidirEstado(foto({ visitas: [vis({ id: 'lejana', fechaProgramada: '2026-11-20' }), vis({ id: 'cercana', fechaProgramada: '2026-11-11' })] }))
    assert.equal(e.visitaId, 'cercana')
  })
  test('una hora propuesta sin confirmar gana a la fecha anterior de la visita, y se muestra la propuesta', () => {
    const e = decidirEstado(foto({ visitas: [vis({ fechaProgramada: '2026-11-11', citaPropuesta: { fecha: '2026-11-14', inicio: '15:00' } })] }))
    assert.equal(e.codigo, 'cita_pendiente'); assert.equal(e.cuando, '2026-11-14T19:00:00.000Z')
  })
  test('sin ficha NO se puede agendar: primero la ficha, aunque la visita ya exista', () => assert.equal(codigo(foto({ fichaCompleta: false, visitas: [vis({ estado: 'pre_visita', fechaProgramada: null })] })), 'ficha'))
  test('un aviso de cancelación o interrupción vence a las 72 horas', () => {
    assert.equal(codigo(foto({ cancelaciones: [{ visitaId: null, por: 'compita', justificadaPor: 'admin: x', creadaEn: min(-71 * 60) }] })), 'visita_cancelada_equipo')
    assert.equal(codigo(foto({ cancelaciones: [{ visitaId: null, por: 'compita', justificadaPor: 'admin: x', creadaEn: min(-73 * 60) }] })), 'bienvenida')
  })
  test('una cancelación normal (sin justificar) no muestra aviso especial', () => assert.equal(codigo(foto({ cancelaciones: [{ visitaId: 'v', por: 'cliente', justificadaPor: null, creadaEn: min(-10) }] })), 'bienvenida'))
  test('"¿cómo te fue?" aparece 12 horas tras terminar y luego vuelve a lo de siempre', () => {
    assert.equal(codigo(foto({ compitaAsignado: COMPITA, cupo: { restantes: 1 }, visitas: [vis({ estado: 'terminada', fin: min(-11 * 60) })] })), 'visita_terminada')
    assert.equal(codigo(foto({ compitaAsignado: COMPITA, cupo: { restantes: 1 }, visitas: [vis({ estado: 'terminada', fin: min(-13 * 60) })] })), 'agendar_otra')
  })
})

describe('la entrevista y la decisión', () => {
  test('la entrevista es "ahora" desde 1 hora antes y hasta 25 minutos después; luego toca decidir', () => {
    const c = (m: number) => codigo(foto({ solicitudes: [sol({ estado: 'aceptada', slotConfirmado: min(m) })] }))
    assert.equal(c(61), 'entrevista_programada'); assert.equal(c(59), 'entrevista_ahora'); assert.equal(c(-10), 'entrevista_ahora'); assert.equal(c(-24), 'entrevista_ahora'); assert.equal(c(-26), 'decidir')
  })
  test('decidir también si el sistema ya marcó el seguimiento, o la solicitud quedó completada', () => {
    assert.equal(codigo(foto({ solicitudes: [sol({ estado: 'aceptada', seguimientoEnviado: true })] })), 'decidir')
    assert.equal(codigo(foto({ solicitudes: [sol({ estado: 'completada' })] })), 'decidir')
  })
  test('con el compita ya asignado no se vuelve a pedir decidir sobre él', () => {
    assert.notEqual(codigo(foto({ compitaAsignado: COMPITA, solicitudes: [sol({ estado: 'completada' })] })), 'decidir')
  })
  test('el motivo de "no" se pide una sola vez: si ya lo dio, no vuelve a aparecer', () => {
    assert.equal(codigo(foto({ solicitudes: [sol({ estado: 'rechazada', clienteDijoNo: true, motivoRegistrado: true })] })), 'todas_rechazadas')
  })
  test('pedir otra hora rechazada: una reserva vencida o liberada vuelve a "elegir hora"', () => {
    assert.equal(codigo(foto({ solicitudes: [sol({ estado: 'aceptada', reserva: 'vencida' })] })), 'elegir_horario')
    assert.equal(codigo(foto({ solicitudes: [sol({ estado: 'aceptada', reserva: 'liberada' })] })), 'elegir_horario')
  })
  test('el inicio de una visita se calcula en hora de Venezuela', () => assert.equal(inicioVisita({ fechaProgramada: '2026-11-12', horaInicio: '10:00' })!.toISOString(), '2026-11-12T14:00:00.000Z'))
})

describe('cada estado tiene su tarjeta completa', () => {
  const ctx = (c: CodigoEstado, o: any = {}) => ({ estado: { codigo: c, paso: pasoDe(c), compitaNombre: 'María Pérez Gómez', solicitudId: 's1', cuando: min(24 * 60) }, pagado: false, zonaCliente: 'America/New_York', ...o })
  const SIN_BOTON_A_PROPOSITO: CodigoEstado[] = ['visita_en_curso', 'cuenta_pausada']
  test('el catálogo cubre todos los estados y ninguno sobra', () => assert.deepEqual(Object.keys(CATALOGO_PORTAL).sort(), [...CODIGOS_ESTADO].sort()))
  test('título y texto reales, sin "undefined" y de largo razonable', () => {
    for (const c of CODIGOS_ESTADO) { const t = tarjetaDelEstado(ctx(c)); assert.ok(t.titulo.length >= 10 && t.titulo.length <= 80, `${c}: título`); assert.ok(t.texto.length >= 20 && t.texto.length <= 260, `${c}: texto (${t.texto.length})`); assert.doesNotMatch(t.titulo + t.texto, /undefined|NaN|null|\[object/, c) }
  })
  test('TODO botón trae su ⓘ explicando qué hace (regla del sistema)', () => {
    for (const c of CODIGOS_ESTADO) { const t = tarjetaDelEstado(ctx(c)); for (const b of [t.principal, t.secundario].filter(Boolean)) { assert.ok(b!.info.length >= 30, `${c}: ⓘ de "${b!.texto}"`); assert.ok(b!.texto.length >= 4, c) } }
  })
  test('cada estado ofrece un camino o es una espera explícita (nadie queda en el aire)', () => {
    for (const c of CODIGOS_ESTADO) { const t = tarjetaDelEstado(ctx(c)); const tiene = !!(t.principal || t.secundario); assert.equal(tiene, !SIN_BOTON_A_PROPOSITO.includes(c), `${c}: ${tiene ? 'tiene' : 'no tiene'} botón`) }
  })
  test('los destinos son rutas internas o acciones conocidas (nunca un enlace externo ni vacío)', () => {
    for (const c of CODIGOS_ESTADO) { const t = tarjetaDelEstado(ctx(c)); for (const b of [t.principal, t.secundario].filter(Boolean)) { const d = b!.destino; if ('ruta' in d) assert.match(d.ruta, /^\/[a-z]/, c); else assert.ok(['avisar_pago', 'confirmar_inicio', 'avisar_abrieron', 'avisar_equipo'].includes(d.accion), c) } }
  })
  test('PRIVACIDAD: antes de pagar solo "María P."; con el pago, el nombre', () => {
    const antes = tarjetaDelEstado(ctx('solicitud_recibida')); assert.match(antes.titulo, /María P\./); assert.doesNotMatch(antes.titulo + antes.texto, /Pérez|Gómez/)
    const despues = tarjetaDelEstado(ctx('agendar_visita', { pagado: true })); assert.match(despues.titulo, /María Pérez/)
  })
  test('la hora de la entrevista sale en la hora del cliente y en la de Caracas', () => {
    const t = tarjetaDelEstado(ctx('entrevista_programada')); assert.match(t.texto, /tu hora/); assert.match(t.texto, /Caracas/)
  })
  test('el estado "nadie abre" y los interrumpidos usan tono de alerta; las esperas, de espera', () => {
    assert.equal(tarjetaDelEstado(ctx('nadie_abre')).tono, 'alerta'); assert.equal(tarjetaDelEstado(ctx('visita_interrumpida')).tono, 'alerta'); assert.equal(tarjetaDelEstado(ctx('solicitud_recibida')).tono, 'espera')
  })
})

describe('recorridos reales contra la base (cargarFoto)', () => {
  const ahora = new Date()
  test('un cliente nuevo sin nada: bienvenida', async () => { const c = mkCliente(); assert.equal((await estadoDelCliente(c.id, ahora)).codigo, 'bienvenida') })
  test('solicitud enviada: "enviada" y, cuando el aviso le llega al compita, "recibida"', async () => {
    const c = mkCliente(); const k = mkCompita({ nombre: 'María Pérez' }); const s = mkSolicitud(c, k, { estado: 'pendiente', tipo: 'entrevista' })
    assert.equal((await estadoDelCliente(c.id, ahora)).codigo, 'solicitud_enviada')
    db.seed('avisos', { plantilla: 'solicitud_nueva', entidad_id: s.id, estado: 'enviado' })
    assert.equal((await estadoDelCliente(c.id, ahora)).codigo, 'solicitud_recibida')
  })
  test('aceptada sin hora: elegir; con reserva viva: hora pedida; con hora futura: programada', async () => {
    const c = mkCliente(); const k = mkCompita(); const s = mkSolicitud(c, k, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [] })
    assert.equal((await estadoDelCliente(c.id, ahora)).codigo, 'elegir_horario')
    db.seed('reservas_horario', { solicitud_id: s.id, compita_id: k.id, cliente_id: c.id, inicio: new Date(Date.now() + 86400_000).toISOString(), vence_en: new Date(Date.now() + 7200_000).toISOString(), estado: 'reservada' })
    assert.equal((await estadoDelCliente(c.id, ahora)).codigo, 'horario_pedido')
    db.rows('solicitudes')[0].slot_confirmado = new Date(Date.now() + 86400_000).toISOString()
    assert.equal((await estadoDelCliente(c.id, ahora)).codigo, 'entrevista_programada')
  })
  test('pago pedido y luego "ya pagué": con ficha pendiente invita a completarla; con ficha lista solo espera', async () => {
    const c = mkCliente({ familiar_nombre: null }); const p = db.seed('solicitudes_pago', { usuario_id: c.id, estado: 'pendiente', tipo: 'plan', plan: 'quincenal', monto_usd: 75, metodo: 'zelle' })
    assert.equal((await estadoDelCliente(c.id, ahora)).codigo, 'pagar')
    db.seed('eventos', { entidad: 'pago', entidad_id: p.id, tipo: 'pago_insistido', actor: 'cliente:x', datos: {} })
    assert.equal((await estadoDelCliente(c.id, ahora)).codigo, 'pago_revision')
  })
  test('visita programada en el futuro y en curso', async () => {
    const c = mkCliente(); const k = mkCompita({ nombre: 'Rosa Linares' }); const v = mkVisita(c, k, { estado: 'programada', fecha_programada: '2099-01-10', hora_inicio_programada: '09:00' })
    const e = await estadoDelCliente(c.id, ahora); assert.equal(e.codigo, 'visita_programada'); assert.equal(e.compitaNombre, 'Rosa Linares')
    v.estado = 'en_curso'; assert.equal((await estadoDelCliente(c.id, ahora)).codigo, 'visita_en_curso')
  })
  test('salida por seguridad reciente: "la visita se interrumpió"', async () => {
    const c = mkCliente(); const k = mkCompita()
    db.seed('cancelaciones', { visita_id: null, compita_id: k.id, usuario_id: c.id, cancelado_por: 'compita', justificada: true, justificada_por: 'sistema: salida por seguridad', creado_en: new Date().toISOString() })
    assert.equal((await estadoDelCliente(c.id, ahora)).codigo, 'visita_interrumpida')
  })
  test('el estado de un cliente nunca mezcla datos de otro', async () => {
    const a = mkCliente(); const b = mkCliente(); const k = mkCompita(); mkVisita(b, k, { estado: 'en_curso' })
    assert.equal((await estadoDelCliente(a.id, ahora)).codigo, 'bienvenida'); assert.equal((await estadoDelCliente(b.id, ahora)).codigo, 'visita_en_curso')
  })
})
