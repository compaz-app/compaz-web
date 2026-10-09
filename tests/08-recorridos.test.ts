/* eslint-disable */
// Recorridos completos y encadenados: admin + compita + cliente + crons + Daily sobre la MISMA base de datos.
import { db, net, session, limpiar, req, tgText, tgBtn, tgFoto, ultimoTg, tgPara, emailsA, cron, ahoraMas, hoyVEstr, firmaDaily, mkCompita, mkCliente } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { tokenRating } from '@/lib/links'
import { POST as generarInvite } from '@/app/api/admin/generar-invite/route'
import { POST as registrar } from '@/app/api/onboarding/registrar/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { PUT as perfilPut } from '@/app/api/compita/perfil/route'
import { POST as toggleVerificado } from '@/app/api/admin/toggle-verificado/route'
import { GET as cobertura } from '@/app/api/cobertura/route'
import { POST as invitarCliente } from '@/app/api/admin/invitar-cliente/route'
import { PUT as familiarPut } from '@/app/api/usuario/familiar/route'
import { POST as solicitar } from '@/app/api/solicitudes/route'
import { GET as misSolicitudes } from '@/app/api/mis-solicitudes/route'
import { POST as recordatorios } from '@/app/api/cron/recordatorios/route'
import { POST as dailyWebhook } from '@/app/api/webhooks/daily/route'
import { GET as resultadoGet } from '@/app/api/solicitud/resultado-llamada/route'
import { GET as pagoInfo } from '@/app/api/pago/info/route'
import { POST as pagoConfirmar } from '@/app/api/pago/confirmar/route'
import { PUT as fechaPut } from '@/app/api/visita/fecha/route'
import { POST as manana } from '@/app/api/cron/recordatorio-primera-visita/route'
import { POST as sendMessage } from '@/app/api/send-message/route'
import { POST as ratingPost } from '@/app/api/visita/rating/route'
import { POST as churn } from '@/app/api/cron/churn-alerta/route'
import { POST as seguimientoCron } from '@/app/api/cron/seguimiento/route'
import { POST as cierre } from '@/app/api/cron/cierre-rechazo/route'
import { POST as proponer } from '@/app/api/solicitud/proponer-reagendado/route'
import { GET as respGet, POST as respPost } from '@/app/api/solicitud/responder/route'
import { POST as reconectar } from '@/app/api/solicitud/reconectar-llamada/route'
import { POST as resultadoPost } from '@/app/api/solicitud/resultado-llamada/route'
import { POST as bloquearCompita } from '@/app/api/admin/bloquear-compita/route'
import { DELETE as eliminarCliente } from '@/app/api/admin/eliminar-cliente/route'
import { DELETE as eliminarCompita } from '@/app/api/admin/eliminar-compita/route'
import { POST as enviarLink } from '@/app/api/admin/enviar-link-llamada/route'
import { POST as meInteresa } from '@/app/api/me-interesa/route'

