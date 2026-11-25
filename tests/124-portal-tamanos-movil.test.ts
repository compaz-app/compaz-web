/* eslint-disable */
// Tamaños del portal en el teléfono: fluidos (escalan con el ancho) y compactos en pantallas bajas. Medidos en 375×667, 360×640, 390×844 y 430×932 (ver docs/versiones.md 1.3.19).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leer = (f: string) => readFileSync(f, 'utf8')
describe('tamaños fluidos y compactos', () => {
  test('la tarjeta de siguiente paso: título y texto escalan con el ancho y en pantallas bajas lleva menos relleno, avatar y espacio', () => {
    const t = leer('components/portal/TarjetaEstado.tsx')
    assert.match(t, /text-\[length:clamp\(1\.25rem,5\.6vw,1\.5rem\)\]/); assert.match(t, /text-\[length:clamp\(1rem,4\.6vw,1\.125rem\)\]/)
    assert.match(t, /\[@media\(max-height:759px\)\]:h-10/); assert.match(t, /\[@media\(max-height:759px\)\]:mt-4/)
    assert.match(leer('components/ui/base/Tarjeta.tsx'), /\[@media\(max-height:759px\)\]:p-4/)
  })
  test('el botón grande mide 48 px en pantallas bajas (56 en las altas) y su texto escala; el compacto del panel no cambia', () => {
    const b = leer('components/ui/base/Boton.tsx')
    assert.match(b, /min-h-14[^`]*\[@media\(max-height:759px\)\]:min-h-12/); assert.match(b, /text-\[length:clamp\(1rem,4\.6vw,1\.125rem\)\]/)
    assert.match(b, /compacto: `inline-flex min-h-10 [^`]*text-sm font-bold/)
  })
  test('el chat del portal gasta menos marco en el teléfono y esconde la cabecera con el teclado; la pantalla vieja y el escritorio no cambian', () => {
    const m = leer('components/portal/MarcoChat.tsx')
    assert.match(m, /max-lg:\[&_\[data-chat-cabecera\]\]:!py-2\.5/); assert.match(m, /max-lg:\[&_\[data-chat-form\]\]:!p-2\.5/); assert.match(m, /\[\[data-teclado=abierto\]_&_\[data-chat-cabecera\]\]:!hidden/)
    const c = leer('components/ui/Chat.tsx')
    for (const a of ['data-chat-cabecera', 'data-chat-mensajes', 'data-chat-form', 'data-chat-campo']) assert.match(c, new RegExp(a))
    assert.match(c, /padding: '16px 20px', borderBottom/, 'los estilos de la pantalla vieja siguen igual')
  })
  test('el menú de abajo mide 56 px y la página deja lugar justo para él', () => {
    assert.match(leer('components/portal/NavPortal.tsx'), /flex min-h-14 flex-col items-center justify-center text-xs/)
    assert.match(leer('app/portal/page.tsx'), /pb-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\]/)
  })
})
