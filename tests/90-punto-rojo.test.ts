/* eslint-disable */
// Punto rojo del menú: cuenta lo pendiente (Bandeja y pagos) con las mismas guardias de permiso que el resto del panel.
import { db, limpiar, session } from './harness'
import { NextRequest } from 'next/server'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contarTareas, contarPagosPorConfirmar } from '@/lib/panel-pendientes'
import { GET as pendientesBandeja } from '@/app/api/admin/pendientes-bandeja/route'
import { GET as pendientesPagos } from '@/app/api/admin/pendientes-pagos/route'

beforeEach(limpiar)
const como = (correo: string | null) => { session.user = correo ? { id: `id-${correo}`, email: correo } : null }
const flag = (resuelto: boolean, cuando = new Date().toISOString()) => db.seed('admin_flags', { entidad_tipo: 'cliente', entidad_id: 'x', entidad_nombre: 'x', nota: 'x', resuelto, tipo: null, reportado_por: 'x', prioridad: 2, created_at: cuando })
const get = (q = '') => new NextRequest(`http://localhost/api/admin/pendientes-bandeja${q}`)

describe('contadores', () => {
  test('cuentan solo las tareas abiertas y los pagos pendientes', async () => {
    flag(false); flag(false); flag(true)
    db.seed('solicitudes_pago', { usuario_id: 'u', tipo: 'plan', plan: 'carta', monto_usd: 1, metodo: 'zelle', estado: 'pendiente' })
    db.seed('solicitudes_pago', { usuario_id: 'u', tipo: 'plan', plan: 'carta', monto_usd: 1, metodo: 'zelle', estado: 'confirmado' })
    assert.deepEqual(await contarTareas(), { n: 2, nuevas: 2 }); assert.equal(await contarPagosPorConfirmar(), 1)
  })
})

describe('rutas del punto rojo', () => {
  test('cada una pide su permiso: atender para la Bandeja y pagos para los pagos', async () => {
    flag(false)
    db.seed('equipo', { correo: 'ana@compaz.test', nombre: 'ana', permisos: { atender: true }, activo: true, creado_por: 'admin@compaz.test' })
    como('ana@compaz.test')
    const b = await pendientesBandeja(get()); assert.equal(b.status, 200); assert.equal((await b.json()).data.n, 1)
    assert.equal((await pendientesPagos()).status, 403, 'sin el permiso de pagos no se cuenta')
    como(null); assert.equal((await pendientesBandeja(get())).status, 401)
  })
})

describe('lo nuevo sin ver', () => {
  test('cuenta como nuevas solo las tareas abiertas creadas después de la última vez que se vio la Bandeja', async () => {
    const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
    flag(false, hace(60)); flag(false, hace(5)); flag(false, hace(1)); flag(true, hace(1))
    assert.deepEqual(await contarTareas(hace(10)), { n: 3, nuevas: 2 })
    assert.deepEqual(await contarTareas(new Date().toISOString()), { n: 3, nuevas: 0 }, 'recién visto: el punto se quita, aunque sigan abiertas')
    assert.deepEqual(await contarTareas(null), { n: 3, nuevas: 3 })
  })
  test('la ruta acepta `desde`, ignora una fecha inválida y devuelve la hora del servidor', async () => {
    flag(false, '2026-01-01T00:00:00Z')
    db.seed('equipo', { correo: 'ana@compaz.test', nombre: 'ana', permisos: { atender: true }, activo: true, creado_por: 'admin@compaz.test' }); como('ana@compaz.test')
    const a = (await (await pendientesBandeja(get('?desde=2026-06-01T00:00:00Z'))).json()).data; assert.equal(a.nuevas, 0); assert.equal(a.n, 1); assert.ok(a.ahora)
    assert.equal((await (await pendientesBandeja(get('?desde=basura'))).json()).data.nuevas, 1)
  })
  test('la pantalla quita el punto de la Bandeja al verla con la pestaña a la vista, y el de Pagos no se quita al verlo', () => {
    const s = readFileSync('components/panel/pendientes-store.ts', 'utf8')
    assert.match(s, /activa\.bandeja && visible\(\)/); assert.match(s, /valor\.bandeja = 0/); assert.match(s, /localStorage/)
    assert.doesNotMatch(s.split("usos.pagos > 0")[1].split('await Promise.all')[0], /guardarVisto/)
    assert.match(readFileSync('lib/panel-bandeja-tipos.ts', 'utf8'), /se quita al abrir la Bandeja/)
  })
})

describe('el menú', () => {
  test('el menú dibuja el punto solo a quien tiene el permiso, y avisa cuando algo cambia', () => {
    const m = readFileSync('components/panel/MarcoPanel.tsx', 'utf8')
    assert.match(m, /actor\.permisos\.atender === true \? <InsigniaPendiente tipo="bandeja"/); assert.match(m, /actor\.permisos\.pagos === true \? <InsigniaPendiente tipo="pagos"/)
    assert.match(readFileSync('components/panel/Bandeja.tsx', 'utf8'), /avisarCambio\(\)/); assert.match(readFileSync('components/panel/mas/PagosPorConfirmar.tsx', 'utf8'), /avisarCambio\(\)/)
    const s = readFileSync('components/panel/pendientes-store.ts', 'utf8'); assert.match(s, /20_000/); assert.match(s, /60_000/); assert.match(s, /document\.title/)
  })
})
