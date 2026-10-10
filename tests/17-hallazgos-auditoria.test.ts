/* eslint-disable */
import { db, net, limpiar, tgText, ultimoTg, tgPara, emailsA, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { rutaInterna } from '@/lib/html'
import { getSolicitudPorToken } from '@/lib/solicitudes'

beforeEach(limpiar)

describe('Hallazgos de la auditoría Cloudflare (corrida 1)', () => {
  test('código de vinculación: los fallos se acumulan por compita, no por chat, y bloquean (media)', async () => {
    const c = mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null })
    for (let ronda = 0; ronda < 2; ronda++) {
      // saltar el enfriamiento de 1 minuto entre rondas
      for (const r of db.rows('telegram_estados')) if (String(r.chat_id).startsWith('cod:')) r.updated_at = new Date(Date.now() - 120_000).toISOString()
      await webhook(tgText(700, '/start')); await webhook(tgText(700, 'Ana Gómez'))
      for (let i = 0; i < 5; i++) await webhook(tgText(700, 'xxxxxx'))
    }
    assert.ok(tgPara(999).some((m) => m.text.includes('Posible intento de suplantar')), 'el admin recibe el aviso')
    const antes = emailsA('ana@mail.test').length
    for (const r of db.rows('telegram_estados')) if (String(r.chat_id).startsWith('cod:')) r.updated_at = new Date(Date.now() - 120_000).toISOString()
    // otro chat distinto no puede pedir más códigos para esa compita
    await webhook(tgText(701, '/start')); await webhook(tgText(701, 'Ana Gómez'))
    assert.equal(emailsA('ana@mail.test').length, antes, 'no se envían más códigos')
    assert.match(ultimoTg(701)!.text, /bloqueada temporalmente/)
    assert.equal(db.rows('compitas').find((r) => r.id === c.id)!.telegram_chat_id, null)
  })

  test('una compita ya vinculada no se puede re-vincular desde otro chat', async () => {
    mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: '800' })
    await webhook(tgText(702, '/start')); await webhook(tgText(702, 'Ana Gómez'))
    assert.equal(emailsA('ana@mail.test').length, 0, 'ni siquiera se envía código')
    assert.match(ultimoTg(702)!.text, /ya está vinculada/)
    assert.equal(db.rows('compitas')[0].telegram_chat_id, '800')
  })

  test('redirección abierta: /%09/evil.com y caracteres de control se rechazan', () => {
    assert.equal(rutaInterna('/\t/evil.com'), '/dashboard')
    assert.equal(rutaInterna('/\n/evil.com'), '/dashboard')
    assert.equal(rutaInterna('//evil.com'), '/dashboard')
    assert.equal(rutaInterna('/dashboard?x=1'), '/dashboard?x=1')
  })

  test('los enlaces de una solicitud no valen si el cliente o la compita fueron bloqueados', async () => {
    const compita = mkCompita(); const cli = mkCliente()
    const sol = mkSolicitud(cli, compita, { token_respuesta: 'tok-1' })
    assert.ok(await getSolicitudPorToken('tok-1'))
    db.rows('usuarios').find((u) => u.id === cli.id)!.plan = 'bloqueado'
    assert.equal(await getSolicitudPorToken('tok-1'), null)
    db.rows('usuarios').find((u) => u.id === cli.id)!.plan = null
    db.rows('compitas').find((c) => c.id === compita.id)!.estado = 'bloqueado'
    assert.equal(await getSolicitudPorToken('tok-1'), null)
  })
})
