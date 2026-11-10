/* eslint-disable */
// Lote 3 (tramo 1): horas libres, reservas con restricción única y husos horarios.
import { db, limpiar, mkCliente, mkCompita, mkSolicitud, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { generarBloques, horasLibres, reservarHorario, confirmarReserva, rechazarReserva, liberarReserva, liberarVencidas } from '@/lib/agenda'
import { dosHoras, zonaValida } from '@/lib/zonas'
import { setAjuste, limpiarCacheAjustes } from '@/lib/ajustes'

beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
// Lunes-o-lo-que-sea 2026-11-09 a las 08:00 en Caracas (12:00 UTC).
const AHORA = new Date(Date.UTC(2026, 10, 9, 12, 0))
const hoy = DIAS[new Date(Date.UTC(2026, 10, 9)).getUTCDay()]
const manana = DIAS[new Date(Date.UTC(2026, 10, 10)).getUTCDay()]
// 09:00 VE de hoy = 13:00 UTC
const ve = (dia: number, h: number, m = 0) => new Date(Date.UTC(2026, 10, dia, h + 4, m)).toISOString()
const compitaConHoras = (o: any = {}) => mkCompita({ horarios_disponibles: [{ dia: hoy, inicio: '09:00', fin: '10:00' }, { dia: manana, inicio: '09:00', fin: '09:40' }], ...o })
const libres = async (c: any) => (await horasLibres(c.id, { ahora: AHORA, dias: 2 })).map((b) => b.inicio)

describe('generarBloques', () => {
  test('parte las franjas en bloques de 20 minutos en hora de Venezuela', () => {
    const b = generarBloques([{ dia: hoy as any, inicio: '09:00', fin: '10:00' }], AHORA, 1)
    assert.deepEqual(b.map((x) => x.inicio), [ve(9, 9), ve(9, 9, 20), ve(9, 9, 40)])
    assert.equal(new Date(b[0].fin).toISOString(), ve(9, 9, 20))
  })
  test('un bloque que no cabe entero en la franja no se ofrece', () => {
    assert.equal(generarBloques([{ dia: hoy as any, inicio: '09:00', fin: '09:30' }], AHORA, 1).length, 1)
  })
  test('usa el día de la semana de Caracas, no el de UTC (cerca de la medianoche)', () => {
    // 22:30 del 9 en Caracas ya es el 10 en UTC; el día de Caracas sigue siendo el 9.
    const tarde = new Date(Date.UTC(2026, 10, 10, 2, 30))
    const b = generarBloques([{ dia: hoy as any, inicio: '23:00', fin: '23:40' }], tarde, 1)
    assert.deepEqual(b.map((x) => x.inicio), [ve(9, 23), ve(9, 23, 20)])
  })
  test('sin franjas no hay bloques', () => { assert.deepEqual(generarBloques(null, AHORA), []); assert.deepEqual(generarBloques([], AHORA), []) })
})

describe('horasLibres', () => {
  test('ofrece las horas que aún no pasaron, de hoy y mañana', async () => {
    const c = compitaConHoras()
    assert.deepEqual(await libres(c), [ve(9, 9), ve(9, 9, 20), ve(9, 9, 40), ve(10, 9), ve(10, 9, 20)])
  })
  test('lo pasado no se ofrece', async () => {
    const c = compitaConHoras()
    const r = await horasLibres(c.id, { ahora: new Date(Date.UTC(2026, 10, 9, 13, 10)) }) // 09:10 VE
    assert.ok(!r.some((b) => b.inicio === ve(9, 9)))
    assert.ok(r.some((b) => b.inicio === ve(9, 9, 20)))
  })
  test('la anticipación mínima de Ajustes se respeta', async () => {
    const c = compitaConHoras()
    await setAjuste({ clave: 'entrevista_anticipacion_horas', valor: 2, actor: 'admin:a' }) // hasta las 10:00 VE
    assert.deepEqual(await libres(c), [ve(10, 9), ve(10, 9, 20)])
  })
  test('una reserva viva, una entrevista confirmada y una visita programada ocupan la hora', async () => {
    const c = compitaConHoras(); const cli = mkCliente()
    db.seed('reservas_horario', { compita_id: c.id, cliente_id: cli.id, inicio: ve(9, 9), fin: ve(9, 9, 20), vence_en: new Date(AHORA.getTime() + 3600_000).toISOString() })
    db.seed('solicitudes', { cliente_id: cli.id, compita_id: c.id, estado: 'aceptada', slot_confirmado: ve(9, 9, 20), mensaje: 'x' })
    db.rows('visitas').push(...[{ id: 'v1', compita_id: c.id, usuario_id: cli.id, estado: 'programada', fecha_programada: '2026-11-10', hora_inicio_programada: '09:00', hora_fin_programada: '09:20' }])
    assert.deepEqual(await libres(c), [ve(9, 9, 40), ve(10, 9, 20)])
  })
  test('una reserva vencida ya no ocupa la hora', async () => {
    const c = compitaConHoras(); const cli = mkCliente()
    db.seed('reservas_horario', { compita_id: c.id, cliente_id: cli.id, inicio: ve(9, 9), fin: ve(9, 9, 20), vence_en: new Date(AHORA.getTime() - 1000).toISOString() })
    assert.ok((await libres(c)).includes(ve(9, 9)))
  })
})

describe('reservarHorario', () => {
  const pedir = (c: any, cli: any, sol: any, inicio: string, ahora = AHORA) => reservarHorario({ compitaId: c.id, clienteId: cli.id, solicitudId: sol?.id ?? null, inicio, ahora })

  test('reserva una hora libre y deja el evento', async () => {
    const c = compitaConHoras(); const cli = mkCliente(); const sol = mkSolicitud(cli, c)
    const r = await pedir(c, cli, sol, ve(9, 9, 20))
    assert.ok(r.ok && r.reserva.estado === 'reservada', JSON.stringify(r))
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'horario_reservado' && e.entidad_id === sol.id))
    assert.ok(!(await libres(c)).includes(ve(9, 9, 20)), 'ya no está libre')
  })

  test('dura 2 horas (Ajustes) pero nunca más allá de la hora de la cita', async () => {
    const c = compitaConHoras(); const cli = mkCliente()
    const lejos = await pedir(c, cli, mkSolicitud(cli, c), ve(10, 9)) // mañana: 2 h exactas desde AHORA
    assert.ok(lejos.ok && new Date(lejos.reserva.vence_en).getTime() === AHORA.getTime() + 2 * 3600_000)
    const cli2 = mkCliente({ email: 'o@x.test' })
    const cerca = await pedir(c, cli2, mkSolicitud(cli2, c), ve(9, 9, 40)) // en 1 h 40 min: vence al llegar la hora
    assert.ok(cerca.ok && cerca.reserva.vence_en === ve(9, 9, 40))
  })

  test('dos clientes por la misma hora: solo gana uno y el otro recibe "ocupada"', async () => {
    const c = compitaConHoras(); const a = mkCliente({ email: 'a@x.test' }); const b = mkCliente({ email: 'b@x.test' })
    const [r1, r2] = await Promise.all([pedir(c, a, mkSolicitud(a, c), ve(9, 9, 20)), pedir(c, b, mkSolicitud(b, c), ve(9, 9, 20))])
    assert.equal([r1, r2].filter((r) => r.ok).length, 1)
    const perdedor = [r1, r2].find((r) => !r.ok)!
    assert.ok(!perdedor.ok && ['ocupada', 'no_disponible'].includes(perdedor.motivo))
    assert.equal(db.rows('reservas_horario').filter((r) => r.estado === 'reservada').length, 1)
  })

  test('la base misma rechaza la hora duplicada aunque el código no lo viera (índice único)', async () => {
    const c = compitaConHoras(); const a = mkCliente({ email: 'a@x.test' }); const b = mkCliente({ email: 'b@x.test' })
    db.seed('reservas_horario', { compita_id: c.id, cliente_id: a.id, inicio: ve(9, 9), fin: ve(9, 9, 20), vence_en: ve(9, 9) })
    assert.throws(() => db.seed('reservas_horario', { compita_id: c.id, cliente_id: b.id, inicio: ve(9, 9), fin: ve(9, 9, 20), vence_en: ve(9, 9) }) && (() => { throw new Error('no debería llegar') })() , /./)
  })

  test('una hora fuera de las franjas, mal formada o que no cae en un bloque no se reserva', async () => {
    const c = compitaConHoras(); const cli = mkCliente()
    for (const mala of [ve(9, 14), 'no-es-fecha', ve(9, 9, 5), new Date(AHORA.getTime() - 86400_000).toISOString()]) {
      const r = await pedir(c, cli, null, mala)
      assert.equal(r.ok, false, mala)
    }
    assert.equal(db.rows('reservas_horario').length, 0)
  })

  test('una solicitud no puede tener dos horas reservadas a la vez', async () => {
    const c = compitaConHoras(); const cli = mkCliente(); const sol = mkSolicitud(cli, c)
    assert.ok((await pedir(c, cli, sol, ve(9, 9))).ok)
    const r2 = await pedir(c, cli, sol, ve(9, 9, 20))
    assert.ok(!r2.ok && r2.motivo === 'solicitud_con_reserva')
  })

  test('una reserva vencida y olvidada no bloquea la hora: otro cliente la puede tomar', async () => {
    const c = compitaConHoras(); const a = mkCliente({ email: 'a@x.test' }); const b = mkCliente({ email: 'b@x.test' })
    await pedir(c, a, mkSolicitud(a, c), ve(10, 9))
    const pasadas2h = new Date(AHORA.getTime() + 3 * 3600_000)
    const r = await reservarHorario({ compitaId: c.id, clienteId: b.id, solicitudId: null, inicio: ve(10, 9), ahora: pasadas2h })
    assert.ok(r.ok)
    assert.ok(db.rows('reservas_horario').some((x) => x.cliente_id === a.id && x.estado === 'vencida'))
  })
})

