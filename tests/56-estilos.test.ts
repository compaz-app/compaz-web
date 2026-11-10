/* eslint-disable */
// Estilos: una sola fuente de colores (lib/design.ts). Dos guardias:
//  1. El CSS de tokens que usa Tailwind está generado desde lib/design.ts y no se desactualiza.
//  2. "Trinquete": ningún archivo puede tener MÁS colores escritos a mano (#RRGGBB) que su línea base. Lo viejo se migra poco a poco y solo
//     puede mejorar; lo nuevo nace sin colores sueltos. Al migrar una pantalla, baja su línea base: UPDATE_ESTILOS=1 node tests/run.mjs 56
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { generarCss } from '../scripts/generar-tokens.mjs'
import { colors } from '@/lib/design'

const raiz = process.cwd()
const BASE = join(raiz, 'tests/estilos-base.json')
// Fuera del alcance: el prototipo (se descarta al terminar la migración) y los textos que van a correos o a Telegram, donde no existe CSS con variables.
const EXCLUIDOS = [/^app\/prototipo\//, /^lib\/(resend|plantillas-aviso|design)\.ts$/, /^app\/api\//, /^app\/tokens\.generated\.css$/]
const HEX = /#[0-9A-Fa-f]{6}\b/g

function archivos(dir: string, salida: string[] = []) {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f.startsWith('.')) continue
    const p = join(dir, f)
    if (statSync(p).isDirectory()) archivos(p, salida)
    else if (/\.(tsx?|css)$/.test(f)) salida.push(p)
  }
  return salida
}
function contar(): Record<string, number> {
  const r: Record<string, number> = {}
  for (const d of ['app', 'components']) {
    for (const p of archivos(join(raiz, d))) {
      const rel = relative(raiz, p)
      if (EXCLUIDOS.some((x) => x.test(rel))) continue
      const n = (readFileSync(p, 'utf8').match(HEX) ?? []).length
      if (n > 0) r[rel] = n
    }
  }
  return r
}

describe('tokens', () => {
  test('app/tokens.generated.css está al día con lib/design.ts (si falla: npm run tokens)', () => {
    assert.equal(readFileSync(join(raiz, 'app/tokens.generated.css'), 'utf8'), generarCss())
  })
  test('cada color de lib/design.ts tiene su variable CSS con el mismo valor', () => {
    const css = readFileSync(join(raiz, 'app/tokens.generated.css'), 'utf8')
    for (const [k, v] of Object.entries(colors)) assert.ok(css.includes(`--color-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v};`), k)
  })
  test('los nombres antiguos del prototipo apuntan a los tokens (no duplican el valor)', () => {
    const g = readFileSync(join(raiz, 'app/globals.css'), 'utf8')
    for (const v of ['--orange', '--purple', '--purple-dark', '--yellow', '--warm-white', '--warm-gray', '--text-dark', '--text-mid', '--text-light', '--border-muted']) assert.match(g, new RegExp(`${v}: var\\(--color-`), v)
  })
})

describe('trinquete de colores sueltos', () => {
  const actual = contar()
  if (process.env.UPDATE_ESTILOS === '1') { writeFileSync(BASE, JSON.stringify(actual, Object.keys(actual).sort(), 2) + '\n'); }
  const base: Record<string, number> = JSON.parse(readFileSync(BASE, 'utf8'))
  test('ningún archivo tiene más colores sueltos que su línea base, y los archivos nuevos no traen ninguno', () => {
    const peor = Object.entries(actual).filter(([f, n]) => n > (base[f] ?? 0)).map(([f, n]) => `${f}: ${n} (base ${base[f] ?? 0})`)
    assert.deepEqual(peor, [], `Colores escritos a mano: usa los tokens de lib/design.ts (clases Tailwind como bg-naranja, o colors.naranja en estilos en línea).\n${peor.join('\n')}`)
  })
  test('la línea base está ajustada: si migraste una pantalla, bájala (UPDATE_ESTILOS=1 node tests/run.mjs 56)', () => {
    const mejor = Object.entries(base).filter(([f, n]) => (actual[f] ?? 0) < n).map(([f, n]) => `${f}: ahora ${actual[f] ?? 0}, base ${n}`)
    assert.deepEqual(mejor, [], `Mejoraste estos archivos: baja su línea base para que no vuelvan atrás.\n${mejor.join('\n')}`)
  })
  test('los componentes base y la guía visual no tienen ningún color suelto', () => {
    const sueltos = Object.keys(actual).filter((f) => f.startsWith('components/ui/base/') || f.startsWith('app/guia-visual/'))
    assert.deepEqual(sueltos, [])
  })
})
