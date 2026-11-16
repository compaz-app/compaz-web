/* eslint-disable */
// La ficha del cliente tiene su botón para ver el portal como él, solo para administradores.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('«Ver perfil del cliente» sale solo en la ficha de un cliente y no a colaboradores (pideMotivo)', () => {
  const f = readFileSync('components/panel/FichaPersona.tsx', 'utf8')
  assert.match(f, /ficha\.tipo === 'cliente' && !pideMotivo[\s\S]{0,400}\/portal\?preview=\$\{ficha\.id\}/)
  assert.match(f, /Ver perfil del cliente/)
})
