/* eslint-disable */
// Decidido 2026-11-12: emojis SOLO en Telegram y las estrellas ⭐ de la calificación (1 a 5). Ni web, portal, panel ni correos. La landing (app/page.tsx) queda fuera por ahora.
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

const SIN_ESTRELLA = (s: string) => s.replace(/⭐/gu, '')
const TELEGRAM = /sendTelegramMessage|avisarAdmin|alertaAdmin|telegram/i
const EXENTOS = new Set(['app/page.tsx'])
describe('emojis solo en Telegram y estrellas', () => {
  test('fuera de Telegram no hay emojis', () => {
    const malos: string[] = []
    for (const c of CARPETAS) { try { for (const f of archivos(c)) {
      if (EXENTOS.has(f)) continue
      const t = SIN_ESTRELLA(readFileSync(f, 'utf8'))
      if (!TELEGRAM.test(t) || f.startsWith('components/') || f.endsWith('.tsx')) { const m = t.match(EMOJI); if (m) malos.push(`${f}: ${m[0]}`) }
    } } catch {} }
    assert.deepEqual(malos, [], 'Emojis solo en Telegram (y ⭐ en calificaciones): usa texto o un icono de línea (SVG).')
  })
  test('ni correos ni pantallas dentro de archivos de Telegram', () => {
    const malos: string[] = []
    for (const c of CARPETAS) { try { for (const f of archivos(c)) {
      if (EXENTOS.has(f)) continue
      for (const l of SIN_ESTRELLA(readFileSync(f, 'utf8')).split('\n')) if (/style=|subject:|<h2|<strong>/.test(l) && EMOJI.test(l)) malos.push(`${f}: ${l.trim().slice(0, 80)}`)
    } } catch {} }
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
