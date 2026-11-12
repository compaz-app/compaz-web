// Fotos privadas: se copian a un bucket propio, se sirven con enlaces firmados, se borran DE VERDAD al vencer el
// plazo (archivo y marca) y la limpieza diaria lo ejecuta. Telegram no puede borrar sus archivos, por eso la copia.
import { db, net, limpiar, cron, mkCompita, mkCliente, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  BUCKET_FOTOS, guardarFotoPrivada, copiarFotoDeTelegram, urlFirmadaFoto, programarBorradoVisita, borrarFotosVencidas,
} from '@/lib/fotos-privadas'
import { limpiarCacheAjustes, setAjuste } from '@/lib/ajustes'
import { POST as limpieza } from '@/app/api/cron/limpieza/route'

beforeEach(() => { limpiar(); limpiarCacheAjustes() })

const DIA = 86_400_000
const AHORA = new Date('2026-11-09T15:00:00.000Z')
const bytes = (n = 1200) => new Uint8Array(n).buffer
const guardada = async (extra: Record<string, unknown> = {}) => {
  const r = await guardarFotoPrivada({ tipo: 'llegada', bytes: bytes(), contentType: 'image/jpeg', ahora: AHORA, ...extra } as never)
  assert.ok(r, 'la foto debe guardarse')
  return r!
}
const objetos = () => [...db.objetos.keys()]

describe('guardar', () => {
  test('sube el archivo al bucket privado y registra la fecha de borrado a 90 días', async () => {
    const vis = mkVisita(mkCliente(), mkCompita(), { estado: 'en_curso' })
    const { id } = await guardada({ visitaId: vis.id })
    const f = db.rows('fotos_privadas')[0]
    assert.equal(f.id, id); assert.equal(f.tipo, 'llegada'); assert.equal(f.visita_id, vis.id)
    assert.match(f.ruta, /^llegada\/[0-9a-f-]{36}\.jpg$/)
    assert.deepEqual(objetos(), [`${BUCKET_FOTOS}/${f.ruta}`])
    assert.equal(new Date(f.borrar_en).getTime() - AHORA.getTime(), 90 * DIA)
    assert.equal(f.borrada_en, null)
  })

  test('el plazo sale de Ajustes: con 30 días la foto vence a los 30', async () => {
    await setAjuste({ clave: 'foto_retencion_dias', valor: 30, actor: 'admin:a' })
    await guardada()
    assert.equal(new Date(db.rows('fotos_privadas')[0].borrar_en).getTime() - AHORA.getTime(), 30 * DIA)
  })

  test('rechaza tipos de archivo no permitidos, vacíos y demasiado grandes sin guardar nada', async () => {
    for (const [b, ct] of [[bytes(), 'application/pdf'], [bytes(), 'image/svg+xml'], [bytes(0), 'image/jpeg'], [bytes(9 * 1024 * 1024), 'image/jpeg']] as const) {
      assert.equal(await guardarFotoPrivada({ tipo: 'cliente', bytes: b, contentType: ct }), null, ct)
    }
    assert.equal(db.rows('fotos_privadas').length, 0); assert.equal(objetos().length, 0)
  })

  test('si falla la subida no queda ninguna fila', async () => {
    db.fail['storage:upload'] = 1
    assert.equal(await guardarFotoPrivada({ tipo: 'cliente', bytes: bytes(), contentType: 'image/png' }), null)
    assert.equal(db.rows('fotos_privadas').length, 0)
  })

  test('si falla el registro se retira el archivo: nunca queda una foto sin fecha de borrado', async () => {
    db.fail['fotos_privadas:insert'] = 1
    assert.equal(await guardarFotoPrivada({ tipo: 'cliente', bytes: bytes(), contentType: 'image/png' }), null)
    assert.equal(objetos().length, 0, 'el archivo huérfano se borró')
  })
})

describe('copiar desde Telegram', () => {
  test('descarga la foto, la guarda en el bucket y NO conserva el file_id ni la URL con el token del bot', async () => {
    const r = await copiarFotoDeTelegram('AgACAgEAAxkBfile', { tipo: 'llegada', ahora: AHORA })
    assert.ok(r); assert.equal(net.fotosDescargadas, 1)
    const volcado = JSON.stringify(db.rows('fotos_privadas')) + JSON.stringify(db.rows('eventos')) + objetos().join()
    assert.ok(!volcado.includes('AgACAgEAAxkBfile'), 'el file_id no se guarda')
    assert.ok(!volcado.includes('TESTBOTTOKEN'), 'el token del bot no aparece')
    assert.ok(!volcado.includes('tg:'))
  })
})

describe('enlace firmado', () => {
  test('devuelve un enlace firmado de vida corta, sin el token del bot', async () => {
    const { id } = await guardada()
    const url = await urlFirmadaFoto(id, 120)
    assert.ok(url && url.includes('/object/sign/') && url.includes('exp=120'))
    assert.ok(!url!.includes('TESTBOTTOKEN'))
  })
  test('null si la foto no existe o ya fue borrada', async () => {
    assert.equal(await urlFirmadaFoto('00000000-0000-4000-8000-000000000000'), null)
    const { id } = await guardada()
    await borrarFotosVencidas(new Date(AHORA.getTime() + 91 * DIA))
    assert.equal(await urlFirmadaFoto(id), null)
  })
})

