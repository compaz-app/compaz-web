/* eslint-disable */
// La foto se reduce en el teléfono antes de subirla (3 a 8 MB → unos cientos de KB), en todos los formularios que suben fotos.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dimensionesReducidas, reducirFoto, MAX_LADO_FOTO, PESO_QUE_NO_SE_REDUCE } from '@/lib/reducir-foto'

describe('reducir la foto en el teléfono', () => {
  test('las dimensiones: el lado mayor queda en el máximo, se mantiene la proporción y nunca se agranda', () => {
    assert.deepEqual(dimensionesReducidas(4000, 3000, 1600), { ancho: 1600, alto: 1200, reducida: true })
    assert.deepEqual(dimensionesReducidas(3000, 4000, 1600), { ancho: 1200, alto: 1600, reducida: true }) // vertical
    assert.deepEqual(dimensionesReducidas(800, 600, 1600), { ancho: 800, alto: 600, reducida: false })    // ya es chica: no se toca
    assert.deepEqual(dimensionesReducidas(1600, 1600, 1600), { ancho: 1600, alto: 1600, reducida: false })
    assert.deepEqual(dimensionesReducidas(0, 0, 1600), { ancho: 0, alto: 0, reducida: false })              // dato raro: no se rompe
    assert.equal(dimensionesReducidas(10000, 1, 1600).alto, 1, 'nunca queda en cero píxeles')
  })

  test('los valores por defecto: 1600 píxeles y no se recomprime lo que ya pesa poco', () => {
    assert.equal(MAX_LADO_FOTO, 1600); assert.equal(PESO_QUE_NO_SE_REDUCE, 300 * 1024)
  })

  test('nunca falla: sin navegador, o con algo que no es una imagen, devuelve el mismo archivo', async () => {
    const f = new File(['hola'], 'nota.txt', { type: 'text/plain' })
    assert.equal(await reducirFoto(f), f)
    const img = new File([new Uint8Array(10)], 'x.jpg', { type: 'image/jpeg' })
    assert.equal(await reducirFoto(img), img, 'sin documento (aquí no hay navegador) se devuelve la original')
  })

  test('todos los formularios que suben fotos la reducen antes de enviarla', () => {
    for (const f of ['app/compita/perfil/EditarPerfil.tsx', 'app/onboarding/page.tsx', 'components/panel/FormCompita.tsx', 'app/solicitar/SolicitarForm.tsx']) {
      const s = readFileSync(f, 'utf8')
      assert.match(s, /reducirFoto\(/, `${f} no reduce la foto`)
      assert.doesNotMatch(s, /append\('foto', (file|fotoFile|foto)\)/, `${f} sigue enviando la original`)
    }
    assert.doesNotMatch(readFileSync('app/solicitar/SolicitarForm.tsx', 'utf8'), /createImageBitmap/, 'ya no hay una copia propia del código')
  })
})
