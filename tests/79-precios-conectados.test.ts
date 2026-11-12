/* eslint-disable */
import { db, session, limpiar, req, mkCliente } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setAjustes, limpiarCacheAjustes } from '@/lib/ajustes'
import { preciosVigentes } from '@/lib/precios'
import { crearSolicitudPago } from '@/lib/solicitudes-pago'
import { POST as registrarPago } from '@/app/api/admin/registrar-pago/route'
import { GET as precios } from '@/app/api/precios/route'

beforeEach(() => { limpiar(); db.rows('ajustes').length = 0; limpiarCacheAjustes() })
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
const cambiar = (cambios: Record<string, number>) => setAjustes({ cambios, actor: 'admin@compaz.test' })

describe('los precios de Ajustes rigen de verdad', () => {
  test('sin cambios rigen los de fábrica', async () => {
    assert.deepEqual(await preciosVigentes(), { hora: 22, mandado: 22, planes: { carta: 22, quincenal: 75, semanal: 140 } })
  })

  test('al cambiar la hora cambia el plan A la carta, la visita extra y lo que muestra /api/precios', async () => {
    assert.equal((await cambiar({ precio_hora: 25 })).ok, true)
    const p = await preciosVigentes()
    assert.equal(p.hora, 25); assert.equal(p.planes.carta, 25)
    const j = await (await precios()).json()
    assert.equal(j.data.hora, 25)
  })

  test('el registro de un pago cobra el precio nuevo y rechaza el viejo', async () => {
    assert.equal((await cambiar({ precio_plan_quincenal: 80 })).ok, true)
    const cli = mkCliente({ email: 'a@mail.test', nombre: 'Ana' })
    admin()
    const viejo = await registrarPago(req('/api/admin/registrar-pago', { json: { usuario_id: cli.id, tipo: 'plan', plan: 'quincenal', metodo: 'zelle', monto_usd: 75 } }))
    assert.equal(viejo.status, 400)
    const nuevo = await registrarPago(req('/api/admin/registrar-pago', { json: { usuario_id: cli.id, tipo: 'plan', plan: 'quincenal', metodo: 'zelle', monto_usd: 80 } }))
    assert.equal(nuevo.status, 200)
    assert.equal(db.rows('pagos_plan')[0].monto_usd, 80)
  })

  test('la solicitud de pago del cliente sale con el precio vigente (plan y horas extra)', async () => {
    assert.equal((await cambiar({ precio_hora: 30, precio_plan_semanal: 200 })).ok, true)
    const cli = mkCliente({ email: 'b@mail.test', nombre: 'Beto' })
    const plan = await crearSolicitudPago({ usuarioId: cli.id, tipo: 'plan', plan: 'semanal', metodo: 'zelle' })
    assert.ok(plan.ok && plan.solicitud.monto_usd === 200)
    const extra = await crearSolicitudPago({ usuarioId: cli.id, tipo: 'extra', horas: 3, metodo: 'zelle' })
    assert.ok(extra.ok && extra.solicitud.monto_usd === 90)
  })

  test('el navegador no decide el importe: la ruta de solicitud no lee ningún monto del cuerpo', () => {
    const src = readFileSync('app/api/pago/solicitar/route.ts', 'utf8')
    assert.ok(!/monto/i.test(src.replace(/monto_usd|montoUsd/g, '')) || !/body\.monto|b\.monto/.test(src))
  })

  test('un plan más caro que las horas sueltas sigue pidiendo confirmación', async () => {
    const r = await cambiar({ precio_hora: 10 })
    assert.equal(r.ok, false)
    assert.equal((r as any).codigo, 'incoherente')
  })

  test('ya no hay precios fijos de lib/planes en los cobros ni en las pantallas (solo los de fábrica)', () => {
    for (const f of ['lib/pagos.ts', 'lib/solicitudes-pago.ts', 'components/ui/PlanesPago.tsx', 'components/ui/AgendarOtraVisita.tsx', 'app/pago/page.tsx']) {
      const s = readFileSync(f, 'utf8')
      assert.ok(!/PRECIO_HORA_EXTRA_USD|\.precioUsd/.test(s), `${f} aún usa un precio fijo`)
    }
    assert.ok(!/\$22|\$75|\$140/.test(readFileSync('app/api/chat/route.ts', 'utf8')), 'el asistente aún tiene precios escritos a mano')
  })
})
