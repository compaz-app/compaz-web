/* eslint-disable */
// Las fotos que suben los compitas son públicas: no deben llevar la ubicación GPS ni otros metadatos, y no deben pesar megas para mostrarse en 80 píxeles.
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { db, limpiar, mkCompita } from './harness'
import { POST as subirPerfil } from '@/app/api/compita/upload-foto/route'
import { guardarFotoPrivada } from '@/lib/fotos-privadas'
import { limpiarImagen, quitarMetadatosJpeg, tipoImagenReal } from '@/lib/imagen'

// Una foto «de celular»: grande, con orientación y ubicación GPS dentro del archivo.
const fotoConGps = () => sharp({ create: { width: 2400, height: 1800, channels: 3, background: { r: 200, g: 120, b: 80 } } })
  .jpeg({ quality: 95 }).withExif({ IFD0: { Copyright: 'privado', Make: 'TelefonoX' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '10/1 30/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '66/1 54/1 0/1' } }).toBuffer()

describe('fotos sin metadatos', () => {
  test('la foto de ejemplo realmente trae ubicación y datos del teléfono (la prueba no es vacía)', async () => {
    const m = await sharp(await fotoConGps()).metadata()
    assert.ok(m.exif && m.exif.length > 0)
    assert.ok((await fotoConGps()).includes(Buffer.from('TelefonoX')))
  })

  test('al subirla: WebP, más chica de 1600 píxeles, mucho más liviana y SIN metadatos', async () => {
    const original = await fotoConGps()
    const r = await limpiarImagen(original)
    assert.equal(r.limpia, true); assert.equal(r.contentType, 'image/webp'); assert.equal(r.ext, 'webp')
    assert.equal(tipoImagenReal(r.bytes), 'image/webp')
    const m = await sharp(r.bytes).metadata()
    assert.ok(Math.max(m.width!, m.height!) <= 1600)
    assert.equal(m.exif, undefined, 'sin EXIF')
    assert.ok(!r.bytes.includes(Buffer.from('TelefonoX')) && !r.bytes.includes(Buffer.from('GPS')))
    assert.ok(r.bytes.length < original.length / 2, `pesa ${r.bytes.length} contra ${original.length}`)
  })

  test('respeta la orientación de la foto antes de descartarla', async () => {
    const vertical = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#888' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    const m = await sharp((await limpiarImagen(vertical)).bytes).metadata()
    assert.ok(m.height! > m.width!, 'la foto girada queda vertical')
  })

  test('respaldo: si no se puede procesar, un JPEG igual pierde sus metadatos a mano', async () => {
    const original = await fotoConGps()
    const sin = quitarMetadatosJpeg(original)!
    assert.ok(sin && !sin.includes(Buffer.from('TelefonoX')) && !sin.includes(Buffer.from('Exif')))
    assert.equal((await sharp(sin).metadata()).format, 'jpeg', 'sigue siendo una imagen válida')
    assert.equal(quitarMetadatosJpeg(Buffer.from('no es un jpeg')), null)
  })

  test('lo que no se puede procesar se guarda como llegó, sin romper la subida', async () => {
    const falso = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('basura')])
    const r = await limpiarImagen(falso)
    assert.equal(r.limpia, false); assert.equal(r.contentType, 'image/jpeg'); assert.equal(r.bytes.equals(falso), true)
  })
})

beforeEach(limpiar)

describe('por los caminos reales de subida', () => {
  test('foto de perfil del compita: se guarda en WebP y liviana, aunque llegue como JPEG grande con GPS', async () => {
    const c = mkCompita(); db.seed('compita_edit_tokens', { token: 'tk', compita_id: c.id, expires_at: new Date(Date.now() + 3600_000).toISOString(), usado: false })
    const original = await fotoConGps()
    const fd = new FormData(); fd.set('foto', new File([new Uint8Array(original)], 'yo.jpg', { type: 'image/jpeg' })); fd.set('token', 'tk')
    const r = await subirPerfil(new Request('http://x/api/compita/upload-foto', { method: 'POST', body: fd }) as any)
    assert.equal(r.status, 200)
    const url = (await r.json()).url as string
    assert.match(url, /\.webp$/)
    const guardado = [...db.objetos.entries()].find(([k]) => k.startsWith('fotos/compitas/'))!
    assert.equal(guardado[1].contentType, 'image/webp')
    assert.ok(guardado[1].bytes < original.length / 2)
  })

  test('foto privada (llegada): también se guarda sin metadatos y en WebP', async () => {
    const r = await guardarFotoPrivada({ tipo: 'llegada', bytes: await fotoConGps(), contentType: 'image/jpeg' })
    assert.ok(r)
    assert.match(db.rows('fotos_privadas')[0].ruta, /\.webp$/)
    assert.equal([...db.objetos.values()][0].contentType, 'image/webp')
  })
})