describe('responder a la reserva', () => {
  const montar = async () => {
    const c = compitaConHoras(); const cli = mkCliente(); const sol = mkSolicitud(cli, c)
    const r = await reservarHorario({ compitaId: c.id, clienteId: cli.id, solicitudId: sol.id, inicio: ve(9, 9, 20), ahora: AHORA })
    assert.ok(r.ok)
    return { c, cli, sol, reserva: (r as any).reserva }
  }
  test('confirmar la deja confirmada y la hora sigue ocupada', async () => {
    const { c, reserva } = await montar()
    const r = await confirmarReserva(reserva.id, c.id, AHORA)
    assert.ok(r.ok && r.reserva.estado === 'confirmada')
    assert.ok(!(await libres(c)).includes(ve(9, 9, 20)))
    assert.ok(db.rows('eventos').some((e) => e.tipo === 'reserva_confirmada'))
  })
  test('rechazar libera la hora para otros', async () => {
    const { c, reserva } = await montar()
    assert.ok((await rechazarReserva(reserva.id, c.id, AHORA)).ok)
    assert.ok((await libres(c)).includes(ve(9, 9, 20)))
  })
  test('solo responde el compita dueño, una sola vez', async () => {
    const { c, reserva } = await montar()
    const otro = mkCompita()
    assert.ok(!(await confirmarReserva(reserva.id, otro.id, AHORA)).ok)
    assert.ok((await confirmarReserva(reserva.id, c.id, AHORA)).ok)
    const de_nuevo = await rechazarReserva(reserva.id, c.id, AHORA)
    assert.ok(!de_nuevo.ok && de_nuevo.motivo === 'ya_resuelta')
  })
  test('después de vencida ya no se puede confirmar', async () => {
    const { c, reserva } = await montar()
    const r = await confirmarReserva(reserva.id, c.id, new Date(AHORA.getTime() + 3 * 3600_000))
    assert.ok(!r.ok && r.motivo === 'vencida')
    assert.equal(db.rows('reservas_horario')[0].estado, 'vencida')
  })
  test('el cliente puede soltar la hora y vuelve a estar libre; otro cliente no puede soltarla', async () => {
    const { c, cli, reserva } = await montar()
    assert.equal(await liberarReserva(reserva.id, mkCliente({ email: 'otro@x.test' }).id), false)
    assert.equal(await liberarReserva(reserva.id, cli.id), true)
    assert.ok((await libres(c)).includes(ve(9, 9, 20)))
  })
  test('liberarVencidas devuelve las que venció para poder avisar al cliente', async () => {
    const { reserva, cli } = await montar()
    const v = await liberarVencidas(new Date(AHORA.getTime() + 3 * 3600_000))
    assert.deepEqual(v.map((x) => x.id), [reserva.id])
    assert.equal(v[0].cliente_id, cli.id)
    assert.deepEqual(await liberarVencidas(new Date(AHORA.getTime() + 4 * 3600_000)), [], 'no se repite')
  })
})

