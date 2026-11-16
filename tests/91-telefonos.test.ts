/* eslint-disable */
// Teléfonos con país: validación por país, formato internacional sin espacios y rechazo de errores de tipeo.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validarTelefono, validarNacional, paisPorId, formatearTelefono, PAISES_TEL } from '@/lib/telefono'
import { validarDireccion } from '@/lib/direccion'

const e164 = (v: string) => { const r = validarTelefono(v); return r.ok ? r.e164 : null }

describe('Venezuela', () => {
  test('acepta las formas habituales y siempre guarda +58 y 10 dígitos', () => {
    for (const v of ['+58 414 555 0101', '+584145550101', '0414 555 0101', '0414-5550101', '(0414) 555.0101', '414 555 0101', '+58 0414 555 0101', '00 58 414 555 0101']) assert.equal(e164(v), '+584145550101', v)
    assert.equal(e164('0212 555 0101'), '+582125550101', 'fijo de Caracas')
  })
  test('rechaza lo que no existe: operadora inventada, dígitos de más o de menos, letras', () => {
    for (const v of ['0415 555 0101', '+58 414 555 010', '+58 414 555 01011', '0414 555 010', '+58 314 555 0101', '414 555 01a1', '+58 1234567890']) assert.equal(e164(v), null, v)
  })
  test('un número local sin prefijo solo se acepta si es venezolano; otro país exige el +', () => {
    assert.equal(e164('305 555 0123'), null); assert.match((validarTelefono('305 555 0123') as any).error, /código de país/)
    assert.equal(e164('+1 305 555 0123'), '+13055550123')
  })
})

describe('otros países', () => {
  test('EE. UU.: 10 dígitos y el prefijo 1; el código de zona no empieza en 0 ni en 1', () => {
    assert.equal(e164('+1 (305) 555-0123'), '+13055550123'); assert.equal(e164('+1 105 555 0123'), null); assert.equal(e164('+1 305 555 012'), null)
  })
  test('Colombia, España, Panamá y Brasil', () => {
    assert.equal(e164('+57 310 123 4567'), '+573101234567'); assert.equal(e164('+57 110 123 4567'), null)
    assert.equal(e164('+34 612 345 678'), '+34612345678'); assert.equal(e164('+34 112 345 678'), null)
    assert.equal(e164('+507 6123 4567'), '+50761234567'); assert.equal(e164('+55 11 91234 5678'), '+5511912345678')
  })
  test('prefijos largos no se confunden con cortos (+507 Panamá, +593 Ecuador)', () => {
    assert.equal((validarTelefono('+507 6123 4567') as any).pais.id, 'pa'); assert.equal((validarTelefono('+593 99 123 4567') as any).pais.id, 'ec')
    assert.equal(e164('+593 099 123 4567'), '+593991234567', 'quita el 0 de marcación local')
  })
  test('un país que no está en la lista vale si tiene entre 8 y 15 dígitos con su +', () => {
    assert.equal(e164('+49 151 2345 6789'), '+4915123456789'); assert.equal(e164('+49 12'), null); assert.equal(e164('+' + '9'.repeat(16)), null)
  })
})

describe('país elegido en la pantalla', () => {
  test('acepta el número con o sin el prefijo pegado y con el 0 local', () => {
    const ve = paisPorId('ve')!
    for (const v of ['4145550101', '04145550101', '58 414 555 0101', '+58 414 555 0101']) { const r = validarNacional(ve, v); assert.equal(r.ok && r.e164, '+584145550101', v) }
    const m = validarNacional(ve, '4145550'); assert.equal(m.ok, false); assert.match((m as any).error, /Venezuela/); assert.match((m as any).error, /414 555 0101/)
  })
  test('cada país trae un ejemplo que él mismo acepta', () => {
    for (const p of PAISES_TEL) { const r = validarNacional(p, p.ejemplo); assert.equal(r.ok, true, `${p.nombre}: ${p.ejemplo}`) }
  })
  test('se muestra con espacios', () => { assert.equal(formatearTelefono('+584145550101'), '+58 414 555 0101'); assert.equal(formatearTelefono('+13055550123'), '+1 305 555 0123'); assert.equal(formatearTelefono(null), '') })
})

describe('la dirección del cliente', () => {
  const buena = (tel: string) => ({ direccion: 'Av. Francisco de Miranda, Edif. Sol, piso 3, Chacao', contacto_nombre: 'Rosa Linares', contacto_tel: tel })
  test('guarda el teléfono normalizado y rechaza uno que no existe con un mensaje que dice qué hacer', () => {
    const ok = validarDireccion(buena('0414 555 0101')); assert.equal(ok.ok && ok.datos.contacto_tel, '+584145550101')
    const mal = validarDireccion(buena('0414 555 01')); assert.equal(mal.ok, false); assert.match((mal as any).error, /Venezuela/)
    assert.equal(validarDireccion(buena('')).ok, false)
  })
  test('la pantalla usa el campo con país', () => {
    assert.match(readFileSync('components/ui/DireccionVisita.tsx', 'utf8'), /<CampoTelefono/)
    const c = readFileSync('components/ui/CampoTelefono.tsx', 'utf8'); assert.match(c, /País del teléfono/); assert.match(c, /Se guardará como/)
  })
})
