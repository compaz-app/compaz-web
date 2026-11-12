/* eslint-disable */
// UN solo formato en el panel del equipo (decidido 2026-11-11): las piezas visuales viven en components/panel/ui.tsx y ninguna pantalla las copia.
// Si algo debe verse distinto, se cambia en ui.tsx y cambia en TODAS las pantallas a la vez.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = 'components/panel'
const archivos = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? archivos(p) : p.endsWith('.tsx') ? [p] : [] })
const todos = archivos(raiz).filter((f) => !f.endsWith('/ui.tsx'))
const fuente = (f: string) => readFileSync(f, 'utf8')

describe('las piezas únicas no se copian', () => {
  const PROHIBIDO: [string, RegExp][] = [
    ['el estilo de las pastillas de filtro (usa clasesChip, ChipLink o ChipBoton)', /rounded-full px-3 text-sm font-bold/],
    ['el estilo de los botones del paginador (usa Paginador)', /flex min-h-9 items-center rounded-lg border border-borde bg-blanco px-3 text-sm font-bold/],
    ['el contenedor de las listas (usa CLASE_LISTA)', /divide-y divide-borde overflow-hidden/],
    ['un título de pantalla suelto (usa Encabezado)', /<h1 className=/],
    ['la etiqueta de un panel lateral (usa EncabezadoLateral)', /bg-fondo-lavanda px-1\.5 py-0\.5 text-\[11px\] font-extrabold uppercase/],
    ['el título de un bloque lateral (usa TituloBloque)', /text-xs font-extrabold uppercase tracking-wider text-texto-sutil/],
    ['una etiqueta de rol de colores (usa Rol, que es neutra)', /uppercase text-(morado-claro|naranja-oscuro)/],
  ]
  for (const [que, re] of PROHIBIDO) test(`ninguna pantalla copia ${que}`, () => { for (const f of todos) assert.doesNotMatch(fuente(f), re, f) })
  test('las piezas existen y las pantallas principales las usan', () => {
    const ui = fuente(join(raiz, 'ui.tsx')); for (const n of ['Encabezado', 'clasesChip', 'ChipLink', 'ChipBoton', 'Filtros', 'Paginador', 'Rol', 'EncabezadoLateral', 'TituloBloque', 'CLASE_LISTA']) assert.match(ui, new RegExp(`export (function|const) ${n}\\b`), n)
    for (const f of ['Bandeja', 'Seguimiento', 'Visitas', 'mas/Hub']) assert.match(fuente(join(raiz, `${f}.tsx`)), /<Encabezado/, f)
    assert.match(fuente('app/panel/page.tsx'), /<Encabezado titulo="Personas"/)
    for (const f of ['FichaPersona', 'CasoSeguimiento', 'DetalleVisita', 'VerChat']) assert.match(fuente(join(raiz, `${f}.tsx`)), /<EncabezadoLateral/, f)
    for (const f of ['Seguimiento', 'Visitas', 'Personas', 'mas/Actividad', 'mas/Avisos', 'mas/Pagos']) assert.match(fuente(join(raiz, `${f}.tsx`)), /<Paginador/, f)
  })
  test('toda lista abre con una sola flecha o botón: ninguna fila anida enlaces', () => {
    for (const f of ['Seguimiento', 'Visitas']) { const s = fuente(join(raiz, `${f}.tsx`)); assert.doesNotMatch(s, /persona: `/, f) }
  })
})
