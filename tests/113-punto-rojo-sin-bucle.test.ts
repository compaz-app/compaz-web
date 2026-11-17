/* eslint-disable */
// El punto rojo del panel no puede hacer lluvia de consultas: el 17-nov-2026 dos navegadores con el panel abierto hicieron ~35.000 consultas en una hora porque
// la suscripción cambiaba en cada dibujo (se desuscribía y suscribía sin parar, y cada suscripción consultaba al servidor).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { usar, MIN_ENTRE_CONSULTAS_MS } from '@/components/panel/pendientes-store'

describe('el store del punto rojo', () => {
  test('suscribirse y desuscribirse 50 veces seguidas (lo que hacía el bucle) hace UNA sola consulta por tipo', async () => {
    let llamadas = 0
    const g = globalThis as any
    const viejo = { document: g.document, window: g.window, fetch: g.fetch }
    g.document = { visibilityState: 'visible', title: 'Panel', addEventListener() {}, removeEventListener() {} }
    g.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }
    g.fetch = async () => { llamadas++; return { ok: true, json: async () => ({ ok: true, data: { nuevas: 2, n: 3, ahora: new Date().toISOString() } }) } }
    try {
      for (let i = 0; i < 50; i++) { const baja = usar('bandeja', () => {}, { esActiva: false, correo: 'a@b.test' }); baja() }
      await new Promise((r) => setTimeout(r, 30))
      assert.equal(llamadas, 1)
      // Dentro del plazo de seguridad, volver a suscribirse tampoco consulta de inmediato.
      const bajas = Array.from({ length: 20 }, () => usar('bandeja', () => {}, { esActiva: false, correo: 'a@b.test' }))
      await new Promise((r) => setTimeout(r, 30))
      assert.equal(llamadas, 1, `no debe consultar dentro de ${MIN_ENTRE_CONSULTAS_MS} ms`)
      bajas.forEach((b) => b())
    } finally { g.document = viejo.document; g.window = viejo.window; g.fetch = viejo.fetch }
  })
})

describe('el punto rojo en pantalla', () => {
  test('la función de suscripción es estable (useCallback), no una flecha nueva en cada dibujo', () => {
    const f = readFileSync('components/panel/InsigniaPendiente.tsx', 'utf8')
    assert.match(f, /useCallback\(\(f: \(\) => void\) => usar\(/); assert.match(f, /useSyncExternalStore\(suscribir,/)
    assert.doesNotMatch(f, /useSyncExternalStore\(\(f\) =>/)
  })
  test('el plazo mínimo entre consultas es de al menos 5 segundos', () => assert.ok(MIN_ENTRE_CONSULTAS_MS >= 5000))
})
