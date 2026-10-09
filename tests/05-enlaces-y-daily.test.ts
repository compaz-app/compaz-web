/* eslint-disable */
import { db, net, limpiar, req, cron, tgPara, emailsA, ahoraMas, firmaDaily, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { qRol, firmaRol, tokenRating } from '@/lib/links'
import { POST as dailyWebhook } from '@/app/api/webhooks/daily/route'
import { POST as reconectar } from '@/app/api/solicitud/reconectar-llamada/route'
import { GET as confGet, POST as confPost } from '@/app/api/solicitud/confirmacion-llamada/route'
import { GET as resGet, POST as resPost } from '@/app/api/solicitud/resultado-llamada/route'
import { GET as segGet, POST as segPost } from '@/app/api/solicitud/seguimiento/route'
import { GET as ratGet, POST as ratPost } from '@/app/api/visita/rating/route'
import { GET as respGet, POST as respPost } from '@/app/api/solicitud/responder/route'
import { GET as reagGet, POST as reagPost } from '@/app/api/solicitud/reagendar-compita/route'
import { POST as proponer } from '@/app/api/solicitud/proponer-reagendado/route'
import { POST as seguimientoCron } from '@/app/api/cron/seguimiento/route'

beforeEach(limpiar)
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const mundo = (o: any = {}) => {
  const compita = mkCompita({ telegram_chat_id: '800', nombre: 'Lucía' }); const cli = mkCliente({ email: 'cli@mail.test', nombre: 'Carlos' })
  const sol = mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: hace(25), room_url: 'https://compaz.daily.co/ent-abc-1', ...o })
  return { compita, cli, sol, t: sol.token_respuesta as string }
}
const solRow = () => db.rows('solicitudes')[0]
const esForm = async (r: Response) => { const h = await r.text(); return /<form method="POST"/.test(h) }
const url = (path: string, t: string, rol: 'cliente' | 'compita', extra = '') => `/api/solicitud/${path}?token=${t}${extra}&${qRol(t, rol)}`

const eventoDaily = (duration: number, room = 'ent-abc-1', headers?: any) => {
  const body = JSON.stringify({ event_type: 'meeting.ended', payload: { room_name: room, room_url: `https://compaz.daily.co/${room}`, duration } })
  return req('/api/webhooks/daily', { body, headers: { 'content-type': 'application/json', ...(headers ?? firmaDaily(body)) } })
}

