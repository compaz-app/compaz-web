/* eslint-disable */
// Un compita nuevo no cuenta en el sistema hasta tener el perfil lleno Y Telegram activo: antes es «Pendiente» y sale solo en esa vista.
import { limpiar, mkCompita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { listarCompitas } from '@/lib/panel-personas'
import { consultarCompitas, etiquetaEstadoCompita, VISTAS_COMPITA } from '@/lib/panel-personas-tipos'

beforeEach(limpiar)
const nuevo = { estado: 'inactivo', verificado: false }
const consulta = (vista = 'todas') => ({ q: '', vista, orden: '', dir: 'asc', pag: 1 })
const nombres = (c: ReturnType<typeof consultarCompitas>) => c.fila.map((p) => p.nombre).sort()

describe('compita pendiente', () => {
  test('sin perfil y sin Telegram, solo perfil o solo Telegram: Pendiente, con lo que le falta', async () => {
    mkCompita({ ...nuevo, nombre: 'Ambos', descripcion: null, servicios: [], telegram_chat_id: null })
    mkCompita({ ...nuevo, nombre: 'SoloPerfil', descripcion: null, servicios: [], telegram_chat_id: '11' })
    mkCompita({ ...nuevo, nombre: 'SoloTelegram', telegram_chat_id: null })
    const f = Object.fromEntries((await listarCompitas()).map((p) => [p.nombre, p]))
    assert.equal(etiquetaEstadoCompita(f.Ambos), 'Falta perfil y Telegram'); assert.equal(etiquetaEstadoCompita(f.SoloPerfil), 'Falta perfil'); assert.equal(etiquetaEstadoCompita(f.SoloTelegram), 'Falta Telegram')
    for (const p of Object.values(f)) assert.equal(p.estado, 'Pendiente')
  })
  test('con perfil lleno y Telegram activo entra al sistema (Nuevo, a la espera de verificarlo)', async () => {
    mkCompita({ ...nuevo, nombre: 'Listo', telegram_chat_id: '22' })
    const p = (await listarCompitas())[0]; assert.equal(p.estado, 'Nuevo'); assert.equal(p.falta, undefined)
  })
  test('un compita ya verificado no cambia aunque le falte algo (no se esconde a quien ya atiende familias)', async () => {
    mkCompita({ nombre: 'Veterano', estado: 'activo', verificado: true, telegram_chat_id: null })
    assert.equal((await listarCompitas())[0].estado, 'Disponible')
  })
  test('«Todos» no los incluye; «Pendientes» sí, y la vista cuenta cada grupo', async () => {
    mkCompita({ ...nuevo, nombre: 'Pendiente', descripcion: null, servicios: [], telegram_chat_id: null })
    mkCompita({ ...nuevo, nombre: 'Listo', telegram_chat_id: '22' })
    mkCompita({ nombre: 'Veterano', estado: 'activo', verificado: true, telegram_chat_id: '33' })
    const todas = await listarCompitas()
    const t = consultarCompitas(todas, consulta('todas')), p = consultarCompitas(todas, consulta('pendientes'))
    assert.deepEqual(nombres(t), ['Listo', 'Veterano']); assert.deepEqual(nombres(p), ['Pendiente'])
    assert.equal(t.conteos.todas, 2); assert.equal(t.conteos.pendientes, 1)
    assert.ok(VISTAS_COMPITA.some((v) => v.id === 'pendientes'))
  })
  test('un compita bloqueado no aparece como pendiente', async () => {
    mkCompita({ nombre: 'Bloqueado', estado: 'bloqueado', verificado: false, descripcion: null, servicios: [], telegram_chat_id: null })
    assert.notEqual((await listarCompitas())[0].estado, 'Pendiente')
  })
  test('la pantalla muestra el estado con lo que falta, sin párrafos', () => {
    const f = readFileSync('components/panel/Personas.tsx', 'utf8'); assert.equal((f.match(/etiquetaEstadoCompita\(p\)/g) ?? []).length, 2)
  })
})
