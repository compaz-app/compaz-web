/* eslint-disable */
// El panel pone el título de cada herramienta de Más; ninguna pantalla de Más repite el suyo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

test('ninguna pantalla de components/panel/mas dibuja su propio <Encabezado> (el panel ya lo pone, salvo el Hub)', () => {
  const con = readdirSync('components/panel/mas').filter((f) => f.endsWith('.tsx') && f !== 'Hub.tsx').filter((f) => /<Encabezado\b/.test(readFileSync(`components/panel/mas/${f}`, 'utf8')))
  assert.deepEqual(con, [])
})
test('el panel sí pone el título de la herramienta', () => assert.match(readFileSync('app/panel/page.tsx', 'utf8'), /<Encabezado titulo=\{subMas\.texto\} \/>/))
