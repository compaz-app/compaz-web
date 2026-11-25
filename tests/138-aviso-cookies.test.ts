/* eslint-disable */
// Aviso de cookies: sin permiso no se carga ninguna medición de terceros; rechazar cuesta lo mismo que aceptar; la decisión caduca y se puede cambiar.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { codificarDecision, leerDecision, VERSION_COOKIES, VIGENCIA_COOKIES_DIAS, CLAVE_COOKIES } from '@/lib/consentimiento'

const DIA = 86_400_000
const leer = (f: string) => readFileSync(f, 'utf8')

describe('la decisión', () => {
  test('se guarda y se lee; sin nada guardado hay que preguntar', () => {
    const ahora = Date.now()
    assert.equal(leerDecision(codificarDecision('si', ahora), ahora), 'si')
    assert.equal(leerDecision(codificarDecision('no', ahora), ahora), 'no')
    assert.equal(leerDecision(null), null); assert.equal(leerDecision(''), null); assert.equal(leerDecision(undefined), null)
  })
  test('lo dañado, manipulado o de otra versión no cuenta como permiso (se vuelve a preguntar)', () => {
    const ahora = Date.now()
    for (const malo of ['no es json', '{}', '{"v":1,"d":"quizas","en":"2026-01-01"}', JSON.stringify({ v: VERSION_COOKIES + 1, d: 'si', en: new Date(ahora).toISOString() }),
      JSON.stringify({ v: VERSION_COOKIES, d: 'si' }), JSON.stringify({ v: VERSION_COOKIES, d: 'si', en: 'ayer' }), JSON.stringify({ v: VERSION_COOKIES, d: 'si', en: new Date(ahora + 10 * DIA).toISOString() })])
      assert.equal(leerDecision(malo, ahora), null, malo)
  })
  test('caduca al año: pasado ese tiempo se vuelve a preguntar', () => {
    const ahora = Date.now()
    assert.equal(VIGENCIA_COOKIES_DIAS, 365)
    assert.equal(leerDecision(codificarDecision('si', ahora - 364 * DIA), ahora), 'si')
    assert.equal(leerDecision(codificarDecision('si', ahora - 366 * DIA), ahora), null)
  })
})

describe('el aviso y los scripts', () => {
  test('los scripts solo se cargan con permiso explícito, y el hook se llama antes de cualquier condición', () => {
    const c = leer('components/ScriptsAnaliticos.tsx')
    assert.match(c, /const decision = useDecisionCookies\(\)/)
    assert.match(c, /esRutaConAnalitica\(pathname\) && decision === 'si'/)
    assert.ok(c.indexOf('useDecisionCookies()') < c.indexOf('esRutaConAnalitica(pathname)'), 'la regla de los hooks')
    assert.match(c, /clarity\?\.\('stop'\)/, 'al retirar el permiso se les pide parar')
  })
  test('el aviso solo sale en páginas públicas y mientras no haya decisión; aceptar y rechazar son iguales de fáciles', () => {
    const a = leer('components/AvisoCookies.tsx')
    assert.match(a, /if \(!esRutaConAnalitica\(pathname\) \|\| decision !== 'pendiente'\) return null/)
    assert.match(a, /guardarDecisionCookies\('no'\)/); assert.match(a, /guardarDecisionCookies\('si'\)/)
    assert.match(a, /Solo las necesarias/); assert.match(a, /Aceptar/)
    assert.equal((a.match(/<Boton /g) ?? []).length, 2); assert.equal((a.match(/info="/g) ?? []).length, 2, 'cada botón lleva su explicación')
    assert.match(a, /href="\/privacidad#cookies"/)
    assert.doesNotMatch(a, /[\u{1F300}-\u{1FAFF}]/u, 'sin emojis en la web')
    assert.match(leer('app/layout.tsx'), /<AvisoCookies \/>/)
  })
  test('la página de privacidad explica qué se mide, avisa que el texto es provisional y deja cambiar la decisión', () => {
    const p = leer('app/privacidad/page.tsx')
    assert.match(p, /id: "cookies"/); assert.match(p, /Google Analytics/); assert.match(p, /Microsoft Clarity/); assert.match(p, /Meta Pixel/)
    assert.match(p, /pendiente de revisión legal/); assert.match(p, /<CambiarCookies \/>/)
    assert.match(p, /no se usan en el portal/)
    const b = leer('components/CambiarCookies.tsx'); assert.match(b, /olvidarDecisionCookies/); assert.match(b, /guardarDecisionCookies\('si'\)/)
  })
  test('la clave guardada es estable y la lectura usa memoria si el navegador no deja guardar', () => {
    assert.equal(CLAVE_COOKIES, 'compaz_cookies')
    const c = leer('lib/consentimiento-cliente.ts'); assert.match(c, /enMemoria/); assert.match(c, /dispatchEvent\(new Event\(EVENTO\)\)/)
  })
})