describe('retención y borrado real', () => {
  test('borra solo las vencidas: archivo, marca borrada_en y evento foto_borrada; las vigentes quedan', async () => {
    const c = mkCompita(); const u = mkCliente(); const vis = mkVisita(u, c, { estado: 'terminada' })
    const vieja = await guardada({ visitaId: vis.id })
    const nueva = await guardarFotoPrivada({ tipo: 'llegada', bytes: bytes(), contentType: 'image/jpeg', visitaId: vis.id, ahora: new Date(AHORA.getTime() + 60 * DIA) })
    const r = await borrarFotosVencidas(new Date(AHORA.getTime() + 91 * DIA))
    assert.deepEqual(r, { borradas: 1, fallos: 0 })
    const filas = db.rows('fotos_privadas')
    assert.ok(filas.find((f) => f.id === vieja.id)!.borrada_en)
    assert.equal(filas.find((f) => f.id === nueva!.id)!.borrada_en, null)
    assert.equal(objetos().length, 1, 'solo queda la vigente')
    const e = db.rows('eventos').filter((x) => x.tipo === 'foto_borrada')
    assert.equal(e.length, 1); assert.equal(e[0].entidad, 'visita'); assert.equal(e[0].entidad_id, vis.id); assert.deepEqual(e[0].datos, { tipo: 'llegada' })
  })

  test('es idempotente: una segunda corrida no vuelve a borrar ni a registrar eventos', async () => {
    await guardada({ visitaId: mkVisita(mkCliente(), mkCompita(), {}).id })
    const futuro = new Date(AHORA.getTime() + 91 * DIA)
    assert.equal((await borrarFotosVencidas(futuro)).borradas, 1)
    assert.deepEqual(await borrarFotosVencidas(futuro), { borradas: 0, fallos: 0 })
    assert.equal(db.rows('eventos').filter((x) => x.tipo === 'foto_borrada').length, 1)
  })

  test('si no se puede borrar el archivo NO se marca como borrada y se reintenta después', async () => {
    const { id } = await guardada()
    db.fail['storage:remove'] = 1
    const futuro = new Date(AHORA.getTime() + 91 * DIA)
    assert.deepEqual(await borrarFotosVencidas(futuro), { borradas: 0, fallos: 1 })
    assert.equal(db.rows('fotos_privadas').find((f) => f.id === id)!.borrada_en, null)
    assert.equal(objetos().length, 1)
    assert.deepEqual(await borrarFotosVencidas(futuro), { borradas: 1, fallos: 0 }, 'el reintento sí la borra')
  })

  test('la fecha de las fotos de llegada se cuenta desde que se CIERRA la visita, no desde que se tomaron', async () => {
    const vis = mkVisita(mkCliente(), mkCompita(), {}); const otra = mkVisita(mkCliente(), mkCompita(), {})
    const llegada = await guardada({ visitaId: vis.id })
    const deOtra = await guardada({ visitaId: otra.id })
    const cliente = await guardarFotoPrivada({ tipo: 'cliente', bytes: bytes(), contentType: 'image/jpeg', visitaId: vis.id, ahora: AHORA })
    const cierre = new Date(AHORA.getTime() + 20 * DIA)
    assert.equal(await programarBorradoVisita(vis.id, cierre), true)
    const f = (id: string) => db.rows('fotos_privadas').find((x) => x.id === id)!
    assert.equal(new Date(f(llegada.id).borrar_en).getTime(), cierre.getTime() + 90 * DIA)
    assert.equal(new Date(f(deOtra.id).borrar_en).getTime(), AHORA.getTime() + 90 * DIA, 'no toca fotos de otra visita')
    assert.equal(new Date(f(cliente!.id).borrar_en).getTime(), AHORA.getTime() + 90 * DIA, 'no toca fotos que no son de llegada')
  })
})

describe('limpieza diaria', () => {
  test('borra las fotos vencidas y responde bien; sin fotos vencidas no cambia nada', async () => {
    const vigente = await guardarFotoPrivada({ tipo: 'cliente', bytes: bytes(), contentType: 'image/jpeg' })
    const vencida = await guardarFotoPrivada({ tipo: 'cliente', bytes: bytes(), contentType: 'image/jpeg' })
    db.rows('fotos_privadas').find((f) => f.id === vencida!.id)!.borrar_en = new Date(Date.now() - DIA).toISOString()
    const r = await limpieza(cron('l'))
    assert.equal(r.status, 200)
    assert.ok(db.rows('fotos_privadas').find((f) => f.id === vencida!.id)!.borrada_en)
    assert.equal(db.rows('fotos_privadas').find((f) => f.id === vigente!.id)!.borrada_en, null)
    assert.equal(objetos().length, 1)
  })

  test('si borrar una foto falla, la limpieza lo dice (500) en vez de pasar en silencio', async () => {
    const v = await guardarFotoPrivada({ tipo: 'cliente', bytes: bytes(), contentType: 'image/jpeg' })
    db.rows('fotos_privadas').find((f) => f.id === v!.id)!.borrar_en = new Date(Date.now() - DIA).toISOString()
    db.fail['storage:remove'] = 1
    const r = await limpieza(cron('l'))
    assert.equal(r.status, 500)
    assert.match(JSON.stringify(await r.json()), /fotos privadas/)
  })

  test('la retención de avisos sale de Ajustes: con 30 días se borra un aviso enviado de 40 días', async () => {
    const hace = (d: number) => new Date(Date.now() - d * DIA).toISOString()
    db.seed('avisos', { destinatario_tipo: 'admin', canal: 'telegram', plantilla: 'x', estado: 'enviado', creado_en: hace(40) })
    await limpieza(cron('l'))
    assert.equal(db.rows('avisos').length, 1, 'con 90 días por defecto se conserva')
    await setAjuste({ clave: 'avisos_retencion_dias', valor: 30, actor: 'admin:a' })
    await limpieza(cron('l'))
    assert.equal(db.rows('avisos').length, 0)
  })
})
