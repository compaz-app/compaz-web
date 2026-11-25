/* eslint-disable */
// El portal en el teléfono: el chat no queda a la mitad al escribir y el menú de abajo queda al fondo (y se esconde mientras está el teclado).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tecladoAbierto, UMBRAL_TECLADO_PX } from '@/lib/teclado-movil'

describe('detectar el teclado', () => {
  test('abierto solo cuando la zona visible se achica más del umbral; mover la barra del navegador no cuenta', () => {
    assert.equal(tecladoAbierto(800, 800), false)
    assert.equal(tecladoAbierto(800, 800 - UMBRAL_TECLADO_PX), false, 'justo en el umbral no')
    assert.equal(tecladoAbierto(800, 740), false, 'barra del navegador (60 px)')
    assert.equal(tecladoAbierto(800, 480), true, 'teclado (320 px)')
  })
})

describe('el portal en el teléfono', () => {
  const nav = readFileSync('components/portal/NavPortal.tsx', 'utf8')
  const chat = readFileSync('components/portal/MarcoChat.tsx', 'utf8')
  const ajuste = readFileSync('components/portal/AjusteMovil.tsx', 'utf8')
  const page = readFileSync('app/portal/page.tsx', 'utf8')
  test('el menú de abajo respeta la barra de inicio del teléfono y se esconde con el teclado abierto', () => {
    assert.match(nav, /fixed inset-x-0 bottom-0[^"]*pb-\[env\(safe-area-inset-bottom\)\][^"]*\[\[data-teclado=abierto\]_&\]:hidden/)
    assert.match(page, /pb-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\]/, 'la página deja lugar al menú más la barra de inicio')
  })
  test('el chat se pega arriba de la zona visible al enfocarse y, con teclado, ocupa justo lo visible', () => {
    assert.match(chat, /onFocusCapture=\{alEnfocar\}/); assert.match(chat, /scrollIntoView\(\{ block: 'start'/); assert.match(chat, /\[\[data-teclado=abierto\]_&\]:h-\[calc\(var\(--alto-visible\)-1rem\)\]/)
  })
  test('AjusteMovil mantiene --alto-visible y data-teclado, y se limpia al salir; el portal lo monta', () => {
    assert.match(ajuste, /visualViewport/); assert.match(ajuste, /--alto-visible/); assert.match(ajuste, /dataset\.teclado = 'abierto'/); assert.match(ajuste, /removeEventListener\('resize'/)
    assert.match(page, /<AjusteMovil \/>/)
  })
  test('solo el portal usa toda la pantalla (viewport-fit cover) y deja que el teclado achique la página', () => {
    const l = readFileSync('app/portal/layout.tsx', 'utf8'); assert.match(l, /viewportFit: 'cover'/); assert.match(l, /interactiveWidget: 'resizes-content'/)
    assert.doesNotMatch(readFileSync('app/layout.tsx', 'utf8'), /viewportFit/, 'la landing y el resto no cambian')
  })
})
