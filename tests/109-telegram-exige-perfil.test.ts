/* eslint-disable */
// Sin perfil público lleno no se activa Telegram: el compita recibe por correo el enlace para llenarlo y no el código.
import { db, limpiar, tgText, ultimoTg, emailsA, mkCompita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { horasLibresSemana, perfilCompleto, PERFIL_MINIMO } from '@/lib/compita-perfil'

beforeEach(limpiar)
const codigoDe = (to: string) => emailsA(to).at(-1)!.html.match(/>(\d{6})</)![1]
const vincular = async (chat: number, nombre: string) => { await webhook(tgText(chat, '/start')); await webhook(tgText(chat, nombre)) }

describe('perfil mínimo', () => {
  const HORAS = [{ dia: 'lunes', inicio: '09:00', fin: '12:00' }]
  test('hace falta descripción, al menos un servicio y al menos 2 horas libres por semana; la foto y el video no', () => {
    assert.equal(perfilCompleto({ descripcion: 'Cuido con cariño', servicios: ['Compañía'], horarios_disponibles: HORAS }), true)
    for (const x of [null, undefined, {}, { descripcion: '', servicios: ['a'], horarios_disponibles: HORAS }, { descripcion: '   ', servicios: ['a'], horarios_disponibles: HORAS }, { descripcion: 'hola', servicios: [], horarios_disponibles: HORAS }, { descripcion: 'hola', servicios: ['  '], horarios_disponibles: HORAS }, { descripcion: 'hola', servicios: null, horarios_disponibles: HORAS }]) assert.equal(perfilCompleto(x as any), false)
  })
  test('las horas libres: mínimo 2 por semana, las franjas que se solapan no se cuentan dos veces y lo mal formado no suma', () => {
    const base = { descripcion: 'hola', servicios: ['a'] }
    assert.equal(horasLibresSemana([{ dia: 'lunes', inicio: '09:00', fin: '10:00' }, { dia: 'martes', inicio: '09:00', fin: '10:00' }]), 2)
    assert.equal(perfilCompleto({ ...base, horarios_disponibles: [{ dia: 'lunes', inicio: '09:00', fin: '10:00' }, { dia: 'martes', inicio: '09:00', fin: '10:00' }] }), true, 'dos horas repartidas en dos días valen')
    assert.equal(perfilCompleto({ ...base, horarios_disponibles: [{ dia: 'lunes', inicio: '09:00', fin: '10:40' }] }), false, 'una hora y 40 minutos no alcanza')
    assert.equal(perfilCompleto({ ...base, horarios_disponibles: [{ dia: 'lunes', inicio: '09:00', fin: '10:00' }, { dia: 'lunes', inicio: '09:30', fin: '10:30' }] }), false, 'solapadas: 1 h 30, no 2')
    assert.equal(horasLibresSemana([{ dia: 'lunes', inicio: '12:00', fin: '09:00' }, { dia: 'lunes', inicio: 'x', fin: 'y' }, null as any]), 0)
    assert.equal(horasLibresSemana(null), 0); assert.equal(horasLibresSemana(undefined), 0)
    assert.equal(perfilCompleto({ ...base }), false, 'sin horas no hay perfil')
    assert.match(PERFIL_MINIMO, /2 horas libres por semana/)
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
