/* eslint-disable */
// Seguimiento de bienestar: el resumen, la tendencia, las frases y lo que se dibuja según cuántas visitas haya.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ordenarYRecortar, serie, promedioReporte, nivelGeneral, formatoPromedio, tendencia, direccion, fraseDeCambio, fechaCorta, novedades, VENTANA_VISITAS, MIN_VISITAS_TENDENCIA,
} from '@/lib/bienestar'
import SeguimientoBienestar from '@/components/ui/SeguimientoBienestar'
import GraficoEvolucion from '@/components/ui/GraficoEvolucion'

const rep = (i: number, o: Record<string, any> = {}) => ({ id: `r${i}`, visita_id: `v${i}`, animo: 4, fisico: 4, participacion: 4, entorno: 4, novedad: null, resumen_ia: null, created_at: new Date(Date.UTC(2026, 9, 1 + i * 7, 15)).toISOString(), ...o }) as any

describe('los números', () => {
  test('el promedio ignora las notas que no aplican y es null si ninguna aplica', () => {
    assert.equal(promedioReporte({ animo: 5, fisico: 4, participacion: 5, entorno: 5 } as any), 4.75)
    assert.equal(promedioReporte({ animo: 5, fisico: null, participacion: 3, entorno: null } as any), 4)
    assert.equal(promedioReporte({ animo: null, fisico: null, participacion: null, entorno: null } as any), null)
    assert.equal(promedioReporte({ animo: 9, fisico: 0, participacion: 'x', entorno: 3 } as any), 3, 'lo fuera de 1 a 5 no cuenta')
  })
  test('las palabras del resumen y el formato con coma', () => {
    assert.deepEqual([4.5, 4.49, 3.5, 3.49, 2.5, 2.49, 1].map((p) => nivelGeneral(p).texto), ['Muy bien', 'Bien', 'Bien', 'Regular', 'Regular', 'Necesita atención', 'Necesita atención'])
    assert.equal(formatoPromedio(4.75), '4,8'); assert.equal(formatoPromedio(4), '4,0'); assert.equal(formatoPromedio(0.5), '0,5')
  })
  test('la tendencia dice si subió, bajó o quedó igual, y no inventa si no hay con qué comparar', () => {
    assert.deepEqual(tendencia(4.75, 4.25), { dir: 'sube', texto: 'Subió 0,5 desde la visita anterior' })
    assert.deepEqual(tendencia(3, 4), { dir: 'baja', texto: 'Bajó 1,0 desde la visita anterior' })
    assert.equal(tendencia(4, 4.04)!.dir, 'igual'); assert.equal(tendencia(4, null), null); assert.equal(tendencia(null, 4), null)
    assert.equal(direccion(5, 4), 'sube'); assert.equal(direccion(3, 4), 'baja'); assert.equal(direccion(4, 4), 'igual'); assert.equal(direccion(null, 4), null)
  })
})

describe('los reportes', () => {
  test('se ordenan del más viejo al más nuevo, se recortan a las últimas 8 y no se modifica lo recibido', () => {
    const lista = Array.from({ length: 12 }, (_, i) => rep(i)).reverse()
    const copia = [...lista]
    const r = ordenarYRecortar(lista)
    assert.equal(r.length, VENTANA_VISITAS); assert.equal(r[0].id, 'r4'); assert.equal(r.at(-1)!.id, 'r11')
    assert.deepEqual(lista, copia)
  })
  test('la serie de una nota deja null donde no aplica', () => {
    assert.deepEqual(serie([rep(0, { animo: 2 }), rep(1, { animo: null }), rep(2, { animo: 5 })], 'animo'), [2, null, 5])
  })
  test('la frase de cambio: solo con 3 visitas o más y un salto de 2 puntos o más; dice lo que más cambió', () => {
    const subida = [2, 3, 3, 4, 5].map((p, i) => rep(i, { participacion: p }))
    assert.equal(fraseDeCambio(subida), 'Participación pasó de 2 a 5 en 5 visitas')
    assert.equal(fraseDeCambio([5, 4, 3, 2].map((a, i) => rep(i, { animo: a }))), 'Ánimo bajó de 5 a 2 en 4 visitas')
    assert.equal(fraseDeCambio([3, 4].map((p, i) => rep(i, { participacion: p }))), null, 'con 2 visitas no hay tendencia')
    assert.equal(fraseDeCambio([3, 3, 4].map((p, i) => rep(i, { participacion: p }))), null, 'un punto no es un cambio')
    assert.equal(MIN_VISITAS_TENDENCIA, 3)
  })
  test('las fechas son cortas y en hora de Caracas; las novedades van de la más nueva a la más vieja y se limitan', () => {
    assert.equal(fechaCorta('2026-11-18T02:00:00.000Z'), '17 nov', 'las 2 am UTC todavía son el día anterior en Caracas')
    assert.match(fechaCorta('2026-11-18T15:00:00.000Z'), /^18 nov$/)
    const n = novedades([rep(0, { novedad: 'a' }), rep(1), rep(2, { novedad: ' b ' }), rep(3, { novedad: 'c' }), rep(4, { novedad: 'd' })])
    assert.deepEqual(n.map((x) => x.texto), ['d', 'c', 'b']); assert.equal(novedades([rep(0, { novedad: '   ' })]).length, 0)
  })
})

