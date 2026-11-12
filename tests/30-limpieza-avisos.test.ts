// Limpieza diaria: los avisos tienen retención de 90 días y los contadores del acceso no crecen sin fin.
import { db, limpiar, cron, ahoraMas } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as limpieza } from '@/app/api/cron/limpieza/route'

beforeEach(limpiar)

const hace = (dias: number) => ahoraMas(-dias * 24 * 60)
const aviso = (estado: string, dias: number) =>
  db.seed('avisos', { destinatario_tipo: 'admin', canal: 'telegram', plantilla: 'x', estado, creado_en: hace(dias) })
const estados = () => db.rows('telegram_estados').map((e) => e.chat_id as string).filter((c) => c !== 'cron:limpieza') // el propio latido de la limpieza no cuenta

describe('retención de avisos (90 días)', () => {
  test('borra los avisos terminados de más de 90 días y conserva el resto', async () => {
    aviso('enviado', 100); aviso('cancelado', 100); aviso('fallido', 100)
    aviso('enviado', 10)
    const pendiente = aviso('pendiente', 100)
    const r = await limpieza(cron('l'))
    assert.equal(r.status, 200)
    const quedan = db.rows('avisos')
    assert.equal(quedan.length, 2)
    assert.ok(quedan.includes(pendiente), 'un aviso pendiente nunca se borra, por viejo que sea')
    assert.ok(quedan.some((a) => a.estado === 'enviado'), 'los recientes se conservan')
  })
})

describe('contadores del acceso', () => {
  test('borra los contadores vencidos y conserva los vigentes', async () => {
    const vencido = new Date(Date.now() - 3600_000).toISOString()
    const vigente = new Date(Date.now() + 3600_000).toISOString()
    db.seed('telegram_estados', { chat_id: 'acc_ip:1.1.1.1', pendiente_expira: vencido })
    db.seed('telegram_estados', { chat_id: 'cod_ip:2.2.2.2', pendiente_expira: vencido })
    db.seed('telegram_estados', { chat_id: 'cod_fallos:a@mail.test', pendiente_expira: vencido })
    db.seed('telegram_estados', { chat_id: 'acc_ip:3.3.3.3', pendiente_expira: vigente })
    db.seed('telegram_estados', { chat_id: 'cod_fallos:b@mail.test', pendiente_expira: vigente })
    await limpieza(cron('l'))
    assert.deepEqual(estados().sort(), ['acc_ip:3.3.3.3', 'cod_fallos:b@mail.test'])
  })

  test('el cooldown por correo se borra pasado un día y no antes', async () => {
    db.seed('telegram_estados', { chat_id: 'acc_mail:viejo@mail.test', updated_at: new Date(Date.now() - 2 * 86400_000).toISOString() })
    db.seed('telegram_estados', { chat_id: 'acc_mail:nuevo@mail.test', updated_at: new Date().toISOString() })
    await limpieza(cron('l'))
    assert.deepEqual(estados(), ['acc_mail:nuevo@mail.test'])
  })

  test('no toca otras filas de control (latidos de los crons)', async () => {
    db.seed('telegram_estados', { chat_id: 'cron:seguimiento', updated_at: new Date(Date.now() - 5 * 86400_000).toISOString() })
    await limpieza(cron('l'))
    assert.deepEqual(estados(), ['cron:seguimiento'])
  })
})
