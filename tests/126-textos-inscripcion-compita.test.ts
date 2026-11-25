/* eslint-disable */
// La inscripción del compita es corta: presupuestos de palabras (correo máx. 80, Telegram máx. 45) y las advertencias de seguridad SIGUEN, en su versión breve.
import { db, net, limpiar, tgText, tgBtn, tgPara, emailsA, mkCompita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { sendBienvenidaCompita, sendCodigoTelegram, sendCompletarPerfilCompita } from '@/lib/resend'
import { AVISO_FRAUDE, AVISO_FUERA } from '@/lib/avisos-seguridad'

beforeEach(limpiar)
const pal = (t: string) => (t.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').match(/[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡0-9$%]+/g) ?? []).length
const codigoDe = (to: string) => emailsA(to).at(-1)!.html.match(/>(\d{6})</)![1]

describe('correos de la inscripción', () => {
  test('bienvenida: 3 pasos y como máximo 80 palabras (antes 322); lleva el enlace al bot, descargas y el aviso de fraude', async () => {
    await sendBienvenidaCompita('ana@mail.test', 'Ana Gómez', 'CompazBot')
    const m = emailsA('ana@mail.test')[0]
    assert.ok(pal(m.subject) + pal(m.html) <= 80, `tiene ${pal(m.subject) + pal(m.html)} palabras`)
    assert.match(m.html, /https:\/\/t\.me\/CompazBot/); assert.match(m.html, /apps\.apple\.com/); assert.match(m.html, /play\.google\.com/); assert.ok(m.html.includes(AVISO_FRAUDE))
    assert.doesNotMatch(m.html, /Paso 2|Comandos útiles/)
  })
  test('código: máximo 45 palabras, con el código, el plazo y el aviso de fraude', async () => {
    await sendCodigoTelegram('ana@mail.test', 'Ana Gómez', '123456')
    const m = emailsA('ana@mail.test')[0]
    assert.ok(pal(m.subject) + pal(m.html) <= 45, `tiene ${pal(m.subject) + pal(m.html)} palabras`)
    assert.match(m.html, />123456</); assert.match(m.html, /15 minutos/); assert.ok(m.html.includes(AVISO_FRAUDE))
  })
  test('completar el perfil: máximo 50 palabras y el enlace', async () => {
    await sendCompletarPerfilCompita('ana@mail.test', 'Ana Gómez', 'https://micompaz.test/compita/perfil?token=x')
    const m = emailsA('ana@mail.test')[0]
    assert.ok(pal(m.subject) + pal(m.html) <= 50, `tiene ${pal(m.subject) + pal(m.html)} palabras`); assert.match(m.html, /compita\/perfil\?token=x/)
  })
})

describe('Telegram de la inscripción', () => {
  test('el registro completo son 3 mensajes cortos (pedir nombre, código, activación), cada uno de máximo 45 palabras, y ya no llegan la guía ni «eso es todo»', async () => {
    mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null, verificado: false })
    await webhook(tgText(800, '/start')); await webhook(tgText(800, 'ana gómez')); await webhook(tgText(800, codigoDe('ana@mail.test')))
    const t = tgPara(800); assert.equal(t.length, 3, t.map((x: any) => x.text.slice(0, 30)).join(' | '))
    for (const m of t) assert.ok(pal(m.text) <= 45, `${pal(m.text)} palabras: ${m.text.slice(0, 50)}`)
    assert.ok(!t.some((m: any) => /Guía rápida|Eso es todo/.test(m.text)))
    assert.match(t[2].text, /Menú/); assert.match(t[2].text, /notificaciones/)
  })
  test('el aviso de fraude acompaña al código y a la activación', async () => {
    mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null, verificado: false })
    await webhook(tgText(801, '/start')); await webhook(tgText(801, 'ana gómez')); await webhook(tgText(801, codigoDe('ana@mail.test')))
    const t = tgPara(801); assert.ok(t[1].text.includes(AVISO_FRAUDE)); assert.ok(t[2].text.includes(AVISO_FRAUDE))
  })
  test('la guía (botón «Menú») pasó de 109 a unas 60 palabras y conserva las dos advertencias', async () => {
    mkCompita({ nombre: 'Ana', email: 'a@mail.test', telegram_chat_id: '802', estado: 'activo', verificado: true })
    await webhook(tgText(802, '📋 Menú'))
    const g = tgPara(802).at(-1)!.text; assert.ok(pal(g) <= 75, `tiene ${pal(g)} palabras`)
    assert.ok(g.includes(AVISO_FRAUDE) && g.includes(AVISO_FUERA)); assert.match(g, /Iniciar visita/); assert.match(g, /Terminar visita/); assert.match(g, /911/)
  })
})
