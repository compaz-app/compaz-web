/* eslint-disable */
// Motivo cuando alguien dice que no (opcional, un toque): el cliente al no contratar y el compita al rechazar.
// Queda como evento; es el dato que más ayuda a mejorar el servicio. Ver lib/motivos.ts.
import { db, limpiar, req, mkCompita, mkCliente, mkSolicitud, tgPara, tgBtn, ultimoTg } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { GET as motivoGet, POST as motivoPost } from '@/app/api/solicitud/motivo/route'
import { POST as resultadoPost } from '@/app/api/solicitud/resultado-llamada/route'
import { POST as seguimientoPost } from '@/app/api/solicitud/seguimiento/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { qRol } from '@/lib/links'

beforeEach(limpiar)

const url = (t: string, rol: 'cliente' | 'compita' = 'cliente') => `/api/solicitud/motivo?token=${t}&${qRol(t, rol)}`
const post = (t: string, motivo: string, rol: 'cliente' | 'compita' = 'cliente') =>
  motivoPost(req(url(t, rol), { method: 'POST', body: `motivo=${motivo}`, headers: { 'content-type': 'application/x-www-form-urlencoded' } }))
const rechazada = () => {
  const compita = mkCompita({ telegram_chat_id: '970' })
  const cli = mkCliente({ email: 'cli@mail.test' })
  const sol = mkSolicitud(cli, compita, { estado: 'rechazada' })
  return { compita, cli, sol }
}
const eventos = (tipo: string) => db.rows('eventos').filter((e) => e.tipo === tipo)

describe('pantalla de motivo del cliente', () => {
  test('muestra las opciones y la salida "Omitir"', async () => {
    const { sol } = rechazada()
    const r = await motivoGet(req(url(sol.token_respuesta)))
    assert.equal(r.status, 200)
    const html = await r.text()
    for (const t of ['No conecté con esa persona', 'El precio', 'Prefiero conocer a otro compita', 'Necesito más tiempo para decidir', 'Otro motivo']) assert.ok(html.includes(t), t)
    assert.match(html, /Omitir y ver otros compitas/)
  })

  test('un toque guarda el motivo como evento', async () => {
    const { cli, sol } = rechazada()
    const r = await post(sol.token_respuesta, 'precio')
    assert.equal(r.status, 200)
    assert.match(await r.text(), /Gracias por contarnos/)
    const e = eventos('motivo_no_contratar')
    assert.equal(e.length, 1)
    assert.equal(e[0].datos.motivo, 'precio')
    assert.equal(e[0].actor, `cliente:${cli.id}`)
    assert.equal(e[0].entidad_id, sol.id)
  })

  test('un segundo toque no suma otro motivo', async () => {
    const { sol } = rechazada()
    await post(sol.token_respuesta, 'precio')
    const r = await post(sol.token_respuesta, 'prefiero_otro')
    assert.equal(r.status, 200)
    assert.equal(eventos('motivo_no_contratar').length, 1)
    assert.equal(eventos('motivo_no_contratar')[0].datos.motivo, 'precio')
  })

  test('un motivo inventado se rechaza y no se guarda', async () => {
    const { sol } = rechazada()
    assert.equal((await post(sol.token_respuesta, 'cualquier-cosa')).status, 400)
    assert.equal(eventos('motivo_no_contratar').length, 0)
  })

  test('sin firma válida, o con la firma de otro rol, responde 400', async () => {
    const { sol } = rechazada()
    assert.equal((await motivoGet(req(`/api/solicitud/motivo?token=${sol.token_respuesta}&quien=cliente&s=falsa`))).status, 400)
    assert.equal((await motivoGet(req(`/api/solicitud/motivo?token=${sol.token_respuesta}&quien=compita&${qRol(sol.token_respuesta, 'cliente').split('&')[1]}`))).status, 400)
  })

  test('si la solicitud no está rechazada, no hay nada que contar', async () => {
    const compita = mkCompita(); const cli = mkCliente()
    const sol = mkSolicitud(cli, compita, { estado: 'aceptada' })
    assert.equal((await motivoGet(req(url(sol.token_respuesta)))).status, 404)
  })
})

