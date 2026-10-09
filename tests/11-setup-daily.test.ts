/* eslint-disable */
import { net, session, limpiar, req } from './harness'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { GET as setupDaily } from '@/app/api/setup-daily-webhook/route'

beforeEach(() => { limpiar(); (net as any).dailyWebhooks = []; (net as any).dailyWebhookFail = false })

test('solo admin puede registrar el webhook de Daily', async () => {
  session.user = { id: 'c', email: 'cliente@mail.test' }
  assert.equal((await setupDaily(req('/api/setup-daily-webhook'))).status, 401)
})

test('registra meeting.ended con HMAC, reemplaza duplicados de la misma URL y no devuelve el secreto', async () => {
  session.user = { id: 'a', email: 'admin@compaz.test' }
  ;(net as any).dailyWebhooks.push({ uuid: 'viejo', url: 'https://micompaz.test/api/webhooks/daily' }, { uuid: 'otro', url: 'https://otro.test/x' })
  const r = await setupDaily(req('/api/setup-daily-webhook'))
  assert.equal(r.status, 200)
  const txt = await r.text()
  assert.ok(!txt.includes(process.env.DAILY_WEBHOOK_SECRET!), 'el secreto no sale en la respuesta')
  assert.equal(JSON.parse(txt).data.eliminados, 1)
  const hooks = (net as any).dailyWebhooks
  assert.equal(hooks.length, 2)
  const nuevo = hooks.find((h: any) => h.eventTypes)
  assert.deepEqual(nuevo.eventTypes, ['meeting.ended']); assert.equal(nuevo.hmac, process.env.DAILY_WEBHOOK_SECRET)
})

test('sin secreto configurado explica cómo generarlo; si Daily rechaza, se informa', async () => {
  session.user = { id: 'a', email: 'admin@compaz.test' }
  const guardado = process.env.DAILY_WEBHOOK_SECRET; delete process.env.DAILY_WEBHOOK_SECRET
  const r = await setupDaily(req('/api/setup-daily-webhook')); assert.equal(r.status, 400)
  assert.match((await r.json()).error, /openssl rand -base64 32/)
  process.env.DAILY_WEBHOOK_SECRET = guardado
  ;(net as any).dailyWebhookFail = true
  assert.equal((await setupDaily(req('/api/setup-daily-webhook'))).status, 502)
})
