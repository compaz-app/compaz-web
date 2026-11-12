import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fuente = readFileSync('app/portal/page.tsx', 'utf8')

describe('el portal se actualiza en tiempo real', () => {
  test('el cliente real recibe los cambios y las llamadas (VisitaWatcher)', () => {
    assert.match(fuente, /!esAdmin && <VisitaWatcher/)
  })
  test('la vista previa del equipo nunca suena ni recibe llamadas del cliente', () => {
    assert.ok(!/<VisitaWatcher/.test(fuente.replace(/\{!esAdmin && <VisitaWatcher[^\n]*\n/, '')))
  })
  test('sigue el respaldo por intervalo por si falla el tiempo real', () => {
    assert.match(fuente, /!esAdmin && <AutoRefresh/)
  })
})
