/* eslint-disable */
// La versión del sistema tiene una sola fuente (lib/version.ts) y todo lo demás debe coincidir con ella.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VERSION } from '@/lib/version'

describe('versión del sistema', () => {
  test('tiene formato mayor.menor.parche[-etapa]', () => { assert.match(VERSION, /^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/) })
  test('package.json coincide con lib/version.ts', () => { assert.equal(JSON.parse(readFileSync('package.json', 'utf8')).version, VERSION) })
  test('la entrada más nueva de docs/versiones.md es la versión vigente', () => {
    const primera = readFileSync('docs/versiones.md', 'utf8').match(/^## (\S+)/m)?.[1]
    assert.equal(primera, VERSION, 'Sube la versión en lib/version.ts y anótala arriba en docs/versiones.md')
  })
  test('el panel muestra la versión', () => {
    assert.match(readFileSync('components/panel/MarcoPanel.tsx', 'utf8'), /VERSION/)
  })
})
