/* eslint-disable */
// Un cliente bloqueado (o eliminado) queda fuera: no recibe enlaces, no entra con uno vigente y todas las acciones fallan.
import { db, net, session, limpiar, req, emailsA, ahoraMas, mkCliente, mkCompita, mkSolicitud, mkVisita } from './harness'
import { otps } from './fake-supabase-server'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { POST as bloquear } from '@/app/api/admin/bloquear-cliente/route'
import { DELETE as eliminar } from '@/app/api/admin/eliminar-cliente/route'
import { POST as solicitarAcceso } from '@/app/api/auth/solicitar-acceso/route'
import { POST as confPost } from '@/app/auth/confirm/route'
import { POST as solicitar } from '@/app/api/solicitudes/route'
import { POST as sendMessage } from '@/app/api/send-message/route'
import { POST as nueva } from '@/app/api/visita/nueva/route'
import { POST as pagoConfirmar } from '@/app/api/pago/confirmar/route'
import { GET as pagoInfo } from '@/app/api/pago/info/route'
import { GET as misSolicitudes } from '@/app/api/mis-solicitudes/route'
import { PUT as familiar } from '@/app/api/usuario/familiar/route'
import { POST as meInteresa } from '@/app/api/me-interesa/route'
import { PUT as fechaPut } from '@/app/api/visita/fecha/route'
import { POST as reagendar } from '@/app/api/visita/reagendar/route'
import { POST as createCall } from '@/app/api/create-call/route'
import { GET as fotoGet } from '@/app/api/foto/[id]/route'

beforeEach(() => { limpiar(); otps.clear() })
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
const J = (path: string, json: any = {}) => req(path, { json })

function mundo() {
  const lucia = mkCompita({ telegram_chat_id: '9500' }); const carlos = mkCliente({ email: 'carlos@mail.test', nombre: 'Carlos', compita_id: lucia.id })
  const sol = mkSolicitud(carlos, lucia, { estado: 'aceptada', slot_confirmado: ahoraMas(-60) })
  const v = mkVisita(carlos, lucia, { estado: 'en_curso', inicio: new Date().toISOString() })
  const foto = db.seed('mensajes', { visit_id: v.id, origen: 'compita', tipo: 'foto', contenido: 'tg:ABC' })
  return { lucia, carlos, sol, v, foto }
}
const bloquearA = async (c: any, b = true) => { admin(); return bloquear(J('/api/admin/bloquear-cliente', { usuario_id: c.id, bloquear: b })) }

test('al bloquear: se marca la cuenta y también se bloquea en Supabase Auth; al desbloquear se revierte', async () => {
  const { carlos } = mundo()
  assert.equal((await bloquearA(carlos)).status, 200)
  assert.equal(carlos.plan, 'bloqueado'); assert.equal((db as any).bans[carlos.id], '876000h')
  await bloquearA(carlos, false)
  assert.equal(carlos.plan, null); assert.equal((db as any).bans[carlos.id], 'none')
})

test('un bloqueado NO recibe enlace de acceso (respuesta idéntica, sin correo)', async () => {
  const { carlos } = mundo(); await bloquearA(carlos)
  const r = await solicitarAcceso(req('/api/auth/solicitar-acceso', { json: { email: 'carlos@mail.test' }, headers: { 'x-nf-client-connection-ip': '8.8.8.8' } }))
  assert.equal(r.status, 200); assert.deepEqual((await r.json()).data, { enviado: true })
  assert.equal(emailsA('carlos@mail.test').length, 0); assert.equal(otps.size, 0)
})

test('aunque tenga un enlace vigente, no entra: va al login con aviso y sin sesión', async () => {
  const { carlos } = mundo()
  otps.set('hb', { id: carlos.id, email: carlos.email, usado: false })
  await bloquearA(carlos); session.user = null
  const r = await confPost(req('/auth/confirm?token_hash=hb&type=email', { method: 'POST' }))
  assert.equal(new URL(r.headers.get('location')!).search, '?error=bloqueado')
})

test('con la sesión ABIERTA, cada acción del bloqueado falla en el momento', async () => {
  const { carlos, v, foto } = mundo()
  como(carlos)
  assert.equal((await misSolicitudes()).status, 200, 'antes del bloqueo funciona')
  await bloquearA(carlos); como(carlos)
  const resultados: Record<string, number> = {
    mis_solicitudes: (await misSolicitudes()).status,
    solicitar: (await solicitar(J('/api/solicitudes', { compita_id: 'x', mensaje: 'h', slots_propuestos: [ahoraMas(100)] }))).status,
    mensaje: (await sendMessage(J('/api/send-message', { contenido: 'hola' }))).status,
    nueva_visita: (await nueva()).status,
    pago: (await pagoConfirmar(J('/api/pago/confirmar', { solicitud_id: 'x', plan: 'carta' }))).status,
    pago_info: (await pagoInfo(req('/api/pago/info?solicitud=x'))).status,
    familiar: (await familiar(req('/api/usuario/familiar', { method: 'PUT', json: { familiar_nombre: 'x' } }))).status,
    me_interesa: (await meInteresa(J('/api/me-interesa', { compita_id: 'x' }))).status,
    fecha: (await fechaPut(req('/api/visita/fecha', { method: 'PUT', json: { visita_id: v.id, fecha_programada: '2030-01-01', hora_inicio: '10:00', hora_fin: '12:00' } }))).status,
    reagendar: (await reagendar(J('/api/visita/reagendar', { visita_id: v.id }))).status,
    llamada: (await createCall(J('/api/create-call'))).status,
    foto: (await fotoGet(req(`/api/foto/${foto.id}`), { params: Promise.resolve({ id: foto.id }) })).status,
  }
  for (const [accion, status] of Object.entries(resultados)) assert.equal(status, 401, `${accion} debe responder 401 a un bloqueado`)
  assert.equal(db.rows('mensajes').filter((m) => m.origen === 'cliente').length, 0)
})

test('desbloquear le devuelve el acceso', async () => {
  const { carlos } = mundo(); await bloquearA(carlos); await bloquearA(carlos, false); como(carlos)
  assert.equal((await misSolicitudes()).status, 200)
})

test('un cliente ELIMINADO también queda fuera de inmediato y no puede pedir un enlace nuevo', async () => {
  const { carlos } = mundo(); como(carlos)
  assert.equal((await misSolicitudes()).status, 200)
  admin(); assert.equal((await eliminar(req('/api/admin/eliminar-cliente', { method: 'DELETE', json: { usuario_id: carlos.id } }))).status, 200)
  como(carlos)
  assert.equal((await misSolicitudes()).status, 401); assert.equal((await nueva()).status, 401)
  const r = await solicitarAcceso(req('/api/auth/solicitar-acceso', { json: { email: 'carlos@mail.test' }, headers: { 'x-nf-client-connection-ip': '9.9.9.9' } }))
  assert.equal(r.status, 200); assert.equal(emailsA('carlos@mail.test').length, 0)
})

test('el admin no se ve afectado (puede ver la foto y el panel)', async () => {
  const { foto } = mundo(); admin()
  assert.equal((await fotoGet(req(`/api/foto/${foto.id}`), { params: Promise.resolve({ id: foto.id }) })).status, 200)
})
