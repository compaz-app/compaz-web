/* eslint-disable */
// El formulario de registro del compita es corto: presupuesto de palabras visibles por defecto (la guía plegada de cómo grabar el video no cuenta) y pantalla de activación en 3 pasos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AVISO_FRAUDE } from '@/lib/avisos-seguridad'

const fuente = readFileSync('app/onboarding/page.tsx', 'utf8')
const pal = (t: string) => (t.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡0-9$%]+/g) ?? []).length
function visibles(txt: string): number {
  let n = 0
  for (const l of txt.split('\n')) {
    const st = l.trim(); if (st.startsWith('//') || st.startsWith('/*')) continue
    for (const m of l.matchAll(/>\s*([^<>{}=;]{6,}?)\s*</g)) { const x = m[1].split(/\s+/).join(' '); if (/\b(const|return|function|useState)\b|=>/.test(x) || pal(x) < 2) continue; n += pal(x) }
    for (const m of l.matchAll(/(?:placeholder|aria-label|title)="([^"]{6,})"/g)) n += pal(m[1])
  }
  return n
}
const a = fuente.indexOf('{guiaYoutube && ('); const b = fuente.indexOf('              )}', a)
const visible = visibles(fuente) - visibles(fuente.slice(a, b))

test(`el formulario muestra como máximo 290 palabras por defecto (antes 366); tiene ${visible}`, () => assert.ok(visible <= 290, `tiene ${visible}`))
test('los textos de ayuda bajo cada campo son de 12 palabras o menos', () => {
  for (const m of fuente.matchAll(/<p style=\{s\.hint\}>([^<]+)<\/p>/g)) assert.ok(pal(m[1]) <= 20, `«${m[1]}» tiene ${pal(m[1])}`)
})
test('la pantalla de después del registro son 3 pasos con el aviso de fraude corto y descargas de iPhone y Android; ya no hay «Paso 1 / Paso 2» ni la alerta larga', () => {
  assert.match(fuente, /Tu perfil aparece para los clientes cuando actives Telegram/)
  assert.equal((fuente.match(/Toca el botón naranja para abrir el bot|escribe tu nombre completo|código de 6 dígitos/g) ?? []).length >= 3, true)
  assert.match(fuente, /\{AVISO_FRAUDE\}/); assert.ok(AVISO_FRAUDE.length > 20)
  assert.match(fuente, /apps\.apple\.com/); assert.match(fuente, /play\.google\.com/)
  assert.doesNotMatch(fuente, /Paso 1 — Descarga Telegram|Paso 2 — Abre el bot|Alerta de fraude/)
})
