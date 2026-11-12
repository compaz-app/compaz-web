/* eslint-disable */
// Decidido 2026-11-12: el producto NO usa emojis en ningún lado (web, portal, panel, correos, Telegram). Esta prueba impide que vuelvan a entrar.
// Se permiten los símbolos de texto (flechas, ©, ⓘ, ★, ✓): no son emojis.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const EMOJI = /\p{Regional_Indicator}{2}|[0-9#*]️?⃣|\p{Emoji_Presentation}|\p{Extended_Pictographic}️|[⚠⏱▶]/u
const CARPETAS = ['app', 'components', 'lib', 'netlify', 'types', 'scripts', 'public']
const EXT = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.css', '.html', '.svg'])
function archivos(d: string): string[] {
  return readdirSync(d).flatMap((n) => {
    if (n === 'node_modules' || n.startsWith('.')) return []
    const p = join(d, n); return statSync(p).isDirectory() ? archivos(p) : EXT.has(extname(n)) ? [p] : []
  })
}

describe('sin emojis', () => {
  test('ningún archivo del producto contiene un emoji', () => {
    const malos: string[] = []
    for (const c of CARPETAS) { try { for (const f of archivos(c)) { const t = readFileSync(f, 'utf8'); const m = t.match(EMOJI); if (m) malos.push(`${f}: ${m[0]}`) } } catch {} }
    assert.deepEqual(malos, [], 'Hay emojis (el producto no los usa): usa texto o un icono de línea (SVG).')
  })
  test('las pruebas tampoco los esperan en los textos', () => {
    const malos = archivos('tests').filter((f) => f.endsWith('.ts') && EMOJI.test(readFileSync(f, 'utf8')) && !f.endsWith('84-sin-emojis.test.ts'))
    assert.deepEqual(malos, [])
  })
})

describe('perfil del compita', () => {
  test('el registro y el perfil tienen la sección "Cuidador de mascotas" (Próximamente), sin campos que se envíen', () => {
    for (const f of ['app/onboarding/page.tsx', 'app/compita/perfil/EditarPerfil.tsx']) assert.match(readFileSync(f, 'utf8'), /<SeccionCuidadorMascotas \/>/, f)
    const c = readFileSync('components/ui/Proximamente.tsx', 'utf8')
    assert.match(c, /Cuidador de mascotas/); assert.match(c, /Más adelante te preguntaremos/); assert.doesNotMatch(c, /<input(?![^>]*disabled)/)
  })
})
