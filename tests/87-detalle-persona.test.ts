/* eslint-disable */
// «Todo de esta persona» en la ficha: revisar la calidad de un compita o de un cliente sin ver contactos y con los datos de salud solo para el administrador.
import { db, limpiar, mkCliente, mkCompita, mkSolicitud, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { fichaDePersona } from '@/lib/panel-personas'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'
import type { Actor } from '@/lib/permisos'

beforeEach(limpiar)
const actor = (rol: 'admin' | 'colaborador', p: any = {}): Actor => ({ id: 'u1', correo: 'x@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } })
const sec = (f: any, t: string) => f.detalle.secciones.find((s: any) => s.titulo === t)
const todoTexto = (f: any) => JSON.stringify(f.detalle)

describe('todo del compita', () => {
  test('perfil, calidad, solicitudes y visitas; sin teléfono ni correo', async () => {
    const k = mkCompita({ nombre: 'Lucía', descripcion: 'Enfermera con experiencia', servicios: ['Compañía'], foto_url: 'https://x/foto.jpg', youtube_url: 'https://youtu.be/abc', rating_promedio: 4.5, total_ratings: 2, telefono: '+584121234567', email: 'lucia@mail.com' } as any)
    const c = mkCliente()
    db.seed('resenas', { visita_id: 'v1', compita_id: k.id, cliente_id: c.id, texto: 'Muy atenta', estrellas: 5, publicada: false, created_at: new Date().toISOString() })
    mkSolicitud(c, k, { estado: 'aceptada', tipo: 'directa' }); mkVisita(c, k, { estado: 'terminada', rating_cliente: 5 })
    const f = (await fichaDePersona(actor('colaborador', { cuentas: true }), 'compita', k.id))!
    assert.equal(f.detalle!.fotoUrl, 'https://x/foto.jpg'); assert.equal(f.detalle!.videoUrl, 'https://youtu.be/abc')
    assert.match(sec(f, 'Cómo lo ve el cliente').filas[0].texto, /Enfermera/)
    assert.match(JSON.stringify(sec(f, 'Calidad')), /Muy atenta/); assert.match(JSON.stringify(sec(f, 'Calidad')), /sin publicar/)
    assert.match(JSON.stringify(sec(f, 'Solicitudes recibidas')), /Contratación directa, aceptada/)
    assert.match(JSON.stringify(sec(f, 'Visitas')), /terminada/)
    assert.ok(!/584121234567|lucia@mail/.test(todoTexto(f)), 'el detalle no lleva contacto')
  })
  test('sin el permiso de cuentas no hay detalle', async () => {
    const k = mkCompita({} as any)
    assert.equal((await fichaDePersona(actor('colaborador', { atender: true }), 'compita', k.id))!.detalle, undefined)
  })
})

describe('todo del cliente', () => {
  const cliente = () => mkCliente({ familiar_nombre: 'Rosa', familiar_edad: 82, familiar_condicion: 'Diabetes', familiar_notas: 'Toma insulina', parentesco: 'Hijo', pais: 'EE. UU.', lugar_privado: true, ficha_personas: 'Vecina', plan_contratado: 'semanal', telefono: '+13055550000', email: 'cli@mail.com' } as any)
  test('el administrador ve ficha, plan, solicitudes y visitas, y también la salud del familiar', async () => {
    const c = cliente(); const k = mkCompita({ nombre: 'Lucía' } as any); mkSolicitud(c, k, { estado: 'pendiente', tipo: 'entrevista' }); mkVisita(c, k, { estado: 'programada' })
    const f = (await fichaDePersona(actor('admin'), 'cliente', c.id))!
    const fam = JSON.stringify(sec(f, 'Su familiar')); assert.match(fam, /Rosa, 82 años/); assert.match(fam, /Diabetes/); assert.match(fam, /insulina/)
    assert.match(JSON.stringify(sec(f, 'Plan')), /semanal/); assert.match(JSON.stringify(sec(f, 'Solicitudes')), /Entrevista a Lucía, pendiente/)
    assert.ok(!/13055550000|cli@mail/.test(todoTexto(f)), 'el detalle no lleva contacto')
  })
  test('un colaborador con cuentas ve la ficha pero no la condición ni las notas de salud', async () => {
    const c = cliente()
    const f = (await fichaDePersona(actor('colaborador', { cuentas: true }), 'cliente', c.id))!
    const fam = JSON.stringify(sec(f, 'Su familiar')); assert.match(fam, /Rosa/); assert.ok(!/Diabetes|insulina/.test(fam))
  })
})

describe('perfil público para el equipo', () => {
  const { readFileSync } = require('node:fs')
  test('la familia y el equipo usan la misma pieza, y la página exige el permiso de cuentas y no trae contactos', () => {
    assert.match(readFileSync('app/compitas/CompitasMarketplace.tsx', 'utf8'), /<PerfilPublicoCompita compita=/)
    const p = readFileSync('app/panel/perfil-publico/[id]/page.tsx', 'utf8')
    assert.match(p, /<PerfilPublicoCompita compita=/); assert.match(p, /puede\(actor, 'cuentas'\)/)
    assert.ok(!/telefono\b|email\b/.test(p.replace(/telegram_chat_id/g, '')), 'la página no pide contactos')
  })
  test('la ficha del compita tiene el botón «Ver perfil público»', () => {
    assert.match(readFileSync('components/panel/FichaPersona.tsx', 'utf8'), /perfil-publico\/\$\{ficha\.id\}/)
  })
})
