/* eslint-disable */
// El chat que el equipo tiene abierto se actualiza solo, sin saltarse el motivo ni llenar el registro de accesos.
import { db, limpiar, mkCliente, mkCompita, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { verChat, refrescarChat } from '@/lib/panel-chat'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const actor = (rol: 'admin' | 'colaborador', p: any = {}, correo = 'luis@compaz.test'): Actor => ({ id: 'u1', correo, rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } })
const montar = () => {
  const c = mkCompita({ nombre: 'Rosa' } as any), cli = mkCliente({ nombre: 'Ana' } as any), v = mkVisita(cli, c) as any
  db.seed('mensajes', { visit_id: v.id, origen: 'cliente', tipo: 'texto', contenido: 'Hola', created_at: '2026-11-10T10:00:00Z' })
  return { c: c as any, cli: cli as any, v }
}
const nuevo = (v: any, texto: string, cuando: string) => db.seed('mensajes', { visit_id: v.id, origen: 'compita', tipo: 'texto', contenido: texto, created_at: cuando })

describe('actualizar el chat abierto', () => {
  test('tras abrirlo, devuelve solo los mensajes nuevos y no anota otro acceso', async () => {
    const { c, cli, v } = montar(); const yo = actor('colaborador', { chats: true })
    const a = await verChat(yo, { clienteId: cli.id, compitaId: c.id, motivo: 'Reclamo del cliente' }); assert.equal(a.ok, true)
    const accesos = () => db.rows('actividad_admin').filter((x: any) => x.categoria === 'acceso_chat').length
    assert.equal(accesos(), 1)
    nuevo(v, 'Ya voy en camino', '2026-11-10T10:05:00Z')
    const r = await refrescarChat(yo, { clienteId: cli.id, compitaId: c.id, desde: '2026-11-10T10:00:00Z' })
    assert.equal(r.ok, true); assert.deepEqual((r as any).mensajes.map((m: any) => m.texto), ['Ya voy en camino'])
    assert.equal(accesos(), 1, 'actualizar no llena el registro de accesos')
    assert.equal(((await refrescarChat(yo, { clienteId: cli.id, compitaId: c.id, desde: '2026-11-10T10:05:00Z' })) as any).mensajes.length, 0)
  })
  test('sin haberlo abierto antes no entrega nada (no se salta el motivo)', async () => {
    const { c, cli } = montar()
    const r = await refrescarChat(actor('colaborador', { chats: true }), { clienteId: cli.id, compitaId: c.id, desde: null })
    assert.equal(r.ok, false); assert.equal((r as any).status, 403)
  })
  test('lo que abrió otra persona, o otro chat del mismo cliente, no sirve', async () => {
    const { c, cli } = montar(); const otro = mkCompita({ nombre: 'Marta' } as any) as any; mkVisita(cli, otro)
    await verChat(actor('colaborador', { chats: true }, 'otra@compaz.test'), { clienteId: cli.id, compitaId: c.id, motivo: 'Reclamo del cliente' })
    assert.equal((await refrescarChat(actor('colaborador', { chats: true }), { clienteId: cli.id, compitaId: c.id, desde: null })).ok, false, 'otra persona')
    await verChat(actor('colaborador', { chats: true }), { clienteId: cli.id, compitaId: c.id, motivo: 'Reclamo del cliente' })
    assert.equal((await refrescarChat(actor('colaborador', { chats: true }), { clienteId: cli.id, compitaId: otro.id, desde: null })).ok, false, 'otro chat')
  })
  test('pasados 30 minutos hay que abrirlo de nuevo', async () => {
    const { c, cli } = montar(); const yo = actor('colaborador', { chats: true })
    await verChat(yo, { clienteId: cli.id, compitaId: c.id, motivo: 'Reclamo del cliente' })
    for (const a of db.rows('actividad_admin')) (a as any).creado_en = new Date(Date.now() - 31 * 60_000).toISOString()
    const r = await refrescarChat(yo, { clienteId: cli.id, compitaId: c.id, desde: null })
    assert.equal(r.ok, false); assert.equal((r as any).status, 403)
  })
  test('sin el permiso de chats, no', async () => {
    const { c, cli } = montar()
    assert.equal((await refrescarChat(actor('colaborador', { atender: true }), { clienteId: cli.id, compitaId: c.id, desde: null }) as any).status, 403)
  })
  test('la pantalla se actualiza cada 10 s con la pestaña a la vista y se detiene al caducar', () => {
    const f = readFileSync('components/panel/VerChat.tsx', 'utf8')
    assert.match(f, /refrescar: true/); assert.match(f, /10_000/); assert.match(f, /visibilityState !== 'visible'/); assert.match(f, /Seguir viendo/)
  })
})
