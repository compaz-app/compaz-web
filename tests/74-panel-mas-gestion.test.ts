/* eslint-disable */
// Más: Reseñas, Pagos, Avisos enviados y Cobertura.
import { db, limpiar, mkCliente, mkCompita, mkSolicitud, ahoraMas } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { coberturaPorEstado, paginaDe, resenaCritica, nombreDePlantilla, HUB } from '@/lib/panel-mas-tipos'
import { estadosDeZona } from '@/lib/panel-personas-tipos'
import { listarResenas, listarPagosRecientes, listarAvisos, cargarCobertura } from '@/lib/panel-mas-datos'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const actor = (rol: 'admin' | 'colaborador', p: any = {}): Actor => ({ id: 'u1', correo: 'x@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } })

describe('lógica pura', () => {
  test('cobertura: falta reclutar sin compitas o cuando la demanda duplica la oferta; los estados vacíos no salen', () => {
    const f = coberturaPorEstado(
      [{ zona: 'Zulia — Maracaibo, Lara — Iribarren', activo: true }, { zona: 'Zulia — Cabimas', activo: true }, { zona: 'Bolívar — Caroní', activo: false }],
      ['Zulia — Maracaibo', 'Zulia — Maracaibo', 'Zulia — Maracaibo', 'Zulia — Maracaibo', 'Lara — Iribarren', 'Falcón — Coro', ''], estadosDeZona)
    const por = Object.fromEntries(f.map((x) => [x.estado, x]))
    assert.equal(por.Zulia.compitas, 2); assert.equal(por.Zulia.solicitudes, 4); assert.equal(por.Zulia.falta, true)
    assert.equal(por.Lara.falta, false); assert.equal(por['Falcón'].compitas, 0); assert.equal(por['Falcón'].falta, true)
    assert.equal(por['Bolívar'], undefined); assert.equal(f[0].falta, true)
  })
  test('páginas, reseñas críticas y nombres de plantilla', () => {
    assert.deepEqual(paginaDe('99', 60), { pag: 3, paginas: 3, desde: 50, hasta: 75 }); assert.equal(paginaDe('-4', 10).pag, 1); assert.equal(paginaDe('x', 0).paginas, 1)
    assert.equal(resenaCritica({ estrellas: 3 }), true); assert.equal(resenaCritica({ estrellas: 4 }), false); assert.equal(nombreDePlantilla('pago_confirmado'), 'Pago confirmado')
  })
  test('las cuatro herramientas ya están marcadas como hechas en el menú', () => { for (const id of ['resenas', 'pagos', 'avisos', 'cobertura']) assert.equal(HUB.find((h) => h.id === id)!.listo, true, id) })
})

describe('datos reales', () => {
  test('reseñas con el nombre del cliente y del compita, y el texto sin teléfonos si no hay permiso', async () => {
    const c = mkCompita({ nombre: 'Rosa', apellido: 'Díaz' } as any), cli = mkCliente({ nombre: 'Ana' } as any)
    db.seed('resenas', { id: 'r1', compita_id: c.id, cliente_id: cli.id, texto: 'Excelente, escríbeme al +58 414 1234567', estrellas: 5, publicada: false, created_at: new Date().toISOString() })
    const [r] = await listarResenas(actor('colaborador', { atender: true })); assert.equal(r.cliente, 'Ana'); assert.equal(r.compita, 'Rosa Díaz'); assert.doesNotMatch(r.texto, /414 1234567/)
    assert.match((await listarResenas(actor('admin')))[0].texto, /414 1234567/)
  })
  test('pagos con cliente, plan y estado anulado', async () => {
    const cli = mkCliente({ nombre: 'Ana' } as any)
    db.seed('pagos_plan', { id: 'p1', usuario_id: cli.id, tipo: 'plan', plan: 'quincenal', visitas: 2, monto_usd: 75, metodo: 'zelle', referencia: 'COMPAZ-ABC', estado: 'activo', created_at: ahoraMas(-10) })
    db.seed('pagos_plan', { id: 'p2', usuario_id: cli.id, tipo: 'extra', horas: 3, monto_usd: 66, metodo: 'otro', estado: 'anulado', anulado_motivo: 'pagó dos veces', created_at: ahoraMas(-5) })
    const l = await listarPagosRecientes(); assert.equal(l.length, 2); assert.equal(l[0].anulado, true); assert.equal(l[0].plan, 'Visita extra de 3 h'); assert.equal(l[1].plan, 'Compañía'); assert.equal(l[1].cliente, 'Ana')
  })
  test('avisos con el nombre de la persona; la marca interna de la escalera no sale', async () => {
    const c = mkCompita({ nombre: 'Rosa' } as any), cli = mkCliente({ nombre: 'Ana' } as any)
    db.seed('avisos', { destinatario_tipo: 'compita', destinatario_id: c.id, canal: 'telegram', plantilla: 'solicitud_nueva', estado: 'fallido', error: 'bot bloqueado', intentos: 2, programado_para: ahoraMas(-3) })
    db.seed('avisos', { destinatario_tipo: 'cliente', destinatario_id: cli.id, canal: 'correo', plantilla: 'pago_confirmado', estado: 'enviado', intentos: 1, programado_para: ahoraMas(-9) })
    db.seed('avisos', { destinatario_tipo: 'admin', canal: 'telegram', plantilla: 'escalera_tarea', estado: 'enviado', intentos: 0, programado_para: ahoraMas(-1) })
    const l = await listarAvisos(); assert.equal(l.length, 2); assert.equal(l[0].para, 'Rosa'); assert.equal(l[0].estado, 'fallido'); assert.equal(l[1].para, 'Ana')
  })
  test('cobertura: compitas activos y solicitudes del mes por estado', async () => {
    const c = mkCompita({ zona: 'Zulia — Maracaibo', estado: 'activo', verificado: true } as any), cli = mkCliente({ zona: 'Zulia — Maracaibo' } as any), cli2 = mkCliente({ zona: 'Falcón — Coro' } as any)
    mkSolicitud(cli, c, { created_at: ahoraMas(-60) }); mkSolicitud(cli2, c, { created_at: ahoraMas(-120) }); mkSolicitud(cli, c, { created_at: new Date(Date.now() - 40 * 86400_000).toISOString() })
    const f = await cargarCobertura(); const por = Object.fromEntries(f.map((x) => [x.estado, x]))
    assert.equal(por.Zulia.compitas, 1); assert.equal(por.Zulia.solicitudes, 1); assert.equal(por['Falcón'].falta, true)
  })
})

describe('guardias de código', () => {
  test('las acciones del navegador no importan código de servidor y la página conecta las cuatro', () => {
    for (const f of ['AccionResena', 'AnularPago']) assert.doesNotMatch(readFileSync(`components/panel/mas/${f}.tsx`, 'utf8'), /supabase-server|lib\/panel-mas-datos|lib\/permisos'|\.from\(/, f)
    const p = readFileSync('app/panel/page.tsx', 'utf8'); for (const f of ['listarResenas', 'listarPagosRecientes', 'listarAvisos', 'cargarCobertura']) assert.match(p, new RegExp(f), f)
  })
})
