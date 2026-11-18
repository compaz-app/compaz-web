/* eslint-disable */
// El compita responde «¿cómo estuvo la llamada?» con un toque en Telegram: se queda en Telegram (sin página web ni «Ir a mi portal») y, si dice que no se pudo,
// el cliente recibe el aviso con su enlace directo para reagendar.
import { db, net, limpiar, tgBtn, tgPara, emailsA, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'

beforeEach(limpiar)
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const armar = () => {
  const compita = mkCompita({ telegram_chat_id: '710' }); const cli = mkCliente({ email: 'cli@mail.test' })
  const sol = mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: hace(30), token_respuesta: 'tok-123' })
  return { compita, cli, sol }
}

describe('toque del compita en Telegram', () => {
  test('«No se pudo»: queda registrado, el cliente recibe el correo con su enlace para reagendar y el compita recibe la respuesta en Telegram sin ningún enlace web', async () => {
    const { sol } = armar()
    await webhook(tgBtn(710, `ll:no:${sol.id}`))
    assert.equal(db.rows('solicitudes').find((s: any) => s.id === sol.id)!.confirmacion_compita, false)
    const mails = emailsA('cli@mail.test'); assert.equal(mails.length, 1, 'el cliente recibe UN correo')
    assert.match(mails[0].html, /\/reagendar\/tok-123/)
    const respuesta = tgPara(710).at(-1)!; assert.match(respuesta.text, /enlace|horarios/i); assert.doesNotMatch(JSON.stringify(respuesta), /dashboard|portal|https?:\/\//i)
  })
  test('«Sí, ocurrió»: queda registrado y no se avisa al cliente', async () => {
    const { sol } = armar()
    await webhook(tgBtn(710, `ll:si:${sol.id}`))
    assert.equal(db.rows('solicitudes').find((s: any) => s.id === sol.id)!.confirmacion_compita, true); assert.equal(emailsA('cli@mail.test').length, 0)
  })
  test('solo la compita de ESA solicitud puede responder (otra compita no cambia nada)', async () => {
    const { sol } = armar(); mkCompita({ telegram_chat_id: '999' })
    await webhook(tgBtn(999, `ll:no:${sol.id}`))
    assert.equal(db.rows('solicitudes').find((s: any) => s.id === sol.id)!.confirmacion_compita ?? null, null); assert.equal(emailsA('cli@mail.test').length, 0)
  })
  test('un segundo toque no vuelve a avisar al cliente', async () => {
    const { sol } = armar()
    await webhook(tgBtn(710, `ll:no:${sol.id}`)); await webhook(tgBtn(710, `ll:no:${sol.id}`))
    assert.equal(emailsA('cli@mail.test').length, 1)
  })
})

import { botonDe } from '@/lib/confirm'
import { qRol } from '@/lib/links'
import { POST as confirmacion } from '@/app/api/solicitud/confirmacion-llamada/route'
import { POST as reagendarCliente } from '@/app/api/solicitud/reagendar-cliente/route'
import { POST as seguimiento } from '@/app/api/cron/seguimiento/route'
import { req, cron } from './harness'

describe('el cliente se entera, y por el camino más corto', () => {
  test('el aviso llega también al portal (campana) con un enlace directo a reagendar', async () => {
    const { sol, cli } = armar()
    await webhook(tgBtn(710, `ll:no:${sol.id}`))
    const n = db.rows('novedades_cliente').find((x: any) => x.usuario_id === cli.id)!
    assert.equal(n.tipo, 'llamada_no_ocurrio'); assert.equal(n.ruta, '/reagendar/tok-123'); assert.match(n.titulo, /no se pudo/)
  })
  test('el correo «¿Pudiste hablar?» lleva «No se pudo» DIRECTO a elegir otra hora, sin la página intermedia de confirmación', async () => {
    const { compita, cli } = armar(); void compita; void cli
    await seguimiento(cron('s'))
    const html = emailsA('cli@mail.test')[0].html
    assert.match(html, /href="[^"]*\/reagendar\/tok-123"/); assert.doesNotMatch(html, /respuesta=no/)
  })
  test('desde el correo, pedir otra hora cuando la llamada ya pasó suelta la hora y deja elegir otra (una sola acción en la página)', async () => {
    const { sol } = armar()
    const f = db.rows('solicitudes').find((s: any) => s.id === sol.id)!; f.tipo = 'entrevista'; f.slots_propuestos = []
    const r = await reagendarCliente(req('/api/solicitud/reagendar-cliente', { json: { token: 'tok-123' } }))
    assert.equal(r.status, 200); assert.equal((await r.json()).data.solicitud_id, sol.id)
    assert.equal(f.slot_confirmado ?? null, null)
  })
})

describe('«volver» según quién está mirando', () => {
  test('el compita vuelve a Telegram (o no ve botón); el cliente, a su portal; nunca el compita al portal', () => {
    const antes = process.env.TELEGRAM_BOT_USERNAME
    try {
      process.env.TELEGRAM_BOT_USERNAME = '@CompazBot'; assert.deepEqual(botonDe('compita'), { texto: 'Volver a Telegram', href: 'https://t.me/CompazBot' })
      delete process.env.TELEGRAM_BOT_USERNAME; assert.equal(botonDe('compita'), undefined)
      assert.deepEqual(botonDe('cliente'), { texto: '← Ir a mi portal', href: '/dashboard' })
    } finally { if (antes === undefined) delete process.env.TELEGRAM_BOT_USERNAME; else process.env.TELEGRAM_BOT_USERNAME = antes }
  })
  test('la página que ve el compita tras decir «no se pudo» (enlace viejo del correo o de Telegram) no lleva «Ir a mi portal»; la del cliente sí', async () => {
    process.env.TELEGRAM_BOT_USERNAME = 'CompazBot'
    const { sol } = armar()
    const comoCompita = await confirmacion(req(`/api/solicitud/confirmacion-llamada?token=tok-123&respuesta=no&${qRol('tok-123', 'compita')}`, { method: 'POST' }))
    const htmlC = await comoCompita.text(); assert.doesNotMatch(htmlC, /dashboard|Ir a mi portal/); assert.match(htmlC, /Volver a Telegram/)
    db.rows('solicitudes').find((s: any) => s.id === sol.id)!.confirmacion_compita = null; db.rows('solicitudes').find((s: any) => s.id === sol.id)!.estado = 'aceptada'
    const comoCliente = await confirmacion(req(`/api/solicitud/confirmacion-llamada?token=tok-123&respuesta=si&${qRol('tok-123', 'cliente')}`, { method: 'POST' }))
    assert.match(await comoCliente.text(), /Ir a mi portal/)
  })
})
