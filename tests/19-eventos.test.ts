// Registro de eventos de operación (lib/eventos.ts): llama a la función SQL con los parámetros correctos
// y nunca rompe el flujo que lo origina.
import './harness'
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import { registrarEvento } from '@/lib/eventos'

function clienteFalso(respuesta: { error: { message: string } | null } | 'lanza' = { error: null }) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = []
  return {
    llamadas,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      llamadas.push({ fn, args })
      if (respuesta === 'lanza') throw new Error('red caída')
      return { data: 1, error: respuesta.error }
    },
  }
}

describe('registrarEvento', () => {
  test('llama a registrar_evento con los parámetros y el actor por defecto', async () => {
    const c = clienteFalso()
    const id = randomUUID()
    const ok = await registrarEvento({ entidad: 'solicitud', entidadId: id, tipo: 'solicitud_creada', datos: { paso: 5 } }, c)
    assert.equal(ok, true)
    assert.equal(c.llamadas.length, 1)
    assert.equal(c.llamadas[0].fn, 'registrar_evento')
    assert.deepEqual(c.llamadas[0].args, { p_entidad: 'solicitud', p_entidad_id: id, p_tipo: 'solicitud_creada', p_actor: 'sistema', p_datos: { paso: 5 } })
  })

  test('respeta el actor indicado y usa datos vacíos si no hay', async () => {
    const c = clienteFalso()
    await registrarEvento({ entidad: 'pago', entidadId: randomUUID(), tipo: 'pago_confirmado', actor: 'admin:ana@compaz.test' }, c)
    assert.equal(c.llamadas[0].args.p_actor, 'admin:ana@compaz.test')
    assert.deepEqual(c.llamadas[0].args.p_datos, {})
  })

  test('si la base devuelve error, no lanza y devuelve false', async () => {
    const c = clienteFalso({ error: { message: 'tipo de evento no válido' } })
    assert.equal(await registrarEvento({ entidad: 'visita', entidadId: randomUUID(), tipo: 'visita_iniciada' }, c), false)
  })

  test('si la llamada lanza una excepción, no la propaga', async () => {
    const c = clienteFalso('lanza')
    assert.equal(await registrarEvento({ entidad: 'visita', entidadId: randomUUID(), tipo: 'visita_iniciada' }, c), false)
  })

  test('un id que no es uuid se rechaza sin llamar a la base', async () => {
    const c = clienteFalso()
    assert.equal(await registrarEvento({ entidad: 'compita', entidadId: 'sin-visita', tipo: 'emergencia' }, c), false)
    assert.equal(c.llamadas.length, 0)
  })
})
