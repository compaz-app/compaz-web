// Formulario nuevo de solicitud (Lote 2): el SERVIDOR exige los requisitos de seguridad, la contratación directa y el
// mandado no llevan horarios, el compita acepta ANTES del pago y el cliente recibe el paso siguiente (pagar).
import { db, net, session, limpiar, req, tgBtn, tgPara, emailsA, ahoraMas, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validarSolicitudNueva, mensajeDeSolicitud, MAX_NOTA } from '@/lib/validar-solicitud'
import { nombreCorto } from '@/lib/plantillas-aviso'
import { POST as crear } from '@/app/api/solicitudes/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { GET as pagoInfo } from '@/app/api/pago/info/route'

beforeEach(limpiar)

const base = { tipo: 'directa', que: 'Compañía y conversación', lugar_privado: false }
const privado = { ...base, lugar_privado: true, personas_en_lugar: ['Familiar', 'Vecino o vecina'] }

describe('validación del formulario nuevo', () => {
  const ok = (b: Record<string, unknown>) => { const r = validarSolicitudNueva(b); assert.equal(r.ok, true, JSON.stringify(r)); return (r as any).valor }
  const mal = (b: Record<string, unknown>, texto: RegExp) => { const r = validarSolicitudNueva(b); assert.equal(r.ok, false); assert.match((r as any).error, texto) }

  test('casos válidos: directa, entrevista, mandado, y lugar privado con personas o con "nadie más"', () => {
    assert.deepEqual(ok(base), { tipo: 'directa', que: 'Compañía y conversación', nota: null, lugar_privado: false, personas_en_lugar: null, duracion_min: null })
    assert.equal(ok({ ...base, tipo: 'entrevista' }).tipo, 'entrevista')
    assert.deepEqual(ok(privado).personas_en_lugar, ['Familiar', 'Vecino o vecina'])
    assert.deepEqual(ok({ ...base, lugar_privado: true, nadie_mas: true, personas_en_lugar: [] }).personas_en_lugar, [], 'lista vacía = nadie más')
    assert.deepEqual(ok({ tipo: 'mandado', nota: 'Llevar unos papeles a Chacao', duracion_min: 30, lugar_privado: false }), { tipo: 'mandado', que: 'Mandado', nota: 'Llevar unos papeles a Chacao', lugar_privado: false, personas_en_lugar: null, duracion_min: 30 })
  })

  test('tipo y "qué necesita" deben ser de la lista', () => {
    mal({ ...base, tipo: 'otro' }, /Tipo de solicitud/)
    mal({ ...base, tipo: undefined }, /Tipo de solicitud/)
    mal({ ...base, que: 'Cualquier cosa' }, /Elige qué necesita/)
    mal({ ...base, que: undefined }, /Elige qué necesita/)
  })

  test('nota de máximo 300 caracteres; ni números ni objetos', () => {
    ok({ ...base, nota: 'a'.repeat(MAX_NOTA) })
    mal({ ...base, nota: 'a'.repeat(MAX_NOTA + 1) }, /demasiado larga/)
    mal({ ...base, nota: 123 }, /texto/)
    assert.equal(ok({ ...base, nota: '   ' }).nota, null, 'una nota en blanco es sin nota')
  })

  test('REQUISITO DE SEGURIDAD: con lugar privado es obligatorio decir quién más estará, o "nadie más"', () => {
    mal({ ...base, lugar_privado: true }, /obligatorio indicar quién más estará/)
    mal({ ...base, lugar_privado: true, personas_en_lugar: [] }, /obligatorio/)
    mal({ ...base, lugar_privado: true, nadie_mas: false, personas_en_lugar: [] }, /obligatorio/)
    mal({ ...base, lugar_privado: true, nadie_mas: true, personas_en_lugar: ['Familiar'] }, /debe ir vacía/)
    mal({ ...base, lugar_privado: true, personas_en_lugar: ['Un desconocido'] }, /Tipo de persona/)
    mal({ ...base, lugar_privado: true, personas_en_lugar: 'Familiar' }, /quién más estará/)
    mal({ ...base, lugar_privado: true, personas_en_lugar: Array(11).fill('Familiar') }, /Máximo 10/)
  })

  test('si el lugar no es privado no se aceptan personas, y "lugar privado" debe ser verdadero o falso', () => {
    mal({ ...base, lugar_privado: false, personas_en_lugar: ['Familiar'] }, /cuando el lugar es privado/)
    mal({ ...base, lugar_privado: 'si' }, /lugar es privado/)
    mal({ ...base, lugar_privado: undefined }, /lugar es privado/)
  })

  test('mandado: exige describir qué hacer y una duración de 15, 30 o 60 minutos', () => {
    mal({ tipo: 'mandado', lugar_privado: false, duracion_min: 30 }, /qué quieres que haga/)
    mal({ tipo: 'mandado', nota: 'Algo', lugar_privado: false }, /15, 30 o 60/)
    mal({ tipo: 'mandado', nota: 'Algo', lugar_privado: false, duracion_min: 45 }, /15, 30 o 60/)
    mal({ tipo: 'mandado', nota: 'Algo', lugar_privado: false, duracion_min: '30' }, /15, 30 o 60/)
  })

  test('el texto guardado en `mensaje` junta lo que necesita y la nota', () => {
    assert.equal(mensajeDeSolicitud(ok(base), null), 'Compañía y conversación')
    assert.equal(mensajeDeSolicitud(ok({ ...base, nota: 'Le gusta la misa' }), 'Le gusta la misa'), 'Compañía y conversación. Le gusta la misa')
    assert.equal(mensajeDeSolicitud(ok({ tipo: 'mandado', nota: 'Papeles', duracion_min: 15, lugar_privado: false }), 'Papeles'), 'Mandado de 15 minutos. Papeles')
  })

  test('nombre corto: primer nombre e inicial del apellido', () => {
    assert.equal(nombreCorto('María Pérez'), 'María P.')
    assert.equal(nombreCorto('  ana  gómez ruiz '), 'ana g.'.replace('g.', 'G.'))
    assert.equal(nombreCorto('Rosa'), 'Rosa')
    assert.equal(nombreCorto(''), '')
  })
})

