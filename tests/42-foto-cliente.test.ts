/* eslint-disable */
// La foto del cliente: se guarda privada, el compita la ve solo mientras decide desde una página nuestra (nunca por
// Telegram) y se borra de verdad (al reemplazarla, quitarla o eliminar la cuenta).
import { db, limpiar, req, session, mkCliente, mkCompita, tgPara } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { GET as fotoGet, POST as fotoPost, DELETE as fotoDelete } from '@/app/api/usuario/foto/route'
import { GET as verFoto } from '@/app/api/solicitud-foto/[token]/route'
import { POST as solicitar } from '@/app/api/solicitudes/route'
import { DELETE as eliminar } from '@/app/api/admin/eliminar-cliente/route'
import { borrarFotosVencidas } from '@/lib/fotos-privadas'

beforeEach(limpiar)
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
const jpg = (bytes = 2000, tipo = 'image/jpeg') => new Blob([new Uint8Array(bytes).fill(7)], { type: tipo })
const subir = (c: any, blob: Blob = jpg()) => {
  como(c)
  const f = new FormData(); f.append('foto', blob, 'foto.jpg')
  return fotoPost(new Request('http://x/api/usuario/foto', { method: 'POST', body: f }) as any)
}
const activas = () => db.rows('fotos_privadas').filter((f) => !f.borrada_en)
const ver = (token: string) => verFoto(new Request('http://x') as any, { params: Promise.resolve({ token }) })
const pedir = (c: any, compita: any, extra: any = {}) => {
  como(c)
  return solicitar(req('/api/solicitudes', { json: { compita_id: compita.id, tipo: 'directa', que: 'Compañía y conversación', lugar_privado: false, ...extra } }))
}

describe('subir la foto', () => {
  test('se guarda privada con fecha de borrado y queda marcada como del cliente', async () => {
    const c = mkCliente()
    assert.equal((await subir(c)).status, 200)
    assert.equal(activas().length, 1)
    assert.equal(activas()[0].tipo, 'cliente'); assert.equal(activas()[0].usuario_id, c.id); assert.ok(activas()[0].borrar_en)
    como(c); assert.equal((await (await fotoGet()).json()).data.tiene, true)
  })
  test('rechaza lo que no es una foto y lo demasiado grande, y exige sesión', async () => {
    const c = mkCliente()
    assert.equal((await subir(c, jpg(100, 'application/pdf'))).status, 400)
    assert.equal((await subir(c, jpg(7 * 1024 * 1024))).status, 400)
    assert.equal(activas().length, 0)
    session.user = null
    assert.equal((await fotoGet()).status, 401)
  })
  test('subir otra reemplaza: la anterior se borra de verdad, no se acumulan', async () => {
    const c = mkCliente()
    await subir(c); const primera = activas()[0]
    await subir(c)
    assert.equal(activas().length, 1)
    assert.notEqual(activas()[0].id, primera.id)
    assert.ok(db.rows('fotos_privadas').find((f) => f.id === primera.id)!.borrada_en)
    assert.equal(db.objetos.size, 1, 'solo queda un archivo')
  })
  test('quitarla la borra', async () => {
    const c = mkCliente(); await subir(c)
    como(c); assert.equal((await fotoDelete()).status, 200)
    assert.equal(activas().length, 0); assert.equal(db.objetos.size, 0)
  })
})

describe('el compita la ve solo mientras decide', () => {
  const montar = async (conFoto: boolean) => {
    const cmp = mkCompita({ telegram_chat_id: '9801' }); const c = mkCliente({ nombre: 'Carolina Pérez' })
    if (conFoto) await subir(c)
    const r = await pedir(c, cmp, { con_foto: conFoto })
    assert.equal(r.status, 200)
    return { cmp, c, sol: db.rows('solicitudes')[0] }
  }

  test('el aviso trae un botón con nuestro enlace, y la foto NO se manda por Telegram', async () => {
    const { sol } = await montar(true)
    assert.ok(sol.foto_cliente_id)
    const m = tgPara('9801').at(-1)!
    const url = (m.markup?.inline_keyboard ?? []).flat().find((b: any) => b.url)?.url
    assert.equal(url, `https://micompaz.test/api/solicitud-foto/${sol.token_respuesta}`)
    assert.ok(!JSON.stringify(m).includes('/storage/'), 'ningún enlace del almacenamiento sale en el aviso')
  })

  test('sin foto o sin elegirla no hay botón ni foto', async () => {
    const { sol } = await montar(false)
    assert.equal(sol.foto_cliente_id ?? null, null)
    assert.ok(!(tgPara('9801').at(-1)!.markup?.inline_keyboard ?? []).flat().some((b: any) => b.url))
    assert.equal((await ver(sol.token_respuesta)).status, 404)
  })

  test('con la solicitud pendiente se sirve, sin guardar en caché; ya decidida, no', async () => {
    const { sol } = await montar(true)
    const r = await ver(sol.token_respuesta)
    assert.equal(r.status, 200)
    assert.match(r.headers.get('Cache-Control')!, /no-store/)
    assert.equal(r.headers.get('Content-Type'), 'image/jpeg')
    db.rows('solicitudes')[0].estado = 'aceptada'
    assert.equal((await ver(sol.token_respuesta)).status, 404)
  })

  test('un enlace inventado no sirve nada', async () => {
    await montar(true)
    assert.equal((await ver('no-es-un-token')).status, 404)
    assert.equal((await ver('00000000-0000-0000-0000-000000000000')).status, 404)
  })

  test('si el cliente la quita después, el enlace deja de mostrarla', async () => {
    const { sol, c } = await montar(true)
    como(c); await fotoDelete()
    assert.equal((await ver(sol.token_respuesta)).status, 404)
  })

  test('si el cliente la reemplaza, el enlace muestra la actual', async () => {
    const { sol, c } = await montar(true)
    await subir(c, jpg(3000))
    assert.equal((await ver(sol.token_respuesta)).status, 200)
  })
})

describe('el borrado es real', () => {
  test('al vencer, la limpieza borra el archivo y el enlace queda sin foto', async () => {
    const cmp = mkCompita({ telegram_chat_id: '9801' }); const c = mkCliente()
    await subir(c); await pedir(c, cmp, { con_foto: true })
    const sol = db.rows('solicitudes')[0]
    activas()[0].borrar_en = new Date(Date.now() - 1000).toISOString()
    const r = await borrarFotosVencidas()
    assert.equal(r.borradas, 1); assert.equal(db.objetos.size, 0)
    assert.equal((await ver(sol.token_respuesta)).status, 404)
  })

  test('al eliminar la cuenta se borra la foto', async () => {
    const c = mkCliente(); await subir(c)
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    const r = await eliminar(req('/api/admin/eliminar-cliente', { method: 'DELETE', json: { usuario_id: c.id } }))
    assert.equal(r.status, 200)
    assert.equal(activas().length, 0); assert.equal(db.objetos.size, 0)
  })
})
