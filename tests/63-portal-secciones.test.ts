/* eslint-disable */
// Las pestañas del portal nuevo (Visitas, Mi familiar, Mi plan): qué bloques salen en cada situación (función pura), los datos contra la base
// y el menú. Los componentes viejos que se reutilizan (chat, fecha, dirección...) ya tienen sus propias pruebas.
import { db, limpiar, mkCliente, mkCompita, mkVisita, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { bloquesDeVisitas, esPestana, PESTANAS, type SituacionVisitas } from '@/lib/portal-secciones'
import { cargarDatosPortal } from '@/lib/portal-datos'
import NavPortal from '@/components/portal/NavPortal'
import SeccionPlan from '@/components/portal/SeccionPlan'

beforeEach(limpiar)
const sit = (o: Partial<SituacionVisitas> = {}): SituacionVisitas => ({ visita: null, puedeAgendarOtra: false, visitasTerminadas: 0, reportes: 0, vistaPrevia: false, ...o })

describe('qué bloques salen en la pestaña Visitas', () => {
  test('sin visitas: solo el mensaje de que aún no tiene', () => assert.deepEqual(bloquesDeVisitas(sit()), ['vacio']))
  test('coordinando la fecha: elegir fecha, chat, acciones, dirección y quién estará (en ese orden)', () => assert.deepEqual(bloquesDeVisitas(sit({ visita: 'pre_visita' })), ['fecha', 'chat', 'acciones_coordinacion', 'direccion', 'lugar']))
  test('visita programada: chat plegable, reagendar, llegada, dirección y quién estará', () => assert.deepEqual(bloquesDeVisitas(sit({ visita: 'programada' })), ['chat_plegable', 'reagendar', 'llegada', 'direccion', 'lugar']))
  test('visita en curso: videollamada y chat; con el compita recién llegado, solo el chat (confirmar está en Inicio)', () => {
    assert.deepEqual(bloquesDeVisitas(sit({ visita: 'en_curso' })), ['video', 'chat']); assert.deepEqual(bloquesDeVisitas(sit({ visita: 'confirmando_inicio' })), ['chat'])
  })
  test('sin visita activa y con visitas hechas: agendar otra, el bienestar y el historial', () => assert.deepEqual(bloquesDeVisitas(sit({ puedeAgendarOtra: true, visitasTerminadas: 3, reportes: 3 })), ['agendar_otra', 'bienestar', 'historial']))
  test('el bienestar solo sale si hay reportes y el historial solo si hay visitas terminadas', () => {
    assert.ok(!bloquesDeVisitas(sit({ visitasTerminadas: 2, reportes: 0 })).includes('bienestar')); assert.ok(bloquesDeVisitas(sit({ visitasTerminadas: 2 })).includes('historial')); assert.ok(!bloquesDeVisitas(sit({ reportes: 0 })).includes('historial'))
  })
  test('VISTA PREVIA del equipo: no salen los bloques que actúan o piden datos propios del cliente, pero sí lo que se puede mirar', () => {
    const b = bloquesDeVisitas(sit({ visita: 'pre_visita', puedeAgendarOtra: true, visitasTerminadas: 1, reportes: 1, vistaPrevia: true }))
    assert.deepEqual(b, ['chat', 'bienestar', 'historial']); for (const x of ['fecha', 'acciones_coordinacion', 'direccion', 'lugar', 'agendar_otra', 'reagendar', 'llegada']) assert.ok(!b.includes(x as any), x)
  })
  test('nunca devuelve una lista vacía ni bloques repetidos', () => {
    for (const v of [null, 'pre_visita', 'programada', 'en_curso', 'confirmando_inicio'] as const) for (const p of [true, false]) for (const prev of [true, false]) {
      const b = bloquesDeVisitas(sit({ visita: v, puedeAgendarOtra: p, visitasTerminadas: 1, reportes: 1, vistaPrevia: prev })); assert.ok(b.length > 0); assert.equal(new Set(b).size, b.length)
    }
  })
})

describe('el menú', () => {
  test('las 4 pestañas existen y esPestana rechaza lo demás', () => { assert.deepEqual(PESTANAS.map((p) => p.id), ['inicio', 'visitas', 'familiar', 'plan']); for (const x of ['', 'admin', 'x', null, 3, undefined]) assert.equal(esPestana(x), false) })
  test('los enlaces llevan ?sec=, Inicio no lleva nada, y la vista previa se conserva al cambiar de pestaña', () => {
    const h = renderToStaticMarkup(createElement(NavPortal, { actual: 'visitas', preview: 'abc-123' }))
    assert.match(h, /href="\/portal\?preview=abc-123"/); assert.match(h, /href="\/portal\?sec=visitas&amp;preview=abc-123"/); assert.match(h, /href="\/portal\?sec=plan&amp;preview=abc-123"/)
    const sin = renderToStaticMarkup(createElement(NavPortal, { actual: 'inicio' })); assert.match(sin, /href="\/portal"/); assert.doesNotMatch(sin, /preview/)
  })
  test('marca la pestaña actual para lectores de pantalla y hay dos menús (arriba en escritorio, abajo en móvil)', () => {
    const h = renderToStaticMarkup(createElement(NavPortal, { actual: 'plan' })); assert.equal((h.match(/aria-current="page"/g) ?? []).length, 2); assert.equal((h.match(/<nav /g) ?? []).length, 2); assert.match(h, /lg:hidden/); assert.match(h, /hidden[^"]*lg:flex/)
  })
})

describe('los datos de las pestañas contra la base', () => {
  test('un cliente nuevo: todo vacío, sin compita ni plan', async () => {
    const c = mkCliente(); const d = await cargarDatosPortal(c.id)
    assert.equal(d.compita, null); assert.equal(d.visitaPreVisita, null); assert.deepEqual(d.visitasPasadas, []); assert.deepEqual(d.pagos, []); assert.equal(d.pendientePago, null)
  })
  test('con una visita en coordinación: la trae con su compita y sus mensajes', async () => {
    const c = mkCliente(); const k = mkCompita({ nombre: 'Rosa Linares' }); Object.assign(c, { compita_id: k.id }); const v = mkVisita(c, k, { estado: 'pre_visita' })
    db.seed('mensajes', { visit_id: v.id, origen: 'compita', tipo: 'texto', contenido: 'Hola, ¿qué día te viene bien?' })
    const d = await cargarDatosPortal(c.id); assert.equal(d.visitaPreVisita?.id, v.id); assert.equal(d.visitaPreVisita?.compita.nombre, 'Rosa Linares'); assert.equal(d.mensajes.length, 1); assert.equal(d.compita?.nombre, 'Rosa Linares')
  })
  test('visitas terminadas: el historial trae su compita y su reporte; los reportes salen en orden', async () => {
    const c = mkCliente(); const k = mkCompita(); const a = mkVisita(c, k, { estado: 'terminada' }); const b = mkVisita(c, k, { estado: 'terminada' })
    db.seed('reportes_visita', { visita_id: a.id, animo: 3, fisico: 3, participacion: 3, entorno: 4, created_at: '2026-10-01T10:00:00Z' }); db.seed('reportes_visita', { visita_id: b.id, animo: 5, fisico: 4, participacion: 5, entorno: 5, created_at: '2026-10-08T10:00:00Z' })
    const d = await cargarDatosPortal(c.id); assert.equal(d.visitasPasadas.length, 2); assert.deepEqual(d.reportes.map((r) => r.animo), [3, 5])
  })
  test('el plan y los pagos: cuántas visitas le quedan y su historial (los anulados no cuentan)', async () => {
    const c = mkCliente(); db.seed('pagos_plan', { usuario_id: c.id, tipo: 'plan', plan: 'quincenal', visitas: 2, monto_usd: 75, metodo: 'zelle', estado: 'activo', inicio: new Date().toISOString(), vence: new Date(Date.now() + 60 * 86400_000).toISOString() })
    db.seed('pagos_plan', { usuario_id: c.id, tipo: 'plan', plan: 'semanal', visitas: 4, monto_usd: 140, metodo: 'zelle', estado: 'anulado', inicio: new Date().toISOString(), vence: new Date(Date.now() + 60 * 86400_000).toISOString() })
    const d = await cargarDatosPortal(c.id); assert.equal(d.pagos.length, 2); assert.equal(d.cupo?.restantes, 2)
  })
  test('un pago pendiente trae su referencia y las instrucciones', async () => {
    const c = mkCliente(); db.seed('solicitudes_pago', { usuario_id: c.id, estado: 'pendiente', tipo: 'plan', plan: 'quincenal', monto_usd: 75, metodo: 'zelle' })
    const d = await cargarDatosPortal(c.id); assert.ok(d.pendientePago); assert.match(d.pendientePago!.referencia, /^COMPAZ-/); assert.ok(Array.isArray(d.pendientePago!.lineas))
  })
  test('AISLAMIENTO de visitas en vivo: las visitas en curso o en coordinación de otro cliente no aparecen', async () => {
    const a = mkCliente({ email: 'a@mail.test' }); const b = mkCliente({ email: 'b@mail.test' }); const k = mkCompita(); const k2 = mkCompita()
    mkVisita(b, k, { estado: 'en_curso' }); mkVisita(b, k2, { estado: 'pre_visita' })
    const d = await cargarDatosPortal(a.id); assert.equal(d.visitaActiva, null); assert.equal(d.visitaPreVisita, null)
  })
  test('los mensajes son SOLO los de la visita del cliente, aunque haya mensajes de otras visitas', async () => {
    const a = mkCliente({ email: 'a@mail.test' }); const b = mkCliente({ email: 'b@mail.test' }); const k = mkCompita(); const k2 = mkCompita()
    const va = mkVisita(a, k, { estado: 'programada', fecha_programada: '2099-01-10' }); const vb = mkVisita(b, k2, { estado: 'programada', fecha_programada: '2099-01-11' })
    db.seed('mensajes', { visit_id: va.id, origen: 'compita', tipo: 'texto', contenido: 'para a' }); db.seed('mensajes', { visit_id: vb.id, origen: 'compita', tipo: 'texto', contenido: 'para b' })
    const d = await cargarDatosPortal(a.id); assert.deepEqual(d.mensajes.map((m: any) => m.contenido), ['para a'])
  })
  test('AISLAMIENTO: un cliente nunca recibe visitas, mensajes, pagos ni reportes de otro', async () => {
    const a = mkCliente({ email: 'a@mail.test' }); const b = mkCliente({ email: 'b@mail.test' }); const k = mkCompita()
    const vb = mkVisita(b, k, { estado: 'programada', fecha_programada: '2099-01-10' }); db.seed('mensajes', { visit_id: vb.id, origen: 'cliente', tipo: 'texto', contenido: 'secreto de b' })
    db.seed('pagos_plan', { usuario_id: b.id, tipo: 'plan', plan: 'quincenal', visitas: 2, monto_usd: 75, metodo: 'zelle', estado: 'activo', inicio: new Date().toISOString(), vence: new Date(Date.now() + 86400_000).toISOString() })
    const d = await cargarDatosPortal(a.id); assert.equal(d.visitaProgramada, null); assert.deepEqual(d.mensajes, []); assert.deepEqual(d.pagos, []); assert.doesNotMatch(JSON.stringify(d), /secreto de b/)
  })
})

describe('las secciones', () => {
  test('Mi plan: muestra el plan, lo que le queda y los pagos, y nunca pide pagar por teléfono', async () => {
    const c = mkCliente(); db.seed('pagos_plan', { usuario_id: c.id, tipo: 'plan', plan: 'quincenal', visitas: 2, monto_usd: 75, metodo: 'zelle', estado: 'activo', inicio: new Date().toISOString(), vence: new Date(Date.now() + 60 * 86400_000).toISOString() })
    const h = renderToStaticMarkup(createElement(SeccionPlan, { d: await cargarDatosPortal(c.id), vistaPrevia: true }))
    assert.match(h, /Plan actual/); assert.match(h, /Te quedan/); assert.match(h, /\$75/); assert.match(h, /nunca te pedirá un pago por teléfono o mensaje/i)
  })
  test('Mi plan sin plan: dice que todavía no tiene y que los pagos están vacíos', async () => {
    const h = renderToStaticMarkup(createElement(SeccionPlan, { d: await cargarDatosPortal(mkCliente().id), vistaPrevia: true })); assert.match(h, /Todavía no tienes un plan/); assert.match(h, /Todavía no hay pagos/)
  })
  test('con la vista previa del equipo no se muestra el formulario de pago (actuaría con la sesión del equipo)', () => {
    assert.match(readFileSync(join(process.cwd(), 'components/portal/SeccionPlan.tsx'), 'utf8'), /!vistaPrevia && <PlanesPago/)
    assert.match(readFileSync(join(process.cwd(), 'components/portal/SeccionFamiliar.tsx'), 'utf8'), /!vistaPrevia && !fichaCompleta/)
  })
  test('la página no consulta la base directamente (las consultas viven en lib/)', () => {
    for (const f of ['app/portal/page.tsx', 'components/portal/SeccionVisitas.tsx', 'components/portal/SeccionFamiliar.tsx', 'components/portal/SeccionPlan.tsx']) assert.doesNotMatch(readFileSync(join(process.cwd(), f), 'utf8'), /\.from\('/, f)
  })
  test('sin colores escritos a mano en lo nuevo', () => {
    for (const f of ['app/portal/page.tsx', 'components/portal/NavPortal.tsx', 'components/portal/SeccionVisitas.tsx', 'components/portal/SeccionFamiliar.tsx', 'components/portal/SeccionPlan.tsx']) assert.doesNotMatch(readFileSync(join(process.cwd(), f), 'utf8'), /#[0-9A-Fa-f]{6}\b/, f)
  })
})
