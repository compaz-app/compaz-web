/* eslint-disable */
// El login de un deploy preview de Netlify vuelve al preview (antes mandaba a micompaz.com y la sesión nunca llegaba al preview).
// En producción nada cambia: la dirección pública sigue siendo NEXT_PUBLIC_SITE_URL.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { origenDePreview, baseUrl } from '@/lib/site'
import { panelDeRegreso } from '@/lib/login-destino'

const pet = (host: string, extra: Record<string, string> = {}) => ({
  nextUrl: { origin: `https://${host}`, host }, url: `https://${host}/panel`,
  headers: { get: (n: string) => extra[n.toLowerCase()] ?? null },
})

describe('dirección pública en un deploy preview', () => {
  test('en un preview, la petición a deploy-preview-N vuelve a ese mismo preview', () => {
    assert.equal(origenDePreview(pet('deploy-preview-25--compaz-beta.netlify.app'), 'deploy-preview'), 'https://deploy-preview-25--compaz-beta.netlify.app')
    assert.equal(origenDePreview(pet('6afa6f3cb36051c7519bd3f5--compaz-beta.netlify.app'), 'deploy-preview'), 'https://6afa6f3cb36051c7519bd3f5--compaz-beta.netlify.app')
  })
  test('en producción NUNCA: aunque la petición diga que viene de un preview', () => {
    for (const c of ['production', '', 'branch-deploy']) assert.equal(origenDePreview(pet('deploy-preview-25--compaz-beta.netlify.app'), c), null, c)
  })
  test('solo direcciones de preview de ESTE sitio: nada de dominios ajenos ni cabeceras falsas', () => {
    for (const h of ['evil.com', 'deploy-preview-25--otro-sitio.netlify.app', 'deploy-preview-25--compaz-beta.netlify.app.evil.com', 'main--compaz-beta.netlify.app', 'micompaz.com', 'x.deploy-preview-25--compaz-beta.netlify.app'])
      assert.equal(origenDePreview(pet(h), 'deploy-preview'), null, h)
    // Una cabecera x-forwarded-host falsa no cuela: se ignora si no es un preview de este sitio y se usa el host real.
    assert.equal(origenDePreview(pet('deploy-preview-25--compaz-beta.netlify.app', { 'x-forwarded-host': 'evil.com' }), 'deploy-preview'), 'https://deploy-preview-25--compaz-beta.netlify.app')
    assert.equal(origenDePreview(pet('evil.com', { 'x-forwarded-host': 'evil.com' }), 'deploy-preview'), null)
  })
  test('sin contexto de preview (pruebas, local, producción), baseUrl sigue siendo NEXT_PUBLIC_SITE_URL', () => {
    const antes = process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = 'https://micompaz.com'
    try { assert.equal(baseUrl(pet('deploy-preview-25--compaz-beta.netlify.app')), 'https://micompaz.com') }
    finally { if (antes === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = antes }
  })
  test('el contexto sale de la compilación (variable CONTEXT de Netlify), no de la petición', () => {
    assert.match(readFileSync('next.config.ts', 'utf8'), /COMPAZ_CONTEXTO_DESPLIEGUE: process\.env\.CONTEXT/)
    // El proxy (sin sesión → login), el enlace del correo y /auth/confirm usan urlPublica / baseUrl con la petición.
    assert.match(readFileSync('proxy.ts', 'utf8'), /urlPublica\(`\/login\?returnTo=\$\{encodeURIComponent\(pathname \+ request\.nextUrl\.search\)\}`, request\)/)
    assert.match(readFileSync('app/api/auth/solicitar-acceso/route.ts', 'utf8'), /baseUrl\(req\)\}\/auth\/confirm/)
  })
  test('los webhooks de Telegram y Daily siguen apuntando a producción aunque se llamen desde un preview', () => {
    assert.doesNotMatch(readFileSync('app/api/setup-webhook/route.ts', 'utf8'), /baseUrl\(|urlPublica\(/)
    assert.doesNotMatch(readFileSync('app/api/setup-daily-webhook/route.ts', 'utf8'), /baseUrl\(|urlPublica\(/)
  })
})

describe('el administrador vuelve a la pantalla del panel de la que venía', () => {
  test('una ruta del panel se respeta; cualquier otra cosa, al inicio del panel', () => {
    assert.equal(panelDeRegreso('/panel?sec=confianza&cf_modo=demo'), '/panel?sec=confianza&cf_modo=demo')
    assert.equal(panelDeRegreso('/panel'), '/panel')
    for (const r of ['/dashboard', '/panelx', '//evil.com/panel', 'https://evil.com/panel', '', null, undefined, '/admin']) assert.equal(panelDeRegreso(r as any), '/panel', String(r))
  })
})
