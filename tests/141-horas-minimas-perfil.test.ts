/* eslint-disable */
// Entrega 3: sin al menos 2 horas libres por semana no hay perfil. Sin ellas el sistema no tiene nada que ofrecer al cliente.
import { db, net, limpiar, req, tgBtn, tgText, tgPara, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validarPerfil } from '@/lib/validar'
import { getCompitasActivas } from '@/lib/compitas'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { tarjetaDelEstado } from '@/lib/portal-estados'

beforeEach(limpiar)
const UNA_HORA = [{ dia: 'lunes', inicio: '09:00', fin: '10:00' }]
const DOS_HORAS = [{ dia: 'lunes', inicio: '09:00', fin: '11:00' }]
const base = { descripcion: 'Cuidadora', servicios: ['Compañía'] }

describe('al registrarse y al editar', () => {
  test('el registro exige 2 horas libres por semana, con un mensaje que explica para qué', () => {
    for (const h of [undefined, [], UNA_HORA]) {
      const r = validarPerfil({ ...base, ...(h === undefined ? {} : { horarios_disponibles: h }) }, { permitirNombre: true, exigirHorarios: true })
      assert.equal(r.ok, false); assert.match((r as any).error, /al menos 2 horas libres por semana/); assert.match((r as any).error, /elegir su entrevista/)
    }
    assert.equal(validarPerfil({ ...base, horarios_disponibles: DOS_HORAS }, { permitirNombre: true, exigirHorarios: true }).ok, true)
  })
  test('al editar con el enlace: si manda horas, deben llegar al mínimo; sin la opción (el equipo, otros campos) no se exige', () => {
    assert.equal(validarPerfil({ horarios_disponibles: UNA_HORA }, { exigirHorarios: true }).ok, false)
    assert.equal(validarPerfil({ descripcion: 'x' }, {}).ok, true)
    const r = readFileSync('app/api/compita/perfil/route.ts', 'utf8'); assert.match(r, /exigirHorarios: body\.horarios_disponibles !== undefined/)
    for (const f of ['app/api/onboarding/registrar/route.ts', 'lib/onboarding-compita.ts']) assert.match(readFileSync(f, 'utf8'), /exigirHorarios: true/, f)
  })
})

describe('quién aparece', () => {
  test('el marketplace solo lista a quien tiene al menos 2 horas libres (los de demostración quedan exentos)', async () => {
    mkCompita({ nombre: 'Con horas', horarios_disponibles: DOS_HORAS })
    mkCompita({ nombre: 'Con una hora', horarios_disponibles: UNA_HORA })
    mkCompita({ nombre: 'Sin horas', horarios_disponibles: [] })
    mkCompita({ nombre: 'Demo', horarios_disponibles: [], es_demo: true })
    const nombres = (await getCompitasActivas()).map((c) => c.nombre).sort()
    assert.deepEqual(nombres, ['Con horas', 'Demo'])
  })
  test('Telegram no se activa sin las horas: el mensaje dice qué falta', async () => {
    mkCompita({ nombre: 'Ana Gómez', email: 'ana@mail.test', telegram_chat_id: null, verificado: false, horarios_disponibles: [] })
    await webhook(tgText(7200, '/start')); await webhook(tgText(7200, 'Ana Gómez'))
    assert.ok(tgPara(7200).some((m) => /2 horas libres por semana/.test(m.text)))
    assert.ok(!db.rows('compitas')[0].telegram_chat_id)
  })
})

describe('cuando no queda ninguna hora', () => {
  test('el compita que acepta sin horas libres lo sabe ya, con el botón para agregarlas', async () => {
    const cmp = mkCompita({ telegram_chat_id: '7300', horarios_disponibles: [] }); const cli = mkCliente({ email: 'c@mail.test' })
    const sol = mkSolicitud(cli, cmp, { estado: 'pendiente', tipo: 'entrevista', slots_propuestos: [], token_respuesta: 'tk-73' })
    await webhook(tgBtn(7300, 'directa:tk-73'))
    const aviso = tgPara(7300).find((m) => /no tienes horas libres/.test(m.text))!
    assert.ok(aviso); assert.ok(aviso.markup.inline_keyboard.flat().some((b: any) => b.callback_data === 'mis_horas'))
    void sol
  })
  test('el cliente que espera tiene el botón «No hay horas que me sirvan» (avisa al equipo)', () => {
    const t = tarjetaDelEstado({ estado: { codigo: 'elegir_horario', paso: 1, solicitudId: 's1', compitaNombre: 'Lucía Pérez' }, pagado: false } as any)
    assert.equal(t.secundario?.texto, 'No hay horas que me sirvan'); assert.deepEqual(t.secundario?.destino, { accion: 'avisar_equipo' }); assert.ok(t.secundario?.info)
  })
})

describe('las pantallas lo dicen', () => {
  test('el registro y la edición avisan del mínimo antes de guardar', () => {
    for (const f of ['app/compita/perfil/EditarPerfil.tsx', 'app/onboarding/page.tsx']) assert.match(readFileSync(f, 'utf8'), /al menos 2 horas por semana/, f)
    assert.match(readFileSync('app/compita/perfil/EditarPerfil.tsx', 'utf8'), /mínimo de 2 horas \(6 bloques\)/)
  })
})