describe('lo que se dibuja', () => {
  const html = (reportes: any[], nombre = 'Lucía Pérez') => renderToStaticMarkup(createElement(SeguimientoBienestar, { reportes, compitaNombre: nombre }))
  test('sin reportes: explica qué verá y ofrece un ejemplo; no dibuja rejilla ni resumen', () => {
    const h = html([])
    assert.match(h, /Lucía Pérez registra cómo estuvo tu familiar/); assert.match(h, /Ver ejemplo/); assert.doesNotMatch(h, /Últimas \d+ visitas/)
  })
  test('con una visita: resumen y notas, y una frase natural en lugar de gráficos vacíos', () => {
    const h = html([rep(0, { animo: 5, fisico: 4, participacion: 5, entorno: 5 })])
    assert.match(h, /4,8/); assert.match(h, /Muy bien/); assert.match(h, /Con la próxima visita empezaremos a ver cómo evoluciona/)
    assert.doesNotMatch(h, /Últimas \d+ visitas/); assert.doesNotMatch(h, /Ver evolución completa/); assert.doesNotMatch(h, /Subió|Bajó/, 'sin visita anterior no hay tendencia')
  })
  test('con varias visitas: resumen con tendencia, las 4 notas, la rejilla, la frase y las novedades', () => {
    const rs = [3, 3, 4, 4, 3, 4, 4, 5].map((a, i) => rep(i, { animo: a, participacion: [2, 3, 3, 4, 4, 4, 4, 5][i], fisico: [3, 3, 3, 4, 3, 3, 4, 4][i], entorno: [4, 4, 4, 5, 4, 5, 5, 5][i], novedad: i === 6 ? 'Mencionó dolor de rodilla.' : null }))
    const h = html(rs)
    assert.match(h, /Subió 0,5 desde la visita anterior/); assert.match(h, /Últimas 8 visitas/); assert.match(h, /Participación pasó de 2 a 5 en 8 visitas/)
    assert.match(h, /Mencionó dolor de rodilla/); assert.match(h, /Ver evolución completa/)
    for (const l of ['Ánimo', 'Condición física', 'Participación', 'Ambiente']) assert.ok(h.includes(l), l)
    assert.equal((h.match(/aria-label="[^"]*, \d+ \w+: /g) ?? []).length, 32, '4 filas por 8 visitas, cada cuadro con su descripción')
  })
  test('una nota N/A se dice «No aplica» y una visita sin ninguna nota no inventa un promedio', () => {
    assert.match(html([rep(0, { animo: null })]), /No aplica/)
    assert.match(html([rep(0, { animo: null, fisico: null, participacion: null, entorno: null })]), /no tiene notas que sumar/)
  })
  test('el gráfico completo: una línea por nota, leyenda con nombre y forma, y descripción para lectores de pantalla', () => {
    const rs = [1, 2, 3, 4].map((v, i) => rep(i, { animo: v }))
    const g = renderToStaticMarkup(createElement(GraficoEvolucion, { reportes: rs }))
    assert.match(g, /role="img"/); assert.match(g, /aria-label="Evolución de las cuatro notas[^"]*4 visitas/)
    for (const l of ['Ánimo', 'Condición física', 'Participación', 'Ambiente']) assert.ok(g.includes(l), l)
    assert.ok(g.includes('stroke-dasharray'), 'las líneas se distinguen también por su trazo')
  })
})

describe('el diseño', () => {
  test('sin colores sueltos ni emojis, con el ⓘ de la escala, botones con explicación y las notas en 2 por 2 que se abren a 4', () => {
    for (const f of ['components/ui/SeguimientoBienestar.tsx', 'components/ui/GraficoEvolucion.tsx']) {
      const s = readFileSync(f, 'utf8')
      assert.doesNotMatch(s, /#[0-9A-Fa-f]{3,8}\b/, `${f} tiene colores sueltos`)
      assert.doesNotMatch(s, /[\u{1F300}-\u{1FAFF}]/u, `${f} tiene emojis`)
    }
    const c = readFileSync('components/ui/SeguimientoBienestar.tsx', 'utf8')
    assert.match(c, /<InfoBoton que="La escala de bienestar"/); assert.match(c, /grid-cols-2[^"]*lg:grid-cols-4/)
    assert.equal((c.match(/<Boton /g) ?? []).length, (c.match(/info="/g) ?? []).length, 'todo botón lleva su ⓘ')
  })
})
