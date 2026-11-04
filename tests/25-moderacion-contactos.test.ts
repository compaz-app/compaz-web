/* eslint-disable */
// Filtro de contactos (lib/chat-moderacion.ts): censura el teléfono o el correo COMPLETOS, también los de
// otros países (los clientes viven en el exterior), y no toca los textos normales.
// Límite conocido: números escritos con palabras ("cero cuatro uno cuatro...") no se detectan.
import './harness'
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { detectarContacto } from '@/lib/chat-moderacion'

const sinDigitos = (s: string) => s.replace(/\D/g, '')

describe('se censura el contacto completo', () => {
  const telefonos: [string, string][] = [
    ['venezolano con espacios', 'llámame al 0414 1234567'],
    ['venezolano con guiones', 'mi número es 0414-123-4567'],
    ['venezolano pegado', 'llámame al 04141234567'],
    ['+58', 'escríbeme al +58 414 1234567'],
    ['EE.UU. con +1', 'llámame al +1 305 555 1234'],
    ['EE.UU. con paréntesis', 'mi teléfono es (305) 555-1234'],
    ['EE.UU. con espacios', 'mi número es 305 555 1234'],
    ['EE.UU. pegado', 'mi celular es 3055551234'],
    ['España', 'mi móvil es +34 612 345 678'],
    ['Colombia', 'escríbeme al +57 300 1234567'],
  ]
  for (const [nombre, texto] of telefonos) {
    test(`teléfono ${nombre}`, () => {
      const r = detectarContacto(texto)
      assert.equal(r.detectado, true)
      assert.match(r.textoCensurado, /\[teléfono eliminado\]/)
      assert.equal(sinDigitos(r.textoCensurado), '', 'no queda ningún dígito del número')
    })
  }

  test('correo normal', () => {
    const r = detectarContacto('mi correo es carolina@mail.com')
    assert.equal(r.detectado, true)
    assert.ok(!r.textoCensurado.includes('carolina'))
  })

  test('correo escrito con palabras', () => {
    const r = detectarContacto('escríbeme a carolina arroba gmail punto com')
    assert.equal(r.detectado, true)
    assert.ok(!/carolina|gmail/.test(r.textoCensurado))
  })

  test('el resto del texto se conserva', () => {
    const r = detectarContacto('Mi mamá vive sola. Llámame al +1 305 555 1234 por favor.')
    assert.match(r.textoCensurado, /^Mi mamá vive sola\. Llámame al \[teléfono eliminado\] por favor\.$/)
  })
})

describe('los textos normales no se tocan', () => {
  const normales = [
    'Mi mamá tiene 82 años y vive en el piso 14',
    'Vivo en Miami desde 2015',
    'La visita es el 12 de mayo de 2026 a las 3:00 pm',
    'Pagué $60 por el plan quincenal de 2 visitas',
    'Le gusta ver sus novelas y regar el jardín todas las mañanas',
    'Toma 3 pastillas al día, a las 8, 14 y 20 horas',
    'Su cédula termina en 5678',
  ]
  for (const t of normales) {
    test(t, () => {
      const r = detectarContacto(t)
      assert.equal(r.detectado, false)
      assert.equal(r.textoCensurado, t)
    })
  }
})
