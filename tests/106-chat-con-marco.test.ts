/* eslint-disable */
// El chat del portal tiene marco propio para distinguirse de las demás tarjetas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('el chat de la pestaña Visitas va dentro de su propio marco con borde y altura fija', () => {
  const f = readFileSync('components/portal/SeccionVisitas.tsx', 'utf8')
  assert.match(f, /case 'chat': return <section[^>]*border-2 border-morado-medio[^>]*bg-fondo-claro[^>]*><Chat /)
  assert.match(f, /h-\[min\(34rem,75dvh\)\]/)
})
