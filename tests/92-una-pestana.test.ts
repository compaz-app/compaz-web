/* eslint-disable */
// Una sola pestaña del portal: quien llega desde el correo no duplica el portal.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { debeResponder, ESPERA_RESPUESTA_MS, CANAL_PESTANA } from '@/lib/una-pestana'

describe('quién responde «ya estoy abierta»', () => {
  test('la pestaña que ya estaba vigente siempre responde', () => assert.equal(debeResponder({ id: 'b', vigente: true, esperando: false }, { id: 'a' }), true))
  test('una pestaña ya duplicada o en pausa no responde', () => assert.equal(debeResponder({ id: 'b', vigente: false, esperando: false }, { id: 'a' }), false))
  test('si dos pestañas se abren a la vez, gana el id menor y solo una queda vigente', () => {
    const a = { id: 'aaa', vigente: false, esperando: true }, b = { id: 'bbb', vigente: false, esperando: true }
    assert.equal(debeResponder(a, b), true, 'a (menor) responde a b'); assert.equal(debeResponder(b, a), false, 'b (mayor) no responde a a')
  })
})

describe('el portal usa la regla', () => {
  test('está en el portal y en el dashboard viejo, solo para clientes (no para el administrador ni la vista previa)', () => {
    const p = readFileSync('app/portal/page.tsx', 'utf8'), d = readFileSync('app/dashboard/page.tsx', 'utf8')
    assert.match(p, /\{!esAdmin && <UnaSolaPestana \/>\}/); assert.match(d, /\{!isAdmin && !previewUid && <UnaSolaPestana \/>\}/)
  })
  test('la pestaña vieja se actualiza y la nueva avisa, intenta cerrarse y ofrece usar esta', () => {
    const c = readFileSync('components/ui/UnaSolaPestana.tsx', 'utf8')
    assert.match(c, /router\.refresh\(\)/); assert.match(c, /window\.close\(\)/); assert.match(c, /Usar esta pestaña/); assert.match(c, /Ya tienes Compaz abierto en otra pestaña/)
    assert.match(c, /typeof BroadcastChannel === 'undefined'/); assert.ok(ESPERA_RESPUESTA_MS > 0 && CANAL_PESTANA)
  })
})