describe('POST /api/solicitudes con el contrato nuevo', () => {
  const mundo = () => {
    const compita = mkCompita({ telegram_chat_id: '9300', nombre: 'María Pérez' })
    const cliente = mkCliente({ nombre: 'Carolina Rojas', email: 'caro@mail.test' })
    session.user = { id: cliente.id, email: cliente.email }
    return { compita, cliente }
  }
  const pedir = (compita: any, extra: Record<string, unknown>) => crear(req('/api/solicitudes', { json: { compita_id: compita.id, ...extra } }))

  test('contratación directa: se crea sin horarios, con los campos nuevos guardados y el evento con su tipo', async () => {
    const { compita } = mundo()
    const r = await pedir(compita, { ...privado, nota: 'Le encanta la misa' })
    assert.equal(r.status, 200)
    const s = db.rows('solicitudes')[0]
    assert.equal(s.tipo, 'directa'); assert.equal(s.que, 'Compañía y conversación'); assert.equal(s.lugar_privado, true)
    assert.deepEqual(s.personas_en_lugar, ['Familiar', 'Vecino o vecina'])
    assert.deepEqual(s.slots_propuestos, [])
    assert.equal(s.estado, 'pendiente')
    assert.equal(s.mensaje, 'Compañía y conversación. Le encanta la misa')
    const e = db.rows('eventos').find((x) => x.tipo === 'solicitud_creada')!
    assert.deepEqual([e.datos.tipo, e.datos.lugar_privado, e.datos.horarios], ['directa', true, 0])
  })

  test('el compita recibe el aviso correcto: primer nombre, qué se hará, personas, sin horarios, botones Aceptar y No puedo', async () => {
    const { compita } = mundo()
    await pedir(compita, privado)
    const m = tgPara(9300)[0]
    assert.match(m.text, /Contratación directa/)
    assert.match(m.text, /<b>Carolina<\/b>/)
    assert.ok(!m.text.includes('Rojas'), 'no ve el apellido del cliente antes de pagar')
    assert.match(m.text, /Qué se hará:<\/b> Compañía y conversación/)
    assert.match(m.text, /Además de su familiar estarán: 1 familiar, 1 vecino o vecina/)
    assert.ok(!/Horarios propuestos|llamada de 20/.test(m.text), 'una directa no lleva horarios')
    const botones = m.markup.inline_keyboard.flat().map((b: any) => b.callback_data)
    assert.equal(botones.length, 2)
    assert.match(botones[0], /^directa:[0-9a-f-]{36}$/); assert.match(botones[1], /^rechazar:[0-9a-f-]{36}$/)
    assert.ok(botones.every((b: string) => b.length <= 64), 'callback_data cabe en 64 bytes')
    assert.equal(emailsA(compita.email).length, 0, 'Telegram primero: no hay correo a la vez')
  })

  test('"nadie más" se muestra como tal y un lugar que no es privado no menciona personas', async () => {
    const { compita } = mundo()
    await pedir(compita, { ...base, lugar_privado: true, nadie_mas: true, personas_en_lugar: [] })
    assert.match(tgPara(9300)[0].text, /Nadie más, solo su familiar/)
    limpiarSolicitud()
    await pedir(compita, base)
    const t = tgPara(9300).at(-1)!.text
    assert.match(t, /¿Lugar privado\?<\/b> No/); assert.ok(!/Personas en el lugar/.test(t))
  })
  const limpiarSolicitud = () => { db.tables.solicitudes = []; net.tg = [] }

  test('REQUISITO DE SEGURIDAD en el servidor: lugar privado sin quién más estará → 400 y no se crea nada', async () => {
    const { compita } = mundo()
    const r = await pedir(compita, { ...base, lugar_privado: true })
    assert.equal(r.status, 400)
    assert.match(JSON.stringify(await r.json()), /obligatorio indicar quién más estará/)
    assert.equal(db.rows('solicitudes').length, 0); assert.equal(tgPara(9300).length, 0)
  })

  test('un teléfono en la nota se censura antes de llegar al compita y se avisa al admin', async () => {
    const { compita } = mundo()
    await pedir(compita, { ...base, nota: 'Llámame al 305 555 1234' })
    const m = tgPara(9300)[0].text
    assert.ok(!m.includes('555 1234') && !m.includes('305 555'), 'el número no llega al compita')
    assert.ok(!db.rows('solicitudes')[0].mensaje.includes('1234'))
    assert.ok(db.rows('admin_flags').length >= 1, 'queda la alerta')
  })

  test('mandado: no pide horarios, guarda la duración en el texto y sale como mandado', async () => {
    const { compita } = mundo()
    const r = await pedir(compita, { tipo: 'mandado', nota: 'Llevar unos papeles a Chacao', duracion_min: 30, lugar_privado: false })
    assert.equal(r.status, 200)
    assert.equal(db.rows('solicitudes')[0].tipo, 'mandado')
    assert.match(tgPara(9300)[0].text, /Mandado[\s\S]*Mandado de 30 minutos\. Llevar unos papeles/)
  })

  test('"Hablar primero" (entrevista) sigue pidiendo 1 a 3 horarios hasta que existan las horas libres del compita', async () => {
    const { compita } = mundo()
    assert.equal((await pedir(compita, { ...base, tipo: 'entrevista' })).status, 400)
    assert.equal((await pedir(compita, { ...base, tipo: 'entrevista', slots_propuestos: [ahoraMas(120)] })).status, 200)
    assert.equal(db.rows('solicitudes')[0].tipo, 'entrevista')
    assert.match(tgPara(9300)[0].text, /Nueva solicitud de entrevista/, 'la entrevista conserva su aviso de siempre')
  })

  test('el contrato anterior (sin "tipo") funciona exactamente igual y no guarda campos nuevos', async () => {
    const { compita } = mundo()
    const r = await pedir(compita, { mensaje: 'Mi mamá vive sola', slots_propuestos: [ahoraMas(120), ahoraMas(240)] })
    assert.equal(r.status, 200)
    const s = db.rows('solicitudes')[0]
    assert.equal(s.tipo, undefined); assert.equal(s.que, undefined)
    assert.match(tgPara(9300)[0].text, /Nueva solicitud de entrevista/)
  })

  test('si el tipo viene pero es inválido no cae al contrato anterior', async () => {
    const { compita } = mundo()
    const r = await pedir(compita, { tipo: 'invento', mensaje: 'x', slots_propuestos: [ahoraMas(120)] })
    assert.equal(r.status, 400)
    assert.equal(db.rows('solicitudes').length, 0)
  })
})

