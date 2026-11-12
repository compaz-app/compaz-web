/* eslint-disable */
// "¿Qué me toca?": se deriva del ESTADO REAL al preguntar (nada guardado del último botón). Dice la situación, qué espera de
// otros y si él tiene algo pendiente; solo dice "nada pendiente" si de verdad no hay ni espera ni acción.
import { db, limpiar, mkCliente, mkCompita, mkVisita, mkSolicitud, tgText, tgBtn, tgPara, hoyVEstr } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { situacionDelCompita } from '@/lib/que-me-toca'
import { limpiarCacheAjustes } from '@/lib/ajustes'
import { TECLADO_SIN_VISITA, TECLADO_INICIO, TECLADO_DURANTE_VISITA } from '@/lib/telegram'

const CHAT = '9971'
const HORAS = [{ dia: 'lunes', inicio: '09:00', fin: '10:00' }]
beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const ve = (min: number) => { const t = new Date(Date.now() + min * 60_000 - 4 * 3600_000).toISOString(); return { fecha: t.slice(0, 10), hora: t.slice(11, 16) } }
function base() {
  const compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez', horarios_disponibles: HORAS }); const cliente = mkCliente({ nombre: 'Carolina Pérez Gómez', email: 'caro@mail.test', telefono: '+58 412 000 0000' })
  return { compita, cliente }
}
const visitaEn = (compita: any, cliente: any, min: number, o: any = {}) => { const i = ve(min); return mkVisita(cliente, compita, { estado: 'programada', fecha_programada: i.fecha, hora_inicio_programada: i.hora, hora_fin_programada: (ve(min + 120).fecha === i.fecha ? ve(min + 120).hora : '23:59'), direccion: 'Av. Miranda, Edif. Sol', ...o }) }
const botones = (s: any) => (s.teclado?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data)

describe('"nada pendiente" solo cuando de verdad no hay nada', () => {
  test('sin visitas, solicitudes ni reservas: nada pendiente y sin botones', async () => {
    const { compita } = base(); const s = await situacionDelCompita(compita.id)
    assert.match(s.texto, /Nada pendiente/); assert.equal(s.hayAlgo, false); assert.equal(s.teclado, null)
  })
  test('con una visita próxima NUNCA dice "nada pendiente": explica qué viene y qué no tiene que hacer', async () => {
    const { compita, cliente } = base(); visitaEn(compita, cliente, 3 * 24 * 60)
    const s = await situacionDelCompita(compita.id)
    assert.ok(!/Nada pendiente/.test(s.texto)); assert.equal(s.hayAlgo, true)
    assert.match(s.texto, /Estás esperando/); assert.match(s.texto, /próxima visita es con <b>Carolina<\/b>/); assert.match(s.texto, /3 horas antes/); assert.match(s.texto, /no tienes nada que hacer/)
  })
})

describe('el caso clave: "Llegué y nadie abre"', () => {
  test('explica la espera de 30 minutos, que su tiempo se paga, que espere cerca y cuándo se le avisa', async () => {
    const { compita, cliente } = base(); visitaEn(compita, cliente, -10, { llegada_en: hace(12), sin_acceso_en: hace(7) })
    const s = await situacionDelCompita(compita.id)
    assert.ok(!/Nada pendiente/.test(s.texto))
    assert.match(s.texto, /espera de hasta 30 minutos/); assert.match(s.texto, /van 7, faltan 23/)
    assert.match(s.texto, /tu tiempo se paga/i); assert.match(s.texto, /cobras el viaje/); assert.match(s.texto, /espera cerca/i)
    assert.match(s.texto, /5 y a los 15 minutos/); assert.match(s.texto, /A los 30 minutos te avisamos para cerrar/)
    assert.equal(botones(s).includes('sinacceso:' + db.rows('visitas')[0].id), false, 'todavía no puede cerrar')
  })
  test('pasados los 30 minutos le toca a él: botón para cerrar sin acceso', async () => {
    const { compita, cliente } = base(); const v = visitaEn(compita, cliente, -40, { llegada_en: hace(40), sin_acceso_en: hace(31) })
    const s = await situacionDelCompita(compita.id)
    assert.match(s.texto, /Te toca a ti/); assert.match(s.texto, /Ya pasaron 30 minutos/); assert.deepEqual(botones(s), [`sinacceso:${v.id}`])
  })
  test('el ajuste manda: con 20 minutos de espera el texto dice 20', async () => {
    const { setAjuste } = await import('@/lib/ajustes'); await setAjuste({ clave: 'nadie_abre_espera_min', valor: 20, actor: 'admin:a' }); limpiarCacheAjustes()
    const { compita, cliente } = base(); visitaEn(compita, cliente, -10, { llegada_en: hace(12), sin_acceso_en: hace(5) })
    assert.match((await situacionDelCompita(compita.id)).texto, /hasta 20 minutos.*\(van 5, faltan 15\)/)
  })
})

