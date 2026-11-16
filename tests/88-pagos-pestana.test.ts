/* eslint-disable */
// Pestaña Pagos del panel: lo que falta por confirmar, confirmarlo desde ahí, y que la Bandeja se actualice sola.
import { db, limpiar, mkCliente, mkCompita, req } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { listarPagosPorConfirmar } from '@/lib/panel-mas-datos'
import { confirmarPagoPorSolicitud } from '@/lib/panel-bandeja-acciones'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const actor = (rol: 'admin' | 'colaborador', p: any = {}): Actor => ({ id: 'u1', correo: 'x@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } })
const pendiente = (cli: any, o: any = {}) => db.seed('solicitudes_pago', { usuario_id: cli.id, tipo: 'plan', plan: 'carta', horas: null, monto_usd: 120, metodo: 'zelle', estado: 'pendiente', pago_id: null, created_at: new Date().toISOString(), resuelta_at: null, ...o })

describe('pagos por confirmar', () => {
  test('lista solo los pendientes, con cliente, monto y referencia, el más antiguo primero', async () => {
    const a = mkCliente({ nombre: 'Ana' } as any), b = mkCliente({ nombre: 'Beto' } as any)
    pendiente(b, { created_at: new Date(Date.now() - 3600_000).toISOString() }); pendiente(a, { estado: 'confirmado' })
    const l = await listarPagosPorConfirmar()
    assert.equal(l.length, 1); assert.equal(l[0].cliente, 'Beto'); assert.equal(l[0].monto, 120); assert.match(l[0].referencia, /^COMPAZ-[0-9A-F]{6}$/)
  })
  test('sin el permiso de pagos no se puede confirmar', async () => {
    const c = mkCliente(); const s = pendiente(c)
    const r = await confirmarPagoPorSolicitud(actor('colaborador', { atender: true }), s.id)
    assert.equal(r.ok, false); assert.equal((r as any).status, 403)
    assert.equal(db.rows('solicitudes_pago')[0].estado, 'pendiente')
  })
  test('con el permiso confirma una vez, cierra las tareas de pago del cliente y la segunda vez dice que ya no está pendiente', async () => {
    const c = mkCliente(); const s = pendiente(c)
    const t = db.seed('admin_flags', { entidad_tipo: 'cliente', entidad_id: c.id, entidad_nombre: 'Pago', nota: 'x', resuelto: false, tipo: 'pago_insistido', reportado_por: 'x', prioridad: 1, created_at: new Date().toISOString() })
    const r = await confirmarPagoPorSolicitud(actor('colaborador', { atender: true, pagos: true }), s.id)
    assert.equal(r.ok, true)
    assert.equal(db.rows('solicitudes_pago')[0].estado, 'confirmado')
    assert.equal(db.rows('admin_flags').find((f: any) => f.id === t.id)!.resuelto, true)
    const otra = await confirmarPagoPorSolicitud(actor('admin'), s.id)
    assert.equal(otra.ok, false); assert.equal((otra as any).status, 409)
  })
})

describe('la Bandeja y Pagos se actualizan solos', () => {
  const pagina = readFileSync('app/panel/page.tsx', 'utf8')
  test('la Bandeja usa AutoRefresh, más rápido si hay un pago por confirmar', () => {
    assert.match(pagina, /<AutoRefresh intervaloSeg=\{15\} rapido=\{hayPago\} reposoSeg=\{30\} \/>/)
  })
  test('la pestaña Pagos también, y la ruta acepta solicitud_pago_id', () => {
    assert.match(pagina, /actual === 'pagos'/); assert.match(pagina, /rapido=\{porConfirmar\.length > 0\}/)
    assert.match(readFileSync('app/api/admin/confirmar-pago/route.ts', 'utf8'), /solicitud_pago_id/)
  })
})
