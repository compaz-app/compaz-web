/* eslint-disable */
import { db, net, limpiar, tgReq, tgText, tgBtn, tgFoto, ultimoTg, tgPara, emailsA, mkCompita, mkCliente, mkVisita, hoyVEstr } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'

beforeEach(limpiar)
const codigoDe = (to: string) => emailsA(to).at(-1)!.html.match(/>(\d{6})</)![1]

describe('Registro y vinculación de compita por Telegram', () => {
  test('flujo completo: /start → nombre → código por email → vinculada y admin avisado', async () => {
    const c = mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null, verificado: false })
    await webhook(tgText(500, '/start'))
    await webhook(tgText(500, 'ana gómez'))
    assert.equal(emailsA('ana@mail.test').length, 1)
    // Privacidad: Telegram nunca muestra el correo completo
    assert.ok(!ultimoTg(500)!.text.includes('ana@mail.test'), 'el email completo no debe mostrarse')
    assert.match(ultimoTg(500)!.text, /an\*+@mail\.test/)
    await webhook(tgText(500, codigoDe('ana@mail.test')))
    assert.equal(db.rows('compitas').find((r) => r.id === c.id)!.telegram_chat_id, '500')
    assert.ok(tgPara(999).some((m) => m.text.includes('Nueva Compita vinculada')))
  })

  test('código incorrecto 5 veces invalida el código', async () => {
    mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null })
    await webhook(tgText(501, '/start')); await webhook(tgText(501, 'Ana Gómez'))
    const bueno = codigoDe('ana@mail.test')
    const malo = bueno === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) await webhook(tgText(501, malo))
    assert.match(ultimoTg(501)!.text, /Demasiados intentos/)
    await webhook(tgText(501, bueno)) // ya no sirve: vuelve a pedir nombre
    assert.equal(db.rows('compitas')[0].telegram_chat_id, null)
  })

  test('cooldown: no se puede bombardear el correo de una compita con códigos', async () => {
    mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null })
    await webhook(tgText(502, '/start')); await webhook(tgText(502, 'Ana Gómez'))
    await webhook(tgText(502, 'x')); // un intento fallido
    // otro chat distinto intenta con el mismo nombre dentro del minuto
    await webhook(tgText(503, '/start')); await webhook(tgText(503, 'Ana Gómez'))
    assert.equal(emailsA('ana@mail.test').length, 1, 'solo un correo por minuto y compita')
    assert.match(ultimoTg(503)!.text, /Espera un minuto/)
  })

  test('los comodines % y _ no enumeran compitas', async () => {
    mkCompita({ nombre: 'Zoe Ramírez', email: 'zoe@mail.test', telegram_chat_id: null })
    await webhook(tgText(504, '/start')); await webhook(tgText(504, '%'))
    assert.match(ultimoTg(504)!.text, /No encontré ninguna cuenta/)
    assert.equal(emailsA('zoe@mail.test').length, 0)
  })

  test('si el correo del código falla, no se finge éxito', async () => {
    mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null })
    net.resendFail = true
    await webhook(tgText(505, '/start')); await webhook(tgText(505, 'Ana Gómez'))
    assert.match(ultimoTg(505)!.text, /No pudimos enviar el correo/)
  })

  test('update_id repetido (reintento de Telegram) se procesa una sola vez', async () => {
    mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null })
    const body = { update_id: 424242, message: { message_id: 1, from: { id: 506, first_name: 'x' }, chat: { id: 506, type: 'private' }, date: 0, text: '/start' } }
    const mk = () => import('./harness').then((h) => h.tgReq(body))
    await webhook(await mk()); const n = net.tg.length
    const r = await webhook(await mk())
    assert.equal(net.tg.length, n, 'el duplicado no genera mensajes')
    assert.equal((await r.json()).duplicado, true)
  })

  test('sin secreto de webhook → 401; con Telegram caído → nunca 5xx (evita reintentos infinitos)', async () => {
    const { req } = await import('./harness')
    const sin = await webhook(req('/api/telegram-webhook', { json: { update_id: 1 } }))
    assert.equal(sin.status, 401)
    mkCompita({ telegram_chat_id: '507' })
    net.tgFailAll = true
    const r = await webhook(tgText(507, '/menu'))
    assert.equal(r.status, 200)
  })
})

describe('Estados de la cuenta de compita', () => {
  test('compita sin verificar: puede /perfil pero no operar visitas', async () => {
    mkCompita({ telegram_chat_id: '510', verificado: false })
    await webhook(tgText(510, '/perfil'))
    assert.match(ultimoTg(510)!.text, /compita\/perfil\?token=/)
    await webhook(tgText(510, '▶️ Iniciar visita'))
    assert.match(ultimoTg(510)!.text, /en revisión/)
  })

  test('compita bloqueada: no puede hacer nada, ni siquiera /perfil', async () => {
    mkCompita({ telegram_chat_id: '511', estado: 'bloqueado', verificado: false })
    for (const t of ['/perfil', '/menu', '▶️ Iniciar visita', 'hola']) {
      net.tg = []
      await webhook(tgText(511, t))
      assert.match(ultimoTg(511)!.text, /suspendida/, t)
    }
    assert.equal(db.rows('compita_edit_tokens').length, 0)
  })

  test('mensajes no soportados (voz/doc) avisan en vez de perderse en silencio', async () => {
    const c = mkCompita({ telegram_chat_id: '512' }); const u = mkCliente()
    mkVisita(u, c, { estado: 'en_curso', inicio: new Date().toISOString() })
    await webhook(tgReq({ message: { message_id: 1, from: { id: 512, first_name: 'x' }, chat: { id: 512, type: 'private' }, date: 0, document: { file_id: 'D' } } }))
    assert.match(ultimoTg(512)!.text, /solo puedo reenviar/i)
  })
})
