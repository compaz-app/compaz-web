/* eslint-disable */
// Sin perfil público lleno no se activa Telegram: el compita recibe por correo el enlace para llenarlo y no el código.
import { db, limpiar, tgText, ultimoTg, emailsA, mkCompita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { perfilCompleto } from '@/lib/compita-perfil'

beforeEach(limpiar)
const codigoDe = (to: string) => emailsA(to).at(-1)!.html.match(/>(\d{6})</)![1]
const vincular = async (chat: number, nombre: string) => { await webhook(tgText(chat, '/start')); await webhook(tgText(chat, nombre)) }

describe('perfil mínimo', () => {
  test('hace falta descripción y al menos un servicio; la foto y el video no', () => {
    assert.equal(perfilCompleto({ descripcion: 'Cuido con cariño', servicios: ['Compañía'] }), true)
    for (const x of [null, undefined, {}, { descripcion: '', servicios: ['a'] }, { descripcion: '   ', servicios: ['a'] }, { descripcion: 'hola', servicios: [] }, { descripcion: 'hola', servicios: ['  '] }, { descripcion: 'hola', servicios: null }]) assert.equal(perfilCompleto(x as any), false)
  })
})

describe('Telegram exige el perfil', () => {
  test('perfil vacío: no hay código; llega el enlace del perfil por correo y Telegram explica por qué', async () => {
    mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null, verificado: false, descripcion: null, servicios: [] })
    await vincular(600, 'Ana Gómez')
    const correos = emailsA('ana@mail.test'); assert.equal(correos.length, 1)
    assert.match(correos[0].html, /\/compita\/perfil\?token=/); assert.doesNotMatch(correos[0].html, />\d{6}</, 'no lleva código')
    assert.match(ultimoTg(600)!.text, /perfil público/); assert.ok(!ultimoTg(600)!.text.includes('ana@mail.test'), 'el correo completo no se muestra')
    assert.equal(db.rows('telegram_estados').filter((r: any) => String(r.pendiente_accion ?? '').startsWith('verificar:')).length, 0, 'no queda un código pendiente')
    assert.equal(db.rows('compitas')[0].telegram_chat_id, null)
  })
  test('después de llenar el perfil, el flujo sigue normal: código por correo y vinculada', async () => {
    const c = mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null, verificado: false, descripcion: null, servicios: [] })
    await vincular(601, 'Ana Gómez')
    db.rows('compitas').find((r: any) => r.id === c.id)!.descripcion = 'Cuido con cariño'; db.rows('compitas').find((r: any) => r.id === c.id)!.servicios = ['Compañía']
    db.rows('telegram_estados').forEach((r: any) => { if (String(r.chat_id).startsWith('cod:')) r.updated_at = new Date(Date.now() - 120_000).toISOString() })
    await vincular(601, 'Ana Gómez')
    await webhook(tgText(601, codigoDe('ana@mail.test')))
    assert.equal(db.rows('compitas').find((r: any) => r.id === c.id)!.telegram_chat_id, '601')
  })
  test('sin correo registrado no hay forma segura de mandar el enlace: se le pide escribir al equipo', async () => {
    mkCompita({ nombre: 'Sin Correo', email: null, telegram_chat_id: null, descripcion: null, servicios: [] })
    await vincular(602, 'Sin Correo')
    assert.match(ultimoTg(602)!.text, /hola@micompaz\.com/); assert.equal(db.rows('compitas')[0].telegram_chat_id, null)
  })
  test('el plazo de un minuto también cuenta aquí: no se puede llenar de correos a nadie', async () => {
    mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null, descripcion: null, servicios: [] })
    await vincular(603, 'Ana Gómez'); await vincular(604, 'Ana Gómez')
    assert.equal(emailsA('ana@mail.test').length, 1); assert.match(ultimoTg(604)!.text, /Espera un minuto/)
  })
})