describe('Webhook de Daily (fin de llamada)', () => {
  test('firma: HMAC válida OK; sin firma, firma mala o timestamp viejo → 401', async () => {
    mundo()
    assert.equal((await dailyWebhook(req('/api/webhooks/daily', { body: '{}', headers: { 'content-type': 'application/json' } }))).status, 401)
    assert.equal((await dailyWebhook(eventoDaily(600, 'ent-abc-1', { 'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)), 'x-webhook-signature': 'AAAA' }))).status, 401)
    const body = JSON.stringify({ event_type: 'meeting.ended', payload: {} })
    const viejo = firmaDaily(body, Math.floor(Date.now() / 1000) - 3600)
    assert.equal((await dailyWebhook(req('/api/webhooks/daily', { body, headers: { 'content-type': 'application/json', ...viejo } }))).status, 401)
    assert.equal((await dailyWebhook(eventoDaily(600))).status, 200)
  })

  test('llamada normal: un solo correo de decisión; reintentos de Daily no duplican; el cron no repite', async () => {
    const { t } = mundo()
    await dailyWebhook(eventoDaily(900)); await dailyWebhook(eventoDaily(900)); await dailyWebhook(eventoDaily(900))
    const mails = emailsA('cli@mail.test')
    assert.equal(mails.length, 1)
    assert.match(mails[0].html, new RegExp(`resultado=no_contratar&amp;quien=cliente&amp;s=|resultado=no_contratar&quien=cliente&s=`))
    assert.equal(tgPara(800).length, 1)
    assert.equal(solRow().seguimiento_enviado, true)
    // El cron de seguimiento no debe volver a preguntar lo mismo ni mandar el "¿ocurrió?"
    await seguimientoCron(cron('s')); await seguimientoCron(cron('s'))
    assert.equal(emailsA('cli@mail.test').length, 1)
    void t
  })

  test('llamada muy corta: no ofrece contratar y la compita recibe botones firmados', async () => {
    mundo()
    await dailyWebhook(eventoDaily(60))
    assert.ok(!emailsA('cli@mail.test')[0].html.includes('Sí, quiero contratar'))
    const urls = tgPara(800)[0].markup.inline_keyboard.flat().map((b: any) => b.url)
    assert.ok(urls.every((u: string) => /quien=compita&s=[0-9a-f]{24}/.test(u)))
    assert.equal(solRow().seguimiento_enviado, false)
  })

  test('sala vacía (duración 0): solo alerta al admin', async () => {
    mundo()
    await dailyWebhook(eventoDaily(0))
    assert.equal(net.emails.length, 0)
    assert.ok(tgPara(999).some((m) => m.text.includes('sin participantes')))
  })

  test('Resend caído en el webhook: el admin es avisado de que debe reenviar', async () => {
    mundo(); net.resendFail = true
    await dailyWebhook(eventoDaily(900))
    assert.ok(tgPara(999).some((m) => m.text.includes('No se pudo enviar el correo post-llamada')))
  })

  test('evento de otra sala (no "ent-") o de otro tipo se ignora', async () => {
    mundo()
    await dailyWebhook(eventoDaily(900, 'cmp-otra'))
    assert.equal(net.emails.length, 0)
  })
})

describe('Reconectar llamada', () => {
  test('con firma crea sala nueva, resetea flags y el siguiente fin de llamada vuelve a disparar el flujo', async () => {
    const { t } = mundo({ confirmacion_llamada_enviada: true, seguimiento_enviado: true, slot_confirmado: hace(10) })
    const r = await reconectar(req(url('reconectar-llamada', t, 'cliente'), { method: 'POST' }))
    assert.equal(r.status, 200)
    assert.equal(net.rooms.length, 1)
    assert.equal(solRow().confirmacion_llamada_enviada, false)
    assert.ok(tgPara(800).some((m) => m.text.includes('La llamada se cayó')))
    // cooldown inmediato
    assert.equal((await reconectar(req(url('reconectar-llamada', t, 'cliente'), { method: 'POST' }))).status, 429)
    assert.equal(net.rooms.length, 1, 'el cooldown evita crear salas sin límite')
    // el nuevo meeting.ended sí procesa
    const nuevaUrl = solRow().room_url as string
    const body = JSON.stringify({ event_type: 'meeting.ended', payload: { room_name: 'ent-nueva', room_url: nuevaUrl, duration: 700 } })
    await dailyWebhook(req('/api/webhooks/daily', { body, headers: { 'content-type': 'application/json', ...firmaDaily(body) } }))
    assert.equal(emailsA('cli@mail.test').length, 1)
  })

  test('sin firma, firma de otro rol, estado inválido u hora lejana → rechazado', async () => {
    const { t } = mundo()
    assert.equal((await reconectar(req(`/api/solicitud/reconectar-llamada?token=${t}&quien=cliente`, { method: 'POST' }))).status, 400)
    assert.equal((await reconectar(req(`/api/solicitud/reconectar-llamada?token=${t}&quien=compita&s=${firmaRol(t, 'cliente')}`, { method: 'POST' }))).status, 400)
    solRow().slot_confirmado = ahoraMas(60 * 24 * 3)
    assert.equal((await reconectar(req(url('reconectar-llamada', t, 'cliente'), { method: 'POST' }))).status, 409)
    solRow().slot_confirmado = hace(5); solRow().estado = 'pendiente'
    assert.equal((await reconectar(req(url('reconectar-llamada', t, 'cliente'), { method: 'POST' }))).status, 409)
    assert.equal(net.rooms.length, 0)
  })
})

describe('Enlaces de correo/Telegram: GET no cambia estado (escáneres), POST sí; roles firmados', () => {
  test('confirmacion-llamada', async () => {
    const { t } = mundo()
    const u = url('confirmacion-llamada', t, 'cliente', '&respuesta=si')
    assert.ok(await esForm(await confGet(req(u))))
    assert.equal(solRow().confirmacion_cliente, null, 'el GET (escáner) no registra nada')
    // sin firma / rol falsificado
    assert.equal((await confGet(req(`/api/solicitud/confirmacion-llamada?token=${t}&quien=cliente&respuesta=si`))).status, 400)
    assert.equal((await confPost(req(`/api/solicitud/confirmacion-llamada?token=${t}&quien=compita&respuesta=si&s=${firmaRol(t, 'cliente')}`, { method: 'POST' }))).status, 400)
    assert.equal(solRow().confirmacion_compita, null, 'el cliente no puede responder por la compita')
    await confPost(req(u, { method: 'POST' }))
    assert.equal(solRow().confirmacion_cliente, true)
  })

  test('confirmacion-llamada "no": avisa al admin y manda al cliente a reagendar; nombre con XSS escapado en la página', async () => {
    const { t } = mundo()
    solRow().compita_id // noop
    db.rows('compitas')[0].nombre = '<img src=x onerror=alert(1)>'
    const r = await confPost(req(url('confirmacion-llamada', t, 'cliente', '&respuesta=no'), { method: 'POST' }))
    assert.equal(r.status, 303)
    assert.match(r.headers.get('location')!, new RegExp(`/reagendar/${t}`))
    assert.ok(tgPara(999).some((m) => m.text.includes('Llamada no ocurrió')))
    const rc = await confPost(req(url('confirmacion-llamada', t, 'compita', '&respuesta=si'), { method: 'POST' }))
    const html = await rc.text()
    assert.ok(!html.includes('<img src=x'), 'la página no refleja HTML del nombre')
  })

  test('resultado-llamada: no_contratar muta solo con firma y POST; contratar solo redirige', async () => {
    const { t } = mundo()
    const noU = url('resultado-llamada', t, 'cliente', '&resultado=no_contratar')
    assert.ok(await esForm(await resGet(req(noU))))
    assert.equal(solRow().estado, 'aceptada')
    assert.equal((await resGet(req(`/api/solicitud/resultado-llamada?token=${t}&resultado=no_contratar`))).status, 400)
    const c = await resGet(req(`/api/solicitud/resultado-llamada?token=${t}&resultado=contratar`))
    assert.equal(c.status, 303); assert.match(c.headers.get('location')!, /\/pago\?solicitud=/)
    assert.equal(solRow().estado, 'aceptada')
    await resPost(req(noU, { method: 'POST' })); await resPost(req(noU, { method: 'POST' }))
    assert.equal(solRow().estado, 'rechazada')
    assert.equal(tgPara(800).filter((m) => m.text.includes('Gracias por tu dedicación')).length, 1, 'la compita recibe el mensaje una sola vez')
  })

  test('resultado-llamada: el cliente no puede marcar "bien" haciéndose pasar por la compita', async () => {
    const { t } = mundo()
    const falso = `/api/solicitud/resultado-llamada?token=${t}&resultado=bien&quien=compita&s=${firmaRol(t, 'cliente')}`
    assert.equal((await resPost(req(falso, { method: 'POST' }))).status, 400)
    assert.equal(solRow().estado, 'aceptada')
    await resPost(req(url('resultado-llamada', t, 'compita', '&resultado=bien'), { method: 'POST' }))
    assert.equal(solRow().estado, 'completada')
  })

  test('seguimiento: "sí" redirige al pago sin mutar; "no" requiere POST firmado y es idempotente', async () => {
    const { t } = mundo()
    const si = await segGet(req(`/api/solicitud/seguimiento?token=${t}&respuesta=si`))
    assert.equal(si.status, 302); assert.match(si.headers.get('location')!, /\/pago\?solicitud=/)
    const noU = url('seguimiento', t, 'cliente', '&respuesta=no')
    assert.ok(await esForm(await segGet(req(noU))))
    assert.equal(solRow().estado, 'aceptada')
    await segPost(req(noU, { method: 'POST' })); await segPost(req(noU, { method: 'POST' }))
    assert.equal(solRow().estado, 'rechazada')
    assert.equal(tgPara(800).length, 1, 'el mensaje a la compita no se repite')
    assert.equal(db.rows('compita_edit_tokens').length, 1, 'un solo token de perfil (no invalida el de la compita en cada clic)')
  })

  test('rating: GET no califica; POST una vez; 5 enlaces disparados en paralelo (escáner) solo cuentan uno', async () => {
    const compita = mkCompita(); const cli = mkCliente()
    const v = db.seed('visitas', { usuario_id: cli.id, compita_id: compita.id, estado: 'terminada' })
    const link = (n: number) => `/api/visita/rating?visita_id=${v.id}&valor=${n}&t=${tokenRating(v.id, n)}`
    assert.ok(await esForm(await ratGet(req(link(1)))))
    assert.equal(v.rating_cliente ?? null, null)
    assert.equal((await ratPost(req(`/api/visita/rating?visita_id=${v.id}&valor=5&t=${tokenRating(v.id, 1)}`, { method: 'POST' }))).status, 400, 'no se puede subir la nota reusando la firma de otra')
    await Promise.all([1, 2, 3, 4, 5].map((n) => ratPost(req(link(n), { method: 'POST' }))))
    assert.ok([1, 2, 3, 4, 5].includes(v.rating_cliente))
    const guardado = v.rating_cliente
    await ratPost(req(link(2), { method: 'POST' }))
    assert.equal(v.rating_cliente, guardado, 'una vez calificada no cambia')
    assert.equal(db.rows('compitas').find((c) => c.id === compita.id)!.total_ratings, 1)
  })

  test('responder (botones URL del reagendado): requiere firma de compita', async () => {
    const { t } = mundo({ estado: 'pendiente', slot_confirmado: null, slots_propuestos: [ahoraMas(100), ahoraMas(200)] })
    assert.equal((await respGet(req(`/api/solicitud/responder?token=${t}&slot=0&quien=compita&s=${firmaRol(t, 'cliente')}`))).status, 400)
    const u = url('responder', t, 'compita', '&slot=0')
    assert.ok(await esForm(await respGet(req(u))))
    assert.equal(solRow().estado, 'pendiente')
    await respPost(req(u, { method: 'POST' }))
    assert.equal(solRow().estado, 'aceptada')
    assert.match(emailsA('cli@mail.test')[0].html, new RegExp(`/reagendar/${t}`))
  })

  test('reagendar-compita: gate + POST inicia el reagendado una sola vez', async () => {
    const { t } = mundo()
    const u = url('reagendar-compita', t, 'compita')
    assert.ok(await esForm(await reagGet(req(u))))
    assert.equal(solRow().estado, 'aceptada')
    assert.equal((await reagPost(req(`/api/solicitud/reagendar-compita?token=${t}&quien=compita`, { method: 'POST' }))).status, 400)
    await reagPost(req(u, { method: 'POST' }))
    assert.equal(solRow().estado, 'rechazada'); assert.equal(solRow().slot_confirmado, null)
    assert.equal((await reagPost(req(u, { method: 'POST' }))).status, 410)
    assert.ok(db.rows('telegram_estados').some((e) => e.pendiente_accion?.startsWith('sugerir_r:')))
  })

  test('proponer-reagendado: valida slots y notifica con enlaces firmados', async () => {
    const { t } = mundo({ estado: 'rechazada', slot_confirmado: null })
    const mal = await proponer(req('/api/solicitud/proponer-reagendado', { json: { token: t, slots: ['no-fecha'] } }))
    assert.equal(mal.status, 400)
    const ok = await proponer(req('/api/solicitud/proponer-reagendado', { json: { token: t, slots: [ahoraMas(120), ahoraMas(120), ahoraMas(300)] } }))
    assert.equal(ok.status, 200)
    assert.equal(solRow().estado, 'pendiente'); assert.equal(solRow().slots_propuestos.length, 2, 'slots duplicados se descartan')
    const urls = tgPara(800)[0].markup.inline_keyboard.flat().map((b: any) => b.url)
    assert.ok(urls.every((u: string) => /quien=compita&s=[0-9a-f]{24}/.test(u)))
    solRow().estado = 'contratada'
    assert.equal((await proponer(req('/api/solicitud/proponer-reagendado', { json: { token: t, slots: [ahoraMas(200)] } }))).status, 400)
  })
})
