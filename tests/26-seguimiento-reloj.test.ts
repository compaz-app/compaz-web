/* eslint-disable */
// Pregunta de contratar por reloj: ya no espera al compita ni 4 horas.
// El cliente es quien decide, así que si él confirmó la llamada se le pregunta a los 45 min del horario,
// y si nadie respondió, a los 90 min (antes 4 h). La causa de la prueba real fue esa espera.
import { db, limpiar, cron, emailsA, ahoraMas, mkCompita, mkCliente, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as seguimiento } from '@/app/api/cron/seguimiento/route'

beforeEach(limpiar)

const hace = (min: number) => ahoraMas(-min)
const decision = () => emailsA('cli@mail.test').filter((e) => e.subject.includes('¿Cómo te fue'))
const caso = (o: Record<string, any>) => {
  const compita = mkCompita({ telegram_chat_id: '950' })
  const cli = mkCliente({ email: 'cli@mail.test' })
  return mkSolicitud(cli, compita, { estado: 'aceptada', confirmacion_llamada_enviada: true, ...o })
}

describe('el cliente confirmó y el compita no respondió', () => {
  test('a los 50 min del horario se le pregunta si contrata, sin esperar al compita', async () => {
    caso({ slot_confirmado: hace(50), confirmacion_cliente: true, confirmacion_compita: null })
    await seguimiento(cron('s')); await seguimiento(cron('s'))
    assert.equal(decision().length, 1, 'una sola pregunta, sin duplicar')
  })

  test('antes de los 45 min todavía no', async () => {
    caso({ slot_confirmado: hace(30), confirmacion_cliente: true, confirmacion_compita: null })
    await seguimiento(cron('s'))
    assert.equal(decision().length, 0)
  })

  test('si el compita dijo que NO ocurrió, no se pregunta por contratar', async () => {
    caso({ slot_confirmado: hace(50), confirmacion_cliente: true, confirmacion_compita: false })
    await seguimiento(cron('s'))
    assert.equal(decision().length, 0)
  })
})

describe('nadie respondió', () => {
  test('a los 100 min se pregunta (antes había que esperar 4 horas)', async () => {
    caso({ slot_confirmado: hace(100), confirmacion_cliente: null, confirmacion_compita: null })
    await seguimiento(cron('s'))
    assert.equal(decision().length, 1)
  })

  test('a los 60 min todavía no', async () => {
    caso({ slot_confirmado: hace(60), confirmacion_cliente: null, confirmacion_compita: null })
    await seguimiento(cron('s'))
    assert.equal(decision().length, 0)
  })

  test('marca el seguimiento como enviado para no repetirlo', async () => {
    caso({ slot_confirmado: hace(100), confirmacion_cliente: null, confirmacion_compita: null })
    await seguimiento(cron('s'))
    assert.equal(db.rows('solicitudes')[0].seguimiento_enviado, true)
  })
})
