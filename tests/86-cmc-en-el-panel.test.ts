/* eslint-disable */
// Integración del CMC de Luis con el panel nuevo: la ficha del compita muestra su estado en el CMC y, si el CMC no lo permite, el panel no deja verificarlo ni activarlo.
import { db, limpiar, session, req, mkCompita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { estadoCmc, pasosActivacion, cmcPermiteActivar } from '@/lib/cmc-estado'
import { fichaDePersona } from '@/lib/panel-personas'
import { registrarCompitaManual } from '@/lib/acciones-equipo'
import { POST as toggleVerificado } from '@/app/api/admin/toggle-verificado/route'
import { POST as toggleEstado } from '@/app/api/admin/toggle-estado/route'
import { TODOS } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const admin: Actor = { id: 'u1', correo: 'admin@compaz.test', rol: 'admin', permisos: TODOS } as Actor
const base = { codigo: null, cmc_permite: null, cmc_estado: null, cmc_actualizado_en: null, telegram_chat_id: null, foto_url: null, descripcion: null, servicios: [], horarios_disponibles: [], estado: 'inactivo', verificado: false } as any

describe('estado en el CMC (lógica pura)', () => {
  test('un compita anterior al CMC no tiene estado: todo sigue como antes', () => {
    assert.equal(estadoCmc(base), null)
    assert.equal(estadoCmc({ ...base, codigo: 'COM-0025' }), null)
    assert.equal(cmcPermiteActivar(null), true)
  })
  test('con CMC: código, permiso, estado y lo que falta', () => {
    const e = estadoCmc({ ...base, codigo: 'COM-0025', cmc_permite: true, cmc_estado: 'Activo' })!
    assert.equal(e.codigo, 'COM-0025'); assert.equal(e.permite, true); assert.equal(e.estado, 'Activo')
    assert.equal(e.pasos.find((p) => p.texto === 'Permitida por el CMC')!.listo, true)
    assert.equal(e.pasos.filter((p) => !p.listo).length, 6)
    assert.equal(pasosActivacion({ ...base, cmc_permite: true, telegram_chat_id: '1', foto_url: 'x', descripcion: 'hola', servicios: ['a'], horarios_disponibles: [{}], estado: 'activo', verificado: true }).every((p) => p.listo), true)
  })
  test('si el CMC no permite, no se puede verificar ni activar', () => {
    assert.equal(cmcPermiteActivar(estadoCmc({ ...base, codigo: 'COM-0025', cmc_permite: false })), false)
    assert.equal(cmcPermiteActivar(estadoCmc({ ...base, codigo: 'COM-0025', cmc_permite: true })), true)
  })
})

describe('en la ficha y en las acciones del panel', () => {
  test('la ficha del compita trae su estado en el CMC (y no el de uno anterior al CMC)', async () => {
    const c = mkCompita({ codigo: 'COM-0025', cmc_permite: false, cmc_estado: 'Pausa' } as any)
    const f = (await fichaDePersona(admin, 'compita', c.id))!
    assert.equal(f.cmc!.codigo, 'COM-0025'); assert.equal(f.cmc!.permite, false)
    const viejo = mkCompita({} as any)
    assert.equal((await fichaDePersona(admin, 'compita', viejo.id))!.cmc, null)
  })
  test('el servidor rechaza verificar o activar a quien el CMC no permite, pero deja quitar la verificación', async () => {
    const c = mkCompita({ codigo: 'COM-0025', cmc_permite: false, estado: 'inactivo', verificado: false } as any)
    session.user = { id: 'adm', email: 'admin@compaz.test' }
    assert.equal((await toggleVerificado(req('/api/admin/toggle-verificado', { json: { compita_id: c.id, verificado: true } }))).status, 409)
    assert.equal((await toggleEstado(req('/api/admin/toggle-estado', { json: { compita_id: c.id, estado: 'activo' } }))).status, 409)
    assert.equal(db.rows('compitas')[0].verificado, false)
  })
  test('la alta manual no duplica un perfil que ya existe desde el CMC', async () => {
    mkCompita({ codigo: 'COM-0025', cmc_permite: true, email: 'c25@correo.com' } as any)
    const r = await registrarCompitaManual({ nombre: 'Ana', zona: 'Caracas', descripcion: 'Hola, soy Ana y acompaño', servicios: ['Compañía'], email: 'c25@correo.com' }, 'admin@compaz.test')
    assert.equal(r.ok, false); assert.equal((r as any).status, 409)
  })
  test('las pantallas lo usan: la ficha muestra el bloque y los botones se esconden', () => {
    assert.match(readFileSync('components/panel/FichaPersona.tsx', 'utf8'), /ficha\.cmc && <EstadoCmc/)
    const c = readFileSync('components/panel/CuentaPersona.tsx', 'utf8')
    assert.match(c, /cmcPermiteActivar\(ficha\.cmc\)/g)
    assert.equal((c.match(/cmcPermiteActivar\(ficha\.cmc\)/g) ?? []).length, 2)
  })
})
