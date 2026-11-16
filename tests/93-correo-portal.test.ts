/* eslint-disable */
// La nota «ya lo ves en tu portal abierto» sale en todo correo con botón al portal, una sola vez y sin romper el correo.
import { db, net, limpiar, mkCliente, mkCompita, mkVisita, emailsA } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { conNotaPortalAbierto, TEXTO_NOTA_PORTAL, MARCA_NOTA_PORTAL } from '@/lib/correo-portal'
import { sendEmail } from '@/lib/email'

beforeEach(limpiar)
const boton = (href: string, t = 'Ir a mi portal →') => `<a href="${href}" style="display:inline-block;background:#FF6B2B;color:white">${t}</a>`

describe('conNotaPortalAbierto', () => {
  test('pone la nota justo debajo del botón al portal', () => {
    const r = conNotaPortalAbierto(`<p>Hola</p>${boton('https://micompaz.com/dashboard')}<p>Adiós</p>`)
    assert.ok(r.indexOf(TEXTO_NOTA_PORTAL) > r.indexOf('Ir a mi portal'), 'después del botón'); assert.ok(r.indexOf(TEXTO_NOTA_PORTAL) < r.indexOf('Adiós'), 'antes del resto')
  })
  test('funciona con /dashboard?contratado=1, con /portal y con un botón de varias líneas', () => {
    for (const href of ['https://micompaz.com/dashboard?contratado=1', 'https://micompaz.com/portal', 'https://micompaz.com/portal?sec=visitas'])
      assert.ok(conNotaPortalAbierto(boton(href)).includes(TEXTO_NOTA_PORTAL), href)
    assert.ok(conNotaPortalAbierto(`<a href="https://micompaz.com/dashboard" style="x">\n  Ver en el dashboard →\n</a>`).includes(TEXTO_NOTA_PORTAL))
  })
  test('una sola vez aunque haya dos enlaces, y no se duplica si se aplica dos veces', () => {
    const dos = conNotaPortalAbierto(boton('https://micompaz.com/dashboard') + boton('https://micompaz.com/dashboard', 'Otro'))
    assert.equal(dos.split(TEXTO_NOTA_PORTAL).length - 1, 1); assert.equal(conNotaPortalAbierto(dos), dos); assert.ok(dos.includes(MARCA_NOTA_PORTAL))
  })
  test('correos sin botón al portal quedan igual (el de la sala, el del panel del equipo, enlaces externos)', () => {
    for (const h of [boton('https://micompaz.com/sala/abc123', 'Entrar a la sala'), boton('https://micompaz.com/panel', 'Ir al panel'), boton('https://otro.com/dashboard-falso-x'), '<p>Sin enlaces</p>'])
      assert.equal(conNotaPortalAbierto(h), h, h)
  })
  test('no lleva emojis ni guiones como viñeta (regla de redacción de los correos)', () => {
    assert.doesNotMatch(TEXTO_NOTA_PORTAL, /[\u{1F300}-\u{1FAFF}☀-➿]/u); assert.doesNotMatch(TEXTO_NOTA_PORTAL, /^\s*[-–—]/)
  })
})

describe('todos los correos salen por sendEmail con la nota', () => {
  test('sendEmail la agrega al correo que se envía de verdad', async () => {
    await sendEmail({ to: 'cli@mail.test', subject: 'Tu compita confirmó', html: `<p>Confirmó</p>${boton('https://micompaz.com/dashboard')}` })
    const enviados = emailsA('cli@mail.test'); assert.equal(enviados.length, 1)
    assert.match(String((enviados[0] as any).html), new RegExp(TEXTO_NOTA_PORTAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  })
})
