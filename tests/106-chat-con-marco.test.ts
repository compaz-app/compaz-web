/* eslint-disable */
// El chat del portal tiene marco propio para distinguirse de las demás tarjetas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('el chat de la pestaña Visitas va dentro de su propio marco (MarcoChat) con borde y altura fija', () => {
  assert.match(readFileSync('components/portal/SeccionVisitas.tsx', 'utf8'), /case 'chat': return <MarcoChat nombre=\{nombre\}><Chat /)
  const m = readFileSync('components/portal/MarcoChat.tsx', 'utf8')
  assert.match(m, /<section[^>]*border-2 border-morado-medio[^>]*bg-fondo-claro/); assert.match(m, /h-\[min\(34rem,75dvh\)\]/)
})