describe('el cliente llega a la pantalla al decir que no', () => {
  test('desde el correo de la entrevista (resultado-llamada)', async () => {
    const compita = mkCompita(); const cli = mkCliente({ email: 'cli@mail.test' })
    const sol = mkSolicitud(cli, compita, { estado: 'aceptada' })
    const t = sol.token_respuesta
    const r = await resultadoPost(req(`/api/solicitud/resultado-llamada?token=${t}&resultado=no_contratar&${qRol(t, 'cliente')}`, { method: 'POST' }))
    assert.equal(r.status, 303)
    assert.match(r.headers.get('location')!, new RegExp(`/api/solicitud/motivo\\?token=${t}&quien=cliente&s=`))
  })

  test('desde el correo de seguimiento', async () => {
    const compita = mkCompita(); const cli = mkCliente({ email: 'cli@mail.test' })
    const sol = mkSolicitud(cli, compita, { estado: 'aceptada', slot_confirmado: new Date(Date.now() - 3600_000).toISOString() })
    const t = sol.token_respuesta
    const r = await seguimientoPost(req(`/api/solicitud/seguimiento?token=${t}&respuesta=no&${qRol(t, 'cliente')}`, { method: 'POST' }))
    assert.equal(r.status, 303)
    assert.match(r.headers.get('location')!, /\/api\/solicitud\/motivo\?token=/)
  })
})

describe('motivo del compita al rechazar una solicitud (Telegram)', () => {
  const pendiente = () => {
    const compita = mkCompita({ telegram_chat_id: '970' })
    const cli = mkCliente({ email: 'cli@mail.test' })
    return { compita, sol: mkSolicitud(cli, compita, { estado: 'pendiente' }) }
  }

  test('al rechazar, recibe los botones de motivo, y un toque lo guarda', async () => {
    const { compita, sol } = pendiente()
    await webhook(tgBtn(970, `rechazar:${sol.token_respuesta}`))
    const botones = ultimoTg(970)!.markup.inline_keyboard.flat().map((b: any) => b.callback_data)
    assert.equal(botones.length, 4)
    assert.ok(botones.every((d: string) => d.startsWith(`motivo:${sol.token_respuesta}:`)))
    await webhook(tgBtn(970, `motivo:${sol.token_respuesta}:sin_tiempo`))
    const e = eventos('motivo_rechazo')
    assert.equal(e.length, 1)
    assert.equal(e[0].datos.motivo, 'sin_tiempo')
    assert.equal(e[0].actor, `compita:${compita.id}`)
    assert.ok(tgPara(970).some((m) => m.text.includes('lo anotamos')))
  })

  test('otro compita no puede anotar un motivo en una solicitud ajena', async () => {
    const { sol } = pendiente()
    await webhook(tgBtn(970, `rechazar:${sol.token_respuesta}`))
    mkCompita({ telegram_chat_id: '971' })
    await webhook(tgBtn(971, `motivo:${sol.token_respuesta}:zona`))
    assert.equal(eventos('motivo_rechazo').length, 0)
  })

  test('un código inventado no se guarda', async () => {
    const { sol } = pendiente()
    await webhook(tgBtn(970, `rechazar:${sol.token_respuesta}`))
    await webhook(tgBtn(970, `motivo:${sol.token_respuesta}:inventado`))
    assert.equal(eventos('motivo_rechazo').length, 0)
  })

  test('el segundo toque no suma otro motivo', async () => {
    const { sol } = pendiente()
    await webhook(tgBtn(970, `rechazar:${sol.token_respuesta}`))
    await webhook(tgBtn(970, `motivo:${sol.token_respuesta}:zona`))
    await webhook(tgBtn(970, `motivo:${sol.token_respuesta}:horarios`))
    assert.equal(eventos('motivo_rechazo').length, 1)
    assert.equal(eventos('motivo_rechazo')[0].datos.motivo, 'zona')
  })
})
