/* eslint-disable */
import './harness'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { esc, escLike, rutaInterna } from '@/lib/html'
import { firmaRol, rolValido, urlFotoFirmada, fotoFirmaValida, secretoValido, ratingValido, tokenRating } from '@/lib/links'
import { hoyVE, horaVE, formatFechaVE, esSlotFuturo } from '@/lib/format'
import { validarPerfil, esUrlYoutube, esUrlFotoPropia } from '@/lib/validar'
import { tipoImagenReal } from '@/lib/imagen'
import { fotoSrc } from '@/lib/fotos'

test('esc neutraliza HTML', () => {
  assert.equal(esc(`<img src=x onerror="a()">&'`), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;')
  assert.equal(esc(null), '')
})
test('escLike escapa comodines', () => assert.equal(escLike('50%_a\\'), '50\\%\\_a\\\\'))
test('rutaInterna bloquea open redirect', () => {
  assert.equal(rutaInterna('//evil.com'), '/dashboard')
  assert.equal(rutaInterna('https://evil.com'), '/dashboard')
  assert.equal(rutaInterna('/\\evil.com'), '/dashboard')
  assert.equal(rutaInterna('/compitas?x=1'), '/compitas?x=1')
  assert.equal(rutaInterna(null), '/dashboard')
})
test('firma de rol: cliente no puede hacerse pasar por compita', () => {
  const t = 'tok-123'
  assert.ok(rolValido(t, 'cliente', firmaRol(t, 'cliente')))
  assert.ok(!rolValido(t, 'compita', firmaRol(t, 'cliente')))
  assert.ok(!rolValido(t, 'cliente', null))
  assert.ok(!rolValido('otro', 'cliente', firmaRol(t, 'cliente')))
  assert.ok(!rolValido(t, 'admin', firmaRol(t, 'cliente')))
})
test('foto firmada: válida, expirada y manipulada', () => {
  const url = new URL(urlFotoFirmada('https://x.test', 'msg-1'))
  assert.ok(fotoFirmaValida('msg-1', url.searchParams.get('e'), url.searchParams.get('s')))
  assert.ok(!fotoFirmaValida('msg-2', url.searchParams.get('e'), url.searchParams.get('s')))
  assert.ok(!fotoFirmaValida('msg-1', '1', url.searchParams.get('s')))
  assert.ok(!fotoFirmaValida('msg-1', null, null))
})
test('rating: la firma incluye el valor (no se puede subir/bajar)', () => {
  assert.ok(ratingValido('v1', 5, tokenRating('v1', 5)))
  assert.ok(!ratingValido('v1', 1, tokenRating('v1', 5)))
})
test('secretoValido falla cerrado con secretos vacíos', () => {
  assert.ok(!secretoValido('', ''))
  assert.ok(!secretoValido(null, 'x'))
  assert.ok(!secretoValido('x', undefined))
  assert.ok(secretoValido('abc', 'abc'))
  assert.ok(!secretoValido('abd', 'abc'))
})
test('fechas en hora de Venezuela', () => {
  assert.match(hoyVE(), /^\d{4}-\d{2}-\d{2}$/)
  assert.match(horaVE(), /^\d{2}:\d{2}$/)
  // El día "2026-10-10" debe formatearse como sábado 10, sin desfase de zona
  assert.match(formatFechaVE('2026-10-10'), /sábado.*10/i)
})
test('esSlotFuturo rechaza NaN, pasado y no-strings', () => {
  assert.ok(!esSlotFuturo('no-es-fecha'))
  assert.ok(!esSlotFuturo(123))
  assert.ok(!esSlotFuturo(new Date(Date.now() - 1000).toISOString()))
  assert.ok(!esSlotFuturo(new Date(Date.now() + 5 * 60_000).toISOString(), 30))
  assert.ok(esSlotFuturo(new Date(Date.now() + 60 * 60_000).toISOString(), 30))
})
test('validarPerfil: ignora campos privilegiados y valida formato', () => {
  const r = validarPerfil({ descripcion: 'Hola', verificado: true, estado: 'activo', rating_promedio: 5, telegram_chat_id: '1' } as any)
  assert.ok(r.ok)
  assert.deepEqual(Object.keys((r as any).datos), ['descripcion']) // nada privilegiado pasa
  assert.ok(!validarPerfil({ youtube_url: 'https://evil.com/watch?v=1' }).ok)
  assert.ok(!validarPerfil({ youtube_url: 'javascript:alert(1)' }).ok)
  assert.ok(!validarPerfil({ youtube_url: 'http://youtube.com/watch?v=1' }).ok)
  assert.ok(validarPerfil({ youtube_url: 'https://youtu.be/abc' }).ok)
  assert.ok(!validarPerfil({ foto_url: 'https://tracker.evil/p.png' }).ok)
  assert.ok(validarPerfil({ foto_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fotos/compitas/a.jpg` }).ok)
  assert.ok(!validarPerfil({ servicios: Array(30).fill('x') }).ok)
  assert.ok(!validarPerfil({ horarios_disponibles: [{ dia: 'lunes', inicio: '25:00', fin: '26:00' }] }).ok)
  assert.ok(!validarPerfil({ horarios_disponibles: [{ dia: 'lunes', inicio: '10:00', fin: '09:00' }] }).ok)
  assert.ok(validarPerfil({ horarios_disponibles: [{ dia: 'lunes', inicio: '09:00', fin: '12:00' }] }).ok)
  const sinNombre = validarPerfil({ nombre: 'Hack', zona: 'X' }, { permitirNombre: false })
  assert.ok(sinNombre.ok && !('nombre' in (sinNombre as any).datos), 'el nombre no se acepta en el auto-servicio')
})
test('tipoImagenReal verifica magic bytes, no el Content-Type', () => {
  assert.equal(tipoImagenReal(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(tipoImagenReal(new TextEncoder().encode('<svg onload=alert(1)>')), null)
  assert.equal(tipoImagenReal(new TextEncoder().encode('<html><script>alert(1)</script>')), null)
})
test('fotoSrc nunca renderiza URLs con el token del bot', () => {
  assert.equal(fotoSrc({ id: 'a', contenido: 'tg:FILEID' }), '/api/foto/a')
  assert.equal(fotoSrc({ id: 'a', contenido: 'https://api.telegram.org/file/botTOKEN/photos/x.jpg' }), '')
})
