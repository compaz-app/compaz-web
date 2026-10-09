/* eslint-disable */
// Recorrido de la compita de punta a punta, buscando callejones sin salida.
import { db, net, session, limpiar, req, tgText, ultimoTg, tgPara, emailsA, cron, hoyVEstr, mkCliente, mkVisita } from './harness'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { POST as generarInvite } from '@/app/api/admin/generar-invite/route'
import { POST as registrar } from '@/app/api/onboarding/registrar/route'
import { POST as toggleVerificado } from '@/app/api/admin/toggle-verificado/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'

beforeEach(limpiar)
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
const codigoDe = (to: string) => emailsA(to).at(-1)!.html.match(/>(\d{6})</)![1]
const verificar = (id: string, v = true) => { admin(); return toggleVerificado(req('/api/admin/toggle-verificado', { json: { compita_id: id, verificado: v } })) }

async function registrarCompita(email: string | null = 'rosa@mail.test') {
  admin()
  const token = (await (await (generarInvite as any)()).json()).data.token
  session.user = null
  await registrar(req('/api/onboarding/registrar', { json: { token, nombre: 'Rosa Díaz', email, zona: 'Zulia', descripcion: 'Cuidadora', servicios: ['Compañía'] } }))
  return db.rows('compitas').at(-1)!
}

test('el correo de bienvenida no repite comandos y avisa que habrá una revisión', async () => {
  await registrarCompita()
  const html = emailsA('rosa@mail.test')[0].html
  assert.equal((html.match(/>\/menu</g) ?? []).length, 1)
  assert.match(html, /revisa y verifica tu perfil/)
})

test('SIN CALLEJÓN: registrada → vincula Telegram → "en revisión" → el admin verifica → ELLA RECIBE EL AVISO y ya puede operar', async () => {
  const rosa = await registrarCompita()
  await webhook(tgText(7000, '/start')); await webhook(tgText(7000, 'Rosa Díaz'))
  await webhook(tgText(7000, codigoDe('rosa@mail.test')))
  assert.equal(rosa.telegram_chat_id, '7000')
  await webhook(tgText(7000, '▶️ Iniciar visita'))
  assert.match(ultimoTg(7000)!.text, /en revisión/)

  const r = await verificar(rosa.id)
  assert.equal((await r.json()).data.notificada, 'telegram')
  assert.match(ultimoTg(7000)!.text, /Tu cuenta fue verificada/)
  assert.equal(rosa.verificado, true); assert.equal(rosa.estado, 'activo')

  // ya puede operar: con una visita programada para hoy, inicia sin el aviso de "en revisión"
  const cli = mkCliente({ email: 'cli@mail.test', compita_id: rosa.id })
  const v = mkVisita(cli, rosa, { estado: 'programada', fecha_programada: hoyVEstr(), hora_inicio_programada: '10:00', hora_fin_programada: '12:00' })
  await webhook(tgText(7000, '▶️ Iniciar visita')); await webhook(tgText(7000, '✅ Sí, iniciar'))
  assert.equal(v.estado, 'en_curso')
})

test('si todavía no vinculó Telegram, se le avisa por correo con el enlace al bot', async () => {
  const rosa = await registrarCompita()
  net.emails = []
  const r = await verificar(rosa.id)
  assert.equal((await r.json()).data.notificada, 'correo')
  const mail = emailsA('rosa@mail.test')[0]
  assert.ok(mail.html.includes('t.me/compaz_bot') && mail.subject.includes('verificado'))
})

test('si el aviso falla, la verificación igual queda hecha; quitar la verificación no avisa', async () => {
  const rosa = await registrarCompita(); rosa.telegram_chat_id = '7001'
  net.tgFailFor.add('7001'); net.resendFail = true
  const r = await verificar(rosa.id)
  assert.equal(r.status, 200); assert.equal((await r.json()).data.notificada, null)
  assert.equal(rosa.verificado, true)
  net.tgFailFor.clear(); net.resendFail = false; net.tg = []; net.emails = []
  await verificar(rosa.id, false)
  assert.equal(net.tg.length + net.emails.length, 0)
  assert.equal(rosa.verificado, false)
})

test('compita bloqueada no recibe aviso de verificación', async () => {
  const rosa = await registrarCompita(); rosa.telegram_chat_id = '7002'; rosa.estado = 'bloqueado'
  net.tg = []; await verificar(rosa.id)
  assert.equal(tgPara(7002).length, 0)
})
