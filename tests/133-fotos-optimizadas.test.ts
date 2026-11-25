/* eslint-disable */
// Las fotos de los compitas se sirven optimizadas (AVIF/WebP y al tamaño en que se ven), no la original de hasta 5 MB.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leer = (f: string) => readFileSync(f, 'utf8')

describe('fotos optimizadas', () => {
  test('la configuración pide AVIF y WebP y autoriza solo el almacenamiento público de Supabase, sin direcciones escritas a mano', () => {
    const c = leer('next.config.ts')
    assert.match(c, /formats: \["image\/avif", "image\/webp"\]/)
    assert.match(c, /pathname: "\/storage\/v1\/object\/public\/\*\*"/)
    assert.match(c, /new URL\(SUPABASE_ORIGEN\)\.hostname/)
    assert.doesNotMatch(c, /[a-z0-9]{15,}\.supabase\.co/, 'ningún proyecto de Supabase escrito a mano')
  })

  test('las fotos de compitas de las pantallas principales usan el componente optimizado y no una etiqueta img suelta', () => {
    for (const f of ['app/compitas/CompitasMarketplace.tsx', 'components/ui/PerfilPublicoCompita.tsx', 'components/ui/VisitasSection.tsx', 'app/pago/page.tsx']) {
      const s = leer(f)
      assert.match(s, /FotoRedonda/, f)
      assert.doesNotMatch(s, /<img src=\{[^}]*foto/, `${f} sigue bajando la foto original`)
    }
  })

  test('el componente optimiza solo lo que el optimizador admite y deja lo demás como estaba', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'
    const { esFotoOptimizable } = await import('@/components/ui/FotoRedonda')
    // el origen se lee al cargar el módulo: aquí solo se comprueba lo que no depende de él
    assert.equal(esFotoOptimizable('/images/ejemplo.webp'), true)
    assert.equal(esFotoOptimizable('https://otro-sitio.com/foto.jpg'), false)
    assert.equal(esFotoOptimizable('http://localhost/x.jpg'), false)
    const src = leer('components/ui/FotoRedonda.tsx')
    assert.match(src, /quality=\{70\}/); assert.match(src, /width=\{size\} height=\{size\}/)
  })
})