beforeEach(limpiar)
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }
const como = (u: any) => { session.user = { id: u.id, email: u.email } }
const hace = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const sol = () => db.rows('solicitudes').at(-1)!
const codigoDe = (to: string) => emailsA(to).at(-1)!.html.match(/>(\d{6})</)![1]
const href = (html: string, re: RegExp) => (html.match(re)?.[0] ?? '').replace(/&amp;/g, '&')
const foto = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fotos/compitas/a.jpg`

describe('RECORRIDO 1: de la invitación de la compita hasta la valoración, todo encadenado', () => {
  test('admin → compita → cliente → entrevista → contratación → visita → cuestionario → rating → churn', async () => {
    // ── 1. Admin invita; la compita se registra con el enlace de un solo uso
    admin()
    const inv = await (await (generarInvite as any)()).json()
    const token = inv.data.token
    session.user = null
    const reg = await registrar(req('/api/onboarding/registrar', { json: { token, nombre: 'Lucía Fernández', email: 'lucia@mail.test', zona: 'Zulia', descripcion: 'Cuidadora', servicios: ['Compañía'], foto_url: foto } }))
    assert.equal(reg.status, 200)
    const lucia = db.rows('compitas')[0]
    assert.equal(lucia.verificado, false)
    assert.equal((await registrar(req('/api/onboarding/registrar', { json: { token, nombre: 'Otra', zona: 'x', descripcion: 'x', servicios: ['a'] } }))).status, 400, 'la invitación es de un solo uso')

    // ── 2. No aparece en el mapa hasta estar vinculada Y verificada
    assert.deepEqual((await (await (cobertura as any)()).json()).data.zonas, [])

    // ── 3. Vincula Telegram con el código del correo
    await webhook(tgText(2000, '/start')); await webhook(tgText(2000, 'Lucía Fernández'))
    await webhook(tgText(2000, codigoDe('lucia@mail.test')))
    assert.equal(lucia.telegram_chat_id, '2000')
    assert.deepEqual((await (await (cobertura as any)()).json()).data.zonas, [], 'vinculada pero sin verificar: no visible')
    await webhook(tgText(2000, '▶️ Iniciar visita'))
    assert.match(ultimoTg(2000)!.text, /en revisión/)

    // ── 4. Edita su perfil desde el enlace de Telegram
    await webhook(tgText(2000, '/perfil'))
    const tk = ultimoTg(2000)!.text.match(/token=([0-9a-f-]+)/)![1]
    session.user = null
    assert.equal((await perfilPut(req('/api/compita/perfil', { method: 'PUT', json: { token: tk, descripcion: 'Cuidadora con 12 años', servicios: ['Compañía', 'Cocina'], verificado: true } }))).status, 200)
    assert.equal(lucia.verificado, false, 'no se auto-verifica')

    // ── 5. El admin la verifica → aparece en el mapa
    admin()
    await toggleVerificado(req('/api/admin/toggle-verificado', { json: { compita_id: lucia.id, verificado: true } }))
    assert.deepEqual((await (await (cobertura as any)()).json()).data.zonas, ['Zulia'])

    // ── 6. El admin invita al cliente; este completa el perfil de su familiar (con caracteres especiales)
    await invitarCliente(req('/api/admin/invitar-cliente', { json: { nombre: 'Carlos Ruiz', email: 'carlos@mail.test' } }))
    const carlos = db.rows('usuarios').find((u) => u.email === 'carlos@mail.test')!
    assert.ok(carlos && emailsA('carlos@mail.test').length >= 1)
    como(carlos)
    assert.equal((await familiarPut(req('/api/usuario/familiar', { method: 'PUT', json: { familiar_nombre: 'Rosa', familiar_edad: 82, familiar_condicion: 'Diabetes & presión <alta>', familiar_notas: 'No sal' } }))).status, 200)

    // ── 7. Solicita entrevista; ve su solicitud; la compita recibe el mensaje y acepta
    const slots = [ahoraMas(180), ahoraMas(300)]
    assert.equal((await solicitar(req('/api/solicitudes', { json: { compita_id: lucia.id, mensaje: 'Mi mamá Rosa necesita compañía', slots_propuestos: slots } }))).status, 200)
    assert.equal((await (await misSolicitudes()).json()).data.solicitudes.length, 1)
    await webhook(tgBtn(2000, `slot:0:${sol().token_respuesta}`))
    assert.equal(sol().estado, 'aceptada')
    assert.ok(emailsA('carlos@mail.test').some((e) => e.subject.includes('confirmada')))

    // ── 8. Llega la hora: el cron crea la sala y manda los enlaces firmados
    sol().slot_confirmado = ahoraMas(30)
    net.emails = []
    await recordatorios(cron('r'))
    const mailLlamada = emailsA('carlos@mail.test')[0]
    assert.ok(mailLlamada.html.includes('/sala/'))
    assert.equal(net.rooms.length, 1)

    // ── 9. Termina la llamada (webhook de Daily) → el cliente elige contratar desde su correo
    net.emails = []
    const body = JSON.stringify({ event_type: 'meeting.ended', payload: { room_name: net.rooms[0].name, room_url: sol().room_url, duration: 1100 } })
    await dailyWebhook(req('/api/webhooks/daily', { body, headers: { 'content-type': 'application/json', ...firmaDaily(body) } }))
    const contratarUrl = href(emailsA('carlos@mail.test')[0].html, /\/api\/solicitud\/resultado-llamada\?token=[^"]*resultado=contratar/)
    const rc = await resultadoGet(req(contratarUrl))
    assert.equal(rc.status, 303)
    como(carlos)
    assert.equal((await pagoInfo(req(`/api/pago/info?solicitud=${sol().id}`))).status, 200)
    assert.equal((await pagoConfirmar(req('/api/pago/confirmar', { json: { solicitud_id: sol().id, plan: 'semanal' } }))).status, 200)
    assert.equal(sol().estado, 'contratada')
    assert.match(tgPara(2000).at(-1)!.text, /Te contrataron/)
    assert.match(tgPara(2000).at(-1)!.text, /&lt;alta&gt;/, 'la condición del familiar llega escapada')

    // ── 10. Coordinan la fecha por el chat; el cliente registra el día; recordatorio 24 h antes
    const visita = db.rows('visitas')[0]
    assert.equal(visita.estado, 'pre_visita')
    await webhook(tgText(2000, '¿Te queda bien mañana a las 10?'))
    assert.ok(db.rows('mensajes').some((m) => m.origen === 'compita' && m.visit_id === visita.id))
    como(carlos)
    assert.equal((await fechaPut(req('/api/visita/fecha', { method: 'PUT', json: { visita_id: visita.id, fecha_programada: hoyVEstr(1), hora_inicio: '10:00', hora_fin: '12:00' } }))).status, 200)
    admin(); net.tg = []
    await manana(cron('m'))
    assert.ok(tgPara(2000).some((m) => m.text.includes('visita mañana')))

    // ── 11. El día de la visita: inicia, conversan, foto, termina, cuestionario
    visita.fecha_programada = hoyVEstr()
    await webhook(tgText(2000, '▶️ Iniciar visita')); await webhook(tgText(2000, '✅ Sí, iniciar'))
    assert.equal(visita.estado, 'en_curso')
    await webhook(tgText(2000, 'Llegué, la señora está bien'))
    await webhook(tgFoto(2000))
    como(carlos)
    assert.equal((await sendMessage(req('/api/send-message', { json: { contenido: 'Gracias, ¿tomó su pastilla?' } }))).status, 200)
    assert.match(ultimoTg(2000)!.text, /pastilla/)
    await webhook(tgText(2000, '🔴 Terminar visita')); await webhook(tgText(2000, '✅ Sí, terminar'))
    for (const r of ['rr:5', 'rr:5', 'rr:4', 'rr:5']) await webhook(tgBtn(2000, r))
    await webhook(tgText(2000, 'Comió muy bien y salió a caminar'))
    assert.equal(db.rows('reportes_visita').length, 1)

    // ── 12. Valoración desde el correo; el promedio de la compita se actualiza
    const resumen = emailsA('carlos@mail.test').find((e) => e.subject.startsWith('Actualización') || e.subject.startsWith('Resumen'))!
    assert.ok(resumen)
    assert.equal((await ratingPost(req(`/api/visita/rating?visita_id=${visita.id}&valor=5&t=${tokenRating(visita.id, 5)}`, { method: 'POST' }))).status, 200)
    assert.equal(lucia.rating_promedio, 5); assert.equal(lucia.visitas_realizadas, 1)
    assert.ok(!JSON.stringify([db.rows('mensajes'), net.emails, net.tg]).includes('TESTBOTTOKEN'))

    // ── 13. Pasan 40 días sin otra visita → alerta de churn al admin
    visita.fin = hace(40 * 24 * 60)
    await churn(cron('c'))
    assert.ok(tgPara(999).some((m) => m.text.includes('necesitan seguimiento')))
  })
})

describe('RECORRIDO 2: rechazos, horarios alternativos, llamada caída y decisión del cliente', () => {
  test('rechaza → sugiere → el cliente re-solicita → llamada corta → reconecta → decide NO → busca otra compita', async () => {
    const lucia = mkCompita({ telegram_chat_id: '2100', nombre: 'Lucía' }); const ana = mkCompita({ telegram_chat_id: '2101', nombre: 'Ana' })
    const carlos = mkCliente({ email: 'carlos@mail.test', nombre: 'Carlos' }); como(carlos)
    const pedir = (c: any) => solicitar(req('/api/solicitudes', { json: { compita_id: c.id, mensaje: 'hola', slots_propuestos: [ahoraMas(180)] } }))
    await pedir(lucia)
    await webhook(tgBtn(2100, `rechazar:${sol().token_respuesta}`))
    assert.equal(sol().estado, 'rechazada')
    await webhook(tgText(2100, 'Puedo el jueves a las 3pm'))
    assert.equal(emailsA('carlos@mail.test').filter((e) => e.subject.includes('otros horarios')).length, 1)
    // el cliente vuelve a solicitar a la MISMA compita (ya no hay pendiente)
    assert.equal((await pedir(lucia)).status, 200)
    assert.equal(db.rows('solicitudes').length, 2)
    await webhook(tgBtn(2100, `slot:0:${sol().token_respuesta}`))
    assert.equal(sol().estado, 'aceptada')

    // llamada muy corta (se cayó) → reconecta el cliente → llamada completa
    sol().slot_confirmado = hace(5); sol().room_url = 'https://compaz.daily.co/ent-x-1'
    net.emails = []
    const ev = (d: number, url: string) => { const b = JSON.stringify({ event_type: 'meeting.ended', payload: { room_name: 'ent-x', room_url: url, duration: d } }); return req('/api/webhooks/daily', { body: b, headers: { 'content-type': 'application/json', ...firmaDaily(b) } }) }
    await dailyWebhook(ev(45, sol().room_url))
    assert.ok(!emailsA('carlos@mail.test')[0].html.includes('Sí, quiero contratar'))
    const t = sol().token_respuesta
    const { qRol } = await import('@/lib/links')
    assert.equal((await reconectar(req(`/api/solicitud/reconectar-llamada?token=${t}&${qRol(t, 'cliente')}`, { method: 'POST' }))).status, 200)
    net.emails = []
    await dailyWebhook(ev(900, sol().room_url))
    assert.ok(emailsA('carlos@mail.test')[0].html.includes('Sí, quiero contratar'), 'tras reconectar, la llamada completa sí ofrece contratar')

    // decide NO (POST firmado) → la compita recibe el cierre amable → el cliente puede pedir a otra
    await resultadoPost(req(`/api/solicitud/resultado-llamada?token=${t}&resultado=no_contratar&${qRol(t, 'cliente')}`, { method: 'POST' }))
    assert.equal(sol().estado, 'rechazada')
    assert.ok(tgPara(2100).some((m) => m.text.includes('Gracias por tu dedicación')))
    await seguimientoCron(cron('s')); assert.equal(emailsA('carlos@mail.test').filter((e) => e.subject.includes('¿Cómo te fue')).length, 0, 'no se le insiste a quien dijo que no')
    assert.equal((await pedir(ana)).status, 200)
    assert.ok(tgPara(2101).some((m) => m.text.includes('Nueva solicitud')))
  })

  test('la compita reagenda la entrevista: ella sugiere → el cliente propone → ella confirma por enlace → llega a la sala', async () => {
    const lucia = mkCompita({ telegram_chat_id: '2110' }); const carlos = mkCliente({ email: 'carlos@mail.test' }); como(carlos)
    await solicitar(req('/api/solicitudes', { json: { compita_id: lucia.id, mensaje: 'hola', slots_propuestos: [ahoraMas(180)] } }))
    await webhook(tgBtn(2110, `slot:0:${sol().token_respuesta}`))
    const t = sol().token_respuesta
    const botonReagendar = tgPara(2110).at(-1)!
    void botonReagendar
    const { qRol } = await import('@/lib/links')
    const { POST: reagCompita } = await import('@/app/api/solicitud/reagendar-compita/route')
    await reagCompita(req(`/api/solicitud/reagendar-compita?token=${t}&${qRol(t, 'compita')}`, { method: 'POST' }))
    assert.equal(sol().estado, 'rechazada')
    await webhook(tgText(2110, 'El viernes a las 4pm', { reply_to_message: { message_id: 2 } }))
    assert.ok(emailsA('carlos@mail.test').some((e) => e.subject.includes('otros horarios')))
    // el cliente usa la página /reagendar/[token] → proponer-reagendado
    assert.equal((await proponer(req('/api/solicitud/proponer-reagendado', { json: { token: t, slots: [ahoraMas(200), ahoraMas(400)] } }))).status, 200)
    assert.equal(sol().estado, 'pendiente')
    const url = tgPara(2110).at(-1)!.markup.inline_keyboard[0][0].url.replace(/^https:\/\/micompaz\.test/, '')
    await respPost(req(url, { method: 'POST' }))
    assert.equal(sol().estado, 'aceptada'); assert.equal(sol().slot_confirmado, sol().slots_propuestos[0])
    sol().slot_confirmado = ahoraMas(30); net.emails = []
    await recordatorios(cron('r'))
    assert.equal(emailsA('carlos@mail.test').length, 1)
  })

  test('solicitud ignorada: recordatorio, cierre automático y el cliente queda libre para pedir a otra', async () => {
    const lucia = mkCompita({ telegram_chat_id: '2120' }); const carlos = mkCliente({ email: 'carlos@mail.test' }); como(carlos)
    await solicitar(req('/api/solicitudes', { json: { compita_id: lucia.id, mensaje: 'hola', slots_propuestos: [ahoraMas(180)] } }))
    sol().created_at = hace(26 * 60); await cierre(cron('c'))
    assert.ok(tgPara(2120).some((m) => m.text.includes('sin responder')))
    sol().created_at = hace(80 * 60); await cierre(cron('c'))
    assert.equal(sol().estado, 'rechazada')
    assert.equal((await solicitar(req('/api/solicitudes', { json: { compita_id: lucia.id, mensaje: 'otra vez', slots_propuestos: [ahoraMas(300)] } }))).status, 200)
  })
})

describe('RECORRIDO 3: el admin interviene a mitad de los flujos', () => {
  const mundoContratado = async () => {
    const lucia = mkCompita({ telegram_chat_id: '2200', nombre: 'Lucía' }); const carlos = mkCliente({ email: 'carlos@mail.test', nombre: 'Carlos' })
    como(carlos)
    await solicitar(req('/api/solicitudes', { json: { compita_id: lucia.id, mensaje: 'hola', slots_propuestos: [ahoraMas(180)] } }))
    await webhook(tgBtn(2200, `slot:0:${sol().token_respuesta}`))
    await pagoConfirmar(req('/api/pago/confirmar', { json: { solicitud_id: sol().id, plan: 'carta' } }))
    const v = db.rows('visitas')[0]; v.estado = 'programada'; v.fecha_programada = hoyVEstr(); v.hora_inicio_programada = '10:00'; v.hora_fin_programada = '12:00'
    return { lucia, carlos, v }
  }

  test('bloquean a la compita con la visita en curso: ya no puede escribir, terminar ni usar emergencia', async () => {
    const { lucia, v } = await mundoContratado()
    await webhook(tgText(2200, '▶️ Iniciar visita')); await webhook(tgText(2200, '✅ Sí, iniciar'))
    admin(); await bloquearCompita(req('/api/admin/bloquear-compita', { json: { compita_id: lucia.id, bloquear: true } }))
    net.tg = []
    for (const t of ['hola', '🔴 Terminar visita']) await webhook(tgText(2200, t))
    await webhook(tgBtn(2200, 'emergencia'))
    assert.ok(tgPara(2200).every((m) => /no está vinculada|Comenzar|suspendida/i.test(m.text)))
    assert.equal(db.rows('mensajes').filter((m) => m.origen === 'compita').length, 0)
    void v
  })

  test('borrar al cliente con una visita activa: el bot no se rompe y la compita queda utilizable', async () => {
    const { lucia, carlos, v } = await mundoContratado()
    await webhook(tgText(2200, '▶️ Iniciar visita')); await webhook(tgText(2200, '✅ Sí, iniciar'))
    admin()
    assert.equal((await eliminarCliente(req('/api/admin/eliminar-cliente', { method: 'DELETE', json: { usuario_id: carlos.id } }))).status, 200)
    assert.equal(db.rows('usuarios').length, 0)
    net.tg = []
    for (const t of ['hola', '▶️ Iniciar visita', '🔴 Terminar visita']) { const r = await webhook(tgText(2200, t)); assert.equal(r.status, 200) }
    assert.ok(ultimoTg(2200), 'la compita sigue recibiendo respuestas coherentes (sin crash)')
    void lucia; void v
  })

  test('borrar a la compita con visitas pide confirmación (force) y el cliente no queda apuntando a una compita inexistente', async () => {
    const { lucia, carlos } = await mundoContratado()
    admin()
    const r = await eliminarCompita(req('/api/admin/eliminar-compita', { method: 'DELETE', json: { compita_id: lucia.id } }))
    assert.equal(r.status, 409)
    assert.equal((await eliminarCompita(req('/api/admin/eliminar-compita', { method: 'DELETE', json: { compita_id: lucia.id, force: true } }))).status, 200)
    assert.equal(db.rows('compitas').length, 0)
    assert.equal(db.rows('usuarios').find((u) => u.id === carlos.id)!.compita_id, null)
    assert.equal(db.rows('visitas').length, 0)
    // cron tras el borrado no se rompe
    assert.equal((await recordatorios(cron('r'))).status, 200)
    assert.equal((await seguimientoCron(cron('s'))).status, 200)
  })

  test('el admin fuerza el envío del enlace de la llamada: no se duplica con el cron', async () => {
    const lucia = mkCompita({ telegram_chat_id: '2210' }); const carlos = mkCliente({ email: 'carlos@mail.test' })
    db.seed('solicitudes', { cliente_id: carlos.id, compita_id: lucia.id, estado: 'aceptada', slot_confirmado: ahoraMas(30), mensaje: 'x', slots_propuestos: [ahoraMas(30)] })
    admin()
    assert.equal((await enviarLink(req('/api/admin/enviar-link-llamada', { json: { solicitud_id: sol().id } }))).status, 200)
    assert.equal(emailsA('carlos@mail.test').length, 1)
    await recordatorios(cron('r')); await recordatorios(cron('r'))
    assert.equal(emailsA('carlos@mail.test').length, 1, 'el cron no repite el enlace que el admin ya envió')
  })

  test('cliente bloqueado a mitad de proceso: no puede contratar ni pedir más', async () => {
    const lucia = mkCompita({ telegram_chat_id: '2220' }); const carlos = mkCliente({ email: 'carlos@mail.test' }); como(carlos)
    await solicitar(req('/api/solicitudes', { json: { compita_id: lucia.id, mensaje: 'hola', slots_propuestos: [ahoraMas(180)] } }))
    await webhook(tgBtn(2220, `slot:0:${sol().token_respuesta}`))
    carlos.plan = 'bloqueado'
    assert.equal((await pagoConfirmar(req('/api/pago/confirmar', { json: { solicitud_id: sol().id, plan: 'carta' } }))).status, 401)
    assert.equal(sol().estado, 'aceptada')
  })
})

describe('RECORRIDO 4: varios usuarios a la vez sobre la misma plataforma', () => {
  test('2 clientes y 2 compitas cruzados: cada mensaje, correo y estado llega solo a quien corresponde', async () => {
    const lucia = mkCompita({ telegram_chat_id: '2300', nombre: 'Lucía' }); const ana = mkCompita({ telegram_chat_id: '2301', nombre: 'Ana' })
    const carlos = mkCliente({ email: 'carlos@mail.test', nombre: 'Carlos' }); const pedro = mkCliente({ email: 'pedro@mail.test', nombre: 'Pedro' })
    const crear = (cli: any, comp: any) => { como(cli); return solicitar(req('/api/solicitudes', { json: { compita_id: comp.id, mensaje: `de ${cli.nombre}`, slots_propuestos: [ahoraMas(180)] } })) }
    await crear(carlos, lucia); await crear(pedro, lucia); await crear(pedro, ana)
    const s = (cli: any, comp: any) => db.rows('solicitudes').find((x) => x.cliente_id === cli.id && x.compita_id === comp.id)!
    // Lucía acepta a Carlos y rechaza a Pedro; Ana acepta a Pedro
    await webhook(tgBtn(2300, `slot:0:${s(carlos, lucia).token_respuesta}`))
    await webhook(tgBtn(2300, `rechazar:${s(pedro, lucia).token_respuesta}`))
    await webhook(tgBtn(2301, `slot:0:${s(pedro, ana).token_respuesta}`))
    assert.deepEqual([s(carlos, lucia).estado, s(pedro, lucia).estado, s(pedro, ana).estado], ['aceptada', 'rechazada', 'aceptada'])
    // Lucía no puede aceptar la solicitud de Pedro a Ana
    await webhook(tgBtn(2300, `slot:0:${s(pedro, ana).token_respuesta}`))
    assert.match(ultimoTg(2300)!.text, /ya fue usado|no es tuya/)
    // Contratan los dos; cada compita queda con SU cliente
    for (const [cli, comp] of [[carlos, lucia], [pedro, ana]] as const) { como(cli); await pagoConfirmar(req('/api/pago/confirmar', { json: { solicitud_id: s(cli, comp).id, plan: 'carta' } })) }
    assert.equal(carlos.compita_id, lucia.id); assert.equal(pedro.compita_id, ana.id)
    for (const v of db.rows('visitas')) { v.estado = 'programada'; v.fecha_programada = hoyVEstr(); v.hora_inicio_programada = '10:00'; v.hora_fin_programada = '11:00' }
    // Visitas simultáneas: lo que escribe cada compita va a su propio cliente
    await webhook(tgText(2300, '▶️ Iniciar visita')); await webhook(tgText(2300, '✅ Sí, iniciar'))
    await webhook(tgText(2301, '▶️ Iniciar visita')); await webhook(tgText(2301, '✅ Sí, iniciar'))
    net.emails = []
    await webhook(tgText(2300, 'mensaje de Lucía para Carlos')); await webhook(tgText(2301, 'mensaje de Ana para Pedro'))
    const vCarlos = db.rows('visitas').find((v) => v.usuario_id === carlos.id)!; const vPedro = db.rows('visitas').find((v) => v.usuario_id === pedro.id)!
    const msgs = (v: any) => db.rows('mensajes').filter((m) => m.visit_id === v.id && m.origen === 'compita').map((m) => m.contenido)
    assert.deepEqual(msgs(vCarlos), ['mensaje de Lucía para Carlos']); assert.deepEqual(msgs(vPedro), ['mensaje de Ana para Pedro'])
    assert.ok(emailsA('carlos@mail.test')[0].html.includes('Lucía') && !emailsA('carlos@mail.test')[0].html.includes('Ana para Pedro'))
    // Los clientes responden por el chat: cada uno solo llega a su compita
    net.tg = []
    como(carlos); await sendMessage(req('/api/send-message', { json: { contenido: 'hola desde Carlos' } }))
    como(pedro); await sendMessage(req('/api/send-message', { json: { contenido: 'hola desde Pedro' } }))
    assert.ok(tgPara(2300).some((m) => m.text.includes('desde Carlos')) && !tgPara(2300).some((m) => m.text.includes('desde Pedro')))
    assert.ok(tgPara(2301).some((m) => m.text.includes('desde Pedro')) && !tgPara(2301).some((m) => m.text.includes('desde Carlos')))
    // Terminan a la vez: un resumen por cliente, y cada cuestionario va a su visita
    await Promise.all([webhook(tgText(2300, '🔴 Terminar visita')), webhook(tgText(2301, '🔴 Terminar visita'))])
    await Promise.all([webhook(tgText(2300, '✅ Sí, terminar')), webhook(tgText(2301, '✅ Sí, terminar'))])
    assert.equal(emailsA('carlos@mail.test').filter((e) => e.subject.startsWith('Resumen')).length, 1)
    assert.equal(emailsA('pedro@mail.test').filter((e) => e.subject.startsWith('Resumen')).length, 1)
    for (const chat of [2300, 2301]) { for (const r of ['rr:5', 'rr:4', 'rr:3', 'rr:2']) await webhook(tgBtn(chat, r)); await webhook(tgBtn(chat, 'rn:skip')) }
    assert.equal(db.rows('reportes_visita').length, 2)
    assert.deepEqual(db.rows('reportes_visita').map((r) => r.visita_id).sort(), [vCarlos.id, vPedro.id].sort())
  })

  test('me-interesa → admin asigna → el cliente aparece en el bot de esa compita', async () => {
    const lucia = mkCompita({ telegram_chat_id: '2310' }); const carlos = mkCliente({ email: 'carlos@mail.test' }); como(carlos)
    await meInteresa(req('/api/me-interesa', { json: { compita_id: lucia.id } }))
    const link = tgPara(999)[0].text.match(/token=([0-9a-f]+)/)![1]
    const { POST: rapido } = await import('@/app/api/admin/asignar-rapido/route')
    await rapido(req(`/api/admin/asignar-rapido?token=${link}`, { method: 'POST' }))
    assert.equal(carlos.compita_id, lucia.id)
    const v = db.rows('visitas')[0]; assert.equal(v.estado, 'pre_visita')
    await webhook(tgText(2310, 'Hola Carlos, ¿cuándo te queda bien?'))
    assert.ok(db.rows('mensajes').some((m) => m.visit_id === v.id && m.origen === 'compita'))
  })
})