describe('husos horarios', () => {
  test('Miami en invierno (UTC-5): una hora menos que Caracas', () => {
    const d = dosHoras('2026-11-05T14:00:00Z', 'America/New_York') // 10:00 en Caracas
    assert.equal(d.caracas.hora, '10:00 am'); assert.equal(d.local!.hora, '9:00 am'); assert.equal(d.otroDia, false)
    assert.equal(d.texto, '9:00 am tu hora (New York) · 10:00 am hora de Caracas')
  })
  test('Miami en verano (UTC-4): misma hora que Caracas, se muestra una sola', () => {
    const d = dosHoras('2026-10-29T14:00:00Z', 'America/New_York')
    assert.equal(d.local, null); assert.equal(d.texto, '10:00 am hora de Caracas')
  })
  test('el cambio de horario de verano de EE.UU. (1 de noviembre) mueve la diferencia', () => {
    const antes = dosHoras('2026-10-31T14:00:00Z', 'America/New_York'); const despues = dosHoras('2026-11-02T14:00:00Z', 'America/New_York')
    assert.equal(antes.local, null); assert.equal(despues.local!.hora, '9:00 am')
  })
  test('Madrid: +5 h en invierno y +6 h en verano respecto a Caracas', () => {
    assert.equal(dosHoras('2026-11-05T14:00:00Z', 'Europe/Madrid').local!.hora, '3:00 pm')
    assert.equal(dosHoras('2026-10-20T14:00:00Z', 'Europe/Madrid').local!.hora, '4:00 pm')
  })
  test('avisa cuando en la zona del cliente ya es otro día', () => {
    const d = dosHoras('2026-11-06T02:00:00Z', 'Europe/Madrid') // 22:00 del 5 en Caracas, 03:00 del 6 en Madrid
    assert.equal(d.otroDia, true); assert.match(d.texto, /vie|6/)
  })
  test('sin zona, o una zona inventada, muestra solo Caracas', () => {
    for (const z of [null, undefined, '', 'Marte/Olimpo', 'drop table', 'America/Caracas']) assert.equal(dosHoras('2026-11-05T14:00:00Z', z as any).local, null, String(z))
  })
  test('zonaValida acepta zonas reales y rechaza el resto', () => {
    assert.equal(zonaValida('America/New_York'), 'America/New_York'); assert.equal(zonaValida('Mars/X'), null); assert.equal(zonaValida(5), null)
  })
})