describe('el compita acepta una contratación directa', () => {
  const mundo = () => {
    const compita = mkCompita({ telegram_chat_id: '9400', nombre: 'María Pérez' })
    const cliente = mkCliente({ nombre: 'Carolina Rojas', email: 'caro@mail.test' })
    const sol = mkSolicitud(cliente, compita, { estado: 'pendiente', tipo: 'directa', que: 'Compañía y conversación', lugar_privado: false, slots_propuestos: [], mensaje: 'Compañía y conversación' })
    return { compita, cliente, sol }
  }

  test('acepta: pasa a "aceptada" sin horario ni sala, el cliente recibe el correo de pago y el admin se entera', async () => {
    const { cliente, sol } = mundo()
    await webhook(tgBtn(9400, `directa:${sol.token_respuesta}`))
    const s = db.rows('solicitudes')[0]
    assert.equal(s.estado, 'aceptada'); assert.ok(s.respondido_at)
    assert.ok(!s.slot_confirmado && !s.room_url, 'sin horario ni sala')
    const correo = emailsA(cliente.email)
    assert.equal(correo.length, 1)
    assert.match(correo[0].subject, /María P\. aceptó tu solicitud/)
    assert.ok(!correo[0].subject.includes('Pérez'), 'antes de pagar solo ve la inicial del apellido')
    assert.ok(correo[0].html.includes(`/pago?solicitud=${sol.id}`))
    assert.match(correo[0].html, /nunca te pedirá/i, 'lleva la advertencia antifraude')
    assert.match(tgPara(9400).at(-1)!.text, /Aceptaste/)
    assert.ok(tgPara(999).some((m) => m.text.includes('aceptó una contratación directa')))
    const e = db.rows('eventos').find((x) => x.tipo === 'solicitud_aceptada')!
    assert.deepEqual([e.entidad_id, e.datos.directa], [sol.id, true])
  })

  test('el aviso queda registrado y la acción del compita cancela sus recordatorios pendientes', async () => {
    const { compita, sol } = mundo()
    db.seed('avisos', { destinatario_tipo: 'compita', destinatario_id: compita.id, canal: 'telegram', plantilla: 'solicitud_nueva', entidad: 'solicitud', entidad_id: sol.id, paso: 5, estado: 'enviado', plazo_accion_hasta: ahoraMas(60), clave_unica: 'x' })
    await webhook(tgBtn(9400, `directa:${sol.token_respuesta}`))
    assert.ok(db.rows('avisos').find((a) => a.plantilla === 'solicitud_nueva')!.accion_en, 'la acción quedó anotada')
    const del_cliente = db.rows('avisos').find((a) => a.plantilla === 'directa_aceptada')!
    assert.equal(del_cliente.estado, 'enviado'); assert.equal(del_cliente.canal, 'correo')
  })

  test('un doble toque no duplica nada: un solo correo y un solo evento', async () => {
    const { cliente, sol } = mundo()
    await Promise.all([webhook(tgBtn(9400, `directa:${sol.token_respuesta}`)), webhook(tgBtn(9400, `directa:${sol.token_respuesta}`))])
    assert.equal(emailsA(cliente.email).length, 1)
    assert.equal(db.rows('eventos').filter((x) => x.tipo === 'solicitud_aceptada').length, 1)
    assert.ok(tgPara(9400).some((m) => /ya fue usado/.test(m.text)))
  })

  test('otro compita no puede aceptar una solicitud ajena', async () => {
    const { cliente, sol } = mundo()
    mkCompita({ telegram_chat_id: '9401' })
    await webhook(tgBtn(9401, `directa:${sol.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].estado, 'pendiente')
    assert.match(tgPara(9401).at(-1)!.text, /no es tuya/)
    assert.equal(emailsA(cliente.email).length, 0)
  })

  test('este botón solo sirve para solicitudes directas: una entrevista no se acepta sin horario', async () => {
    const compita = mkCompita({ telegram_chat_id: '9402' }); const cliente = mkCliente()
    const entrevista = mkSolicitud(cliente, compita, { estado: 'pendiente', slots_propuestos: [ahoraMas(120)] })
    await webhook(tgBtn(9402, `directa:${entrevista.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].estado, 'pendiente')
    assert.equal(emailsA(cliente.email).length, 0)
  })

  test('"No puedo" rechaza la solicitud directa y el cliente puede elegir a otro sin haber pagado', async () => {
    const { sol } = mundo()
    await webhook(tgBtn(9400, `rechazar:${sol.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].estado, 'rechazada')
    assert.equal(db.rows('pagos_plan').length, 0, 'no se pagó nada')
  })

  test('tras aceptar, el cliente ya puede entrar a la pantalla de pago de esa solicitud', async () => {
    const { cliente, sol } = mundo()
    await webhook(tgBtn(9400, `directa:${sol.token_respuesta}`))
    session.user = { id: cliente.id, email: cliente.email }
    const r = await pagoInfo(req(`/api/pago/info?solicitud=${sol.id}`))
    assert.equal(r.status, 200)
  })

  test('si el correo al cliente falla, queda como aviso fallido para que la escalera lo reintente', async () => {
    const { cliente, sol } = mundo()
    net.resendFail = true
    await webhook(tgBtn(9400, `directa:${sol.token_respuesta}`))
    assert.equal(db.rows('solicitudes')[0].estado, 'aceptada', 'aceptar no depende del correo')
    assert.equal(db.rows('avisos').find((a) => a.plantilla === 'directa_aceptada')!.estado, 'fallido')
    assert.equal(emailsA(cliente.email).length, 0)
  })
})
