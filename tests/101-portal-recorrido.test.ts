/* eslint-disable */
// Fase 2 del portal unificado: recorrido de 5 pasos de la visita y chat siempre abierto.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recorridoDeVisita, bloquesDeVisitas } from '@/lib/portal-secciones'

const estados = (r: any) => r.map((p: any) => p.estado[0]).join('')
const base = { tieneDireccion: false, tieneFecha: false }

describe('recorrido de la visita', () => {
  test('sin visita no hay recorrido', () => assert.equal(recorridoDeVisita({ visita: null, ...base }), null))
  test('sin dirección: el primer paso es el de ahora', () => assert.equal(estados(recorridoDeVisita({ visita: 'pre_visita', ...base })), 'adddd'))
  test('con dirección y sin fecha: toca el día y la hora', () => assert.equal(estados(recorridoDeVisita({ visita: 'pre_visita', tieneDireccion: true, tieneFecha: false })), 'haddd'))
  test('con fecha pedida: toca esperar la confirmación', () => assert.equal(estados(recorridoDeVisita({ visita: 'pre_visita', tieneDireccion: true, tieneFecha: true })), 'hhadd'))
  test('programada: toca la visita; en curso igual', () => {
    for (const v of ['programada', 'confirmando_inicio', 'en_curso'] as const) assert.equal(estados(recorridoDeVisita({ visita: v, ...base })), 'hhhad', v)
  })
  test('siempre son 5 pasos, con título', () => { const r = recorridoDeVisita({ visita: 'programada', ...base })!; assert.equal(r.length, 5); assert.ok(r.every((p) => p.titulo.length > 3)) })
})

describe('chat siempre abierto', () => {
  test('la visita programada muestra el chat, no uno plegable', () => assert.ok(bloquesDeVisitas({ visita: 'programada', puedeAgendarOtra: false, visitasTerminadas: 0, reportes: 0, vistaPrevia: false }).includes('chat')))
  test('la pestaña dibuja el recorrido y ya no usa el chat plegable', () => {
    const f = readFileSync('components/portal/SeccionVisitas.tsx', 'utf8')
    assert.match(f, /<RecorridoVisita/); assert.doesNotMatch(f, /ChatColapsable/)
  })
})