describe('se deriva del estado real, no del último botón', () => {
  test('la respuesta cambia sola cuando cambia el estado (el cliente avisa que abre, el compita inicia...)', async () => {
    const { compita, cliente } = base(); const v = visitaEn(compita, cliente, -10, { llegada_en: hace(12), sin_acceso_en: hace(7) })
    assert.match((await situacionDelCompita(compita.id)).texto, /espera de hasta 30/)
    v.sin_acceso_en = null // el cliente avisó que ya abre
    const b = await situacionDelCompita(compita.id); assert.ok(!/espera de hasta 30/.test(b.texto)); assert.match(b.texto, /Ya registraste tu llegada/)
    v.estado = 'confirmando_inicio'; assert.match((await situacionDelCompita(compita.id)).texto, /confirme que llegaste/)
    v.estado = 'en_curso'; assert.match((await situacionDelCompita(compita.id)).texto, /Estás en una visita/)
    db.rows('visitas').length = 0; assert.match((await situacionDelCompita(compita.id)).texto, /Nada pendiente/)
  })
  test('no escribe nada en la base al responder (solo lee)', async () => {
    const { compita, cliente } = base(); visitaEn(compita, cliente, -10, { llegada_en: hace(12), sin_acceso_en: hace(7) })
    const antes = JSON.stringify([db.rows('visitas'), db.rows('telegram_estados'), db.rows('avisos'), db.rows('eventos')])
    await situacionDelCompita(compita.id); await situacionDelCompita(compita.id)
    assert.equal(JSON.stringify([db.rows('visitas'), db.rows('telegram_estados'), db.rows('avisos'), db.rows('eventos')]), antes)
  })
})

describe('cada situación de la visita', () => {
  test('ya llegó y falta iniciar: pregunta si le abrieron y ofrece "nadie abre"', async () => {
    const { compita, cliente } = base(); const v = visitaEn(compita, cliente, -5, { llegada_en: hace(5) })
    const s = await situacionDelCompita(compita.id); assert.match(s.texto, /¿Te abrieron\?/); assert.deepEqual(botones(s), [`nadie:${v.id}`])
  })
  test('en curso: cómo terminar y qué hacer si algo no está bien; pasada la hora de fin pregunta si todo bien con sus botones', async () => {
    const { compita, cliente } = base(); const v = mkVisita(cliente, compita, { estado: 'en_curso', fecha_programada: ve(60).fecha, hora_inicio_programada: ve(-60).hora, hora_fin_programada: ve(60).hora })
    let s = await situacionDelCompita(compita.id); assert.match(s.texto, /Terminar visita/); assert.match(s.texto, /No me siento seguro/)
    Object.assign(v, { fecha_programada: ve(-20).fecha, hora_fin_programada: ve(-20).hora })
    s = await situacionDelCompita(compita.id); assert.match(s.texto, /pasó la hora de fin/); assert.deepEqual(botones(s), [`tb:ok:${v.id}`, `tb:ayuda:${v.id}`])
  })
  test('dentro de las 3 horas: con dirección, "Voy en camino"; sin dirección, que ya se avisó al cliente y no debe hacer nada', async () => {
    const { compita, cliente } = base(); const v = visitaEn(compita, cliente, 90)
    let s = await situacionDelCompita(compita.id); assert.match(s.texto, /Ya tienes la dirección/); assert.deepEqual(botones(s), [`camino:${v.id}`])
    v.direccion = null
    s = await situacionDelCompita(compita.id); assert.match(s.texto, /todavía no registró la dirección/); assert.match(s.texto, /Ya le avisamos/); assert.deepEqual(botones(s), [`rc:dir:${v.id}`])
  })
  test('en coordinación (sin fecha): lo que se espera del cliente', async () => {
    const { compita, cliente } = base(); mkVisita(cliente, compita, { estado: 'pre_visita' })
    assert.match((await situacionDelCompita(compita.id)).texto, /coordinando la fecha/)
  })
  test('cambio de quién estará: le toca decidir, con sus botones y sin penalización', async () => {
    const { compita, cliente } = base(); const v = visitaEn(compita, cliente, 3 * 24 * 60)
    db.seed('cambios_lugar', { visita_id: v.id, compita_id: compita.id, cliente_id: cliente.id, despues: [], estado: 'pendiente', vence_en: hace(-60) })
    const s = await situacionDelCompita(compita.id); const c = db.rows('cambios_lugar')[0]
    assert.match(s.texto, /Te toca a ti/); assert.match(s.texto, /quién estará/); assert.match(s.texto, /Sin penalización/)
    assert.deepEqual(botones(s), [`lugar:ok:${c.id}`, `lugar:no:${c.id}`])
  })
})

describe('solicitudes y reservas', () => {
  test('una solicitud sin responder: le toca a él, con los mismos botones del aviso original', async () => {
    const { compita, cliente } = base(); const sol = mkSolicitud(cliente, compita, { tipo: 'directa', que: 'Compañía y conversación', slots_propuestos: [] })
    const s = await situacionDelCompita(compita.id)
    assert.match(s.texto, /Te toca a ti/); assert.match(s.texto, /quiere contratarte directamente/); assert.deepEqual(botones(s), [`directa:${sol.token_respuesta}`, `rechazar:${sol.token_respuesta}`])
  })
  test('una hora reservada por confirmar: le toca a él, con Confirmar y No puedo', async () => {
    const { compita, cliente } = base()
    const r = db.seed('reservas_horario', { compita_id: compita.id, cliente_id: cliente.id, inicio: ve(300).fecha + 'T15:00:00.000Z', fin: ve(300).fecha + 'T15:20:00.000Z', estado: 'reservada', vence_en: new Date(Date.now() + 3600_000).toISOString() })
    const s = await situacionDelCompita(compita.id); assert.match(s.texto, /falta que la confirmes/); assert.deepEqual(botones(s), [`reserva:ok:${r.id}`, `reserva:no:${r.id}`])
  })
  test('esperando al cliente: elegir hora, videollamada ya confirmada, o su pago', async () => {
    const { compita, cliente } = base()
    const sol = mkSolicitud(cliente, compita, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [] })
    assert.match((await situacionDelCompita(compita.id)).texto, /eligiendo una de tus horas libres/)
    Object.assign(sol, { slot_confirmado: new Date(Date.now() + 5 * 3600_000).toISOString() })
    assert.match((await situacionDelCompita(compita.id)).texto, /videollamada con <b>Carolina<\/b>/)
    Object.assign(sol, { tipo: 'directa', slot_confirmado: null })
    assert.match((await situacionDelCompita(compita.id)).texto, /Esperamos su pago/)
    mkVisita(cliente, compita, { estado: 'pre_visita' })
    assert.ok(!/Esperamos su pago/.test((await situacionDelCompita(compita.id)).texto), 'si ya pagó y hay visita, deja de esperar el pago')
  })
})

describe('orden, privacidad y aislamiento', () => {
  test('lo que le toca a él va primero y lo que espera de otros después, separado', async () => {
    const { compita, cliente } = base(); visitaEn(compita, cliente, 3 * 24 * 60); mkSolicitud(mkCliente({ nombre: 'Luis Ramos', email: 'luis@mail.test' }), compita, { tipo: 'mandado', slots_propuestos: [] })
    const s = await situacionDelCompita(compita.id)
    assert.ok(s.texto.indexOf('Te toca a ti') >= 0 && s.texto.indexOf('Te toca a ti') < s.texto.indexOf('Y estás esperando'))
    assert.match(s.texto, /Y estás esperando/)
  })
  test('solo muestra el primer nombre del cliente: nunca apellido, correo ni teléfono', async () => {
    const { compita, cliente } = base(); visitaEn(compita, cliente, 90, { contacto_tel: '+58 414 555 0101', contacto_nombre: 'Rosa Linares' })
    mkSolicitud(cliente, compita, { tipo: 'directa', slots_propuestos: [] })
    const t = (await situacionDelCompita(compita.id)).texto
    assert.ok(!/Pérez|Gómez|caro@mail|555|0000|Rosa Linares/.test(t), t)
  })
  test('no mezcla lo de otro compita', async () => {
    const { compita, cliente } = base(); const otro = mkCompita({ telegram_chat_id: '9981', horarios_disponibles: HORAS }); visitaEn(otro, cliente, -10, { llegada_en: hace(12), sin_acceso_en: hace(7) })
    assert.match((await situacionDelCompita(compita.id)).texto, /Nada pendiente/)
  })
  test('sin guiones de viñeta en el texto', async () => {
    const { compita, cliente } = base(); visitaEn(compita, cliente, -10, { llegada_en: hace(12), sin_acceso_en: hace(7) }); mkSolicitud(mkCliente({ email: 'o@m.test' }), compita, { tipo: 'directa', slots_propuestos: [] })
    assert.ok(!/^\s*[-–—]\s/m.test((await situacionDelCompita(compita.id)).texto))
  })
})

describe('en el bot', () => {
  test('el botón está en TODOS los teclados', () => {
    for (const t of [TECLADO_SIN_VISITA, TECLADO_INICIO, TECLADO_DURANTE_VISITA]) assert.ok(t.keyboard.flat().some((b: any) => b.text === '❓ ¿Qué me toca?'))
  })
  test('al tocarlo responde la situación real (y con botones si hay algo que hacer); también por callback', async () => {
    const { compita, cliente } = base(); const sol = mkSolicitud(cliente, compita, { tipo: 'directa', slots_propuestos: [] })
    await webhook(tgText(CHAT, '❓ ¿Qué me toca?'))
    let m = tgPara(CHAT).at(-1)!; assert.match(m.text, /quiere contratarte directamente/)
    assert.deepEqual((m.markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data), [`directa:${sol.token_respuesta}`, `rechazar:${sol.token_respuesta}`])
    db.rows('solicitudes').length = 0
    await webhook(tgBtn(CHAT, 'qmt')); m = tgPara(CHAT).at(-1)!; assert.match(m.text, /Nada pendiente/)
    assert.ok(m.markup?.keyboard, 'sin nada que hacer vuelve el teclado normal')
  })
  test('quien no es compita no obtiene nada', async () => {
    await webhook(tgText('5550001', '❓ ¿Qué me toca?')); assert.ok(!tgPara('5550001').some((m) => /Te toca a ti|Nada pendiente/.test(m.text)))
  })
})
