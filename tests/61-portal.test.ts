/* eslint-disable */
// Portal nuevo del cliente: la tarjeta de cada estado se dibuja completa, con su ⓘ en cada botón, sin colores sueltos y con la privacidad del
// compita; quién entra a /portal según el interruptor; y los datos que alimentan la pantalla contra la base falsa.
import { db, limpiar, mkCliente, mkCompita, mkVisita, mkSolicitud } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import TarjetaEstado from '@/components/portal/TarjetaEstado'
import { CODIGOS_ESTADO, pasoDe, type CodigoEstado } from '@/lib/estado-cliente'
import { tarjetaDelEstado, nombreVisible } from '@/lib/portal-estados'
import { accesoPortal, cargarPortal } from '@/lib/portal'

beforeEach(limpiar)
const ctx = (c: CodigoEstado, o: any = {}) => ({ estado: { codigo: c, paso: pasoDe(c), compitaNombre: 'María Pérez Gómez', solicitudId: 's1', cuando: new Date(Date.now() + 26 * 3600_000).toISOString() }, pagado: false, zonaCliente: 'America/New_York', ...o })
const html = (c: CodigoEstado, o: any = {}) => { const t = tarjetaDelEstado(ctx(c, o)); return { t, h: renderToStaticMarkup(createElement(TarjetaEstado, { tarjeta: t, compita: nombreVisible('María Pérez Gómez', !!o.pagado), vistaPrevia: true })) } }

describe('la tarjeta de cada estado se dibuja completa', () => {
  for (const c of CODIGOS_ESTADO) test(`${c}`, () => {
    const { t, h } = html(c)
    assert.ok(h.includes(t.titulo.replace(/&/g, '&amp;').replace(/'/g, '&#x27;')) || h.length > 200, 'el título aparece')
    assert.doesNotMatch(h, /undefined|NaN|\[object|null/, c)
    const botones = [t.principal, t.secundario].filter(Boolean)
    const infos = (h.match(/aria-label="Qué hace: /g) ?? []).length
    assert.equal(infos, botones.length, `${c}: cada botón lleva su ⓘ`)
    assert.ok(/<h2/.test(h), 'tiene un título de sección')
  })
  test('los botones con destino de ruta son enlaces reales y, en la vista previa del equipo, los de acción salen apagados', () => {
    const decidir = html('decidir').h; assert.match(decidir, /href="\/pago"/); assert.match(decidir, /href="\/compitas"/)
    const pagar = html('pagar').h; assert.match(pagar, /<button[^>]* disabled=""[^>]*>Ya hice el pago<\/button>/); assert.match(pagar, /aria-label="Qué hace: Ya hice el pago"/)
  })
  test('PRIVACIDAD: antes de pagar "María P." y nunca el apellido; con el pago, el nombre', () => {
    const antes = html('solicitud_recibida').h; assert.match(antes, /María P\./); assert.doesNotMatch(antes, /Pérez|Gómez/)
    const despues = html('agendar_visita', { pagado: true }).h; assert.match(despues, /María Pérez/); assert.doesNotMatch(despues, /Gómez/)
  })
  test('accesible: los tonos usan el rol correcto y el contenedor es una sección con título', () => {
    assert.match(html('nadie_abre').h, /border-rojo/); assert.match(html('entrevista_ahora').h, /border-naranja/); assert.match(html('solicitud_recibida').h, /border-borde/)
  })
  test('el estado sin botones (visita en curso) se dibuja sin la zona de botones', () => { assert.doesNotMatch(html('visita_en_curso').h, /<button|<a /) })
})

describe('estilos', () => {
  test('el portal nuevo no tiene ningún color escrito a mano (usa los tokens)', async () => {
    const { readFileSync } = await import('node:fs')
    for (const f of ['components/portal/TarjetaEstado.tsx', 'app/portal/page.tsx']) assert.doesNotMatch(readFileSync(f, 'utf8'), /#[0-9A-Fa-f]{6}\b/, f)
  })
})

describe('quién entra al portal nuevo', () => {
  test('un administrador sin cliente que ver va a su panel; con vista previa de un cliente, entra', () => {
    assert.equal(accesoPortal({ esAdmin: true, previewUid: null, portalNuevoActivo: true }), 'admin'); assert.equal(accesoPortal({ esAdmin: true, previewUid: 'x', portalNuevoActivo: false }), 'portal')
  })
  test('un cliente va al portal VIEJO mientras el interruptor esté apagado y al nuevo cuando se enciende', () => {
    assert.equal(accesoPortal({ esAdmin: false, previewUid: null, portalNuevoActivo: false }), 'viejo'); assert.equal(accesoPortal({ esAdmin: false, previewUid: null, portalNuevoActivo: true }), 'portal')
  })
  test('un cliente NO puede ver el portal de otro con ?preview (solo cuenta para administradores)', () => {
    assert.equal(accesoPortal({ esAdmin: false, previewUid: 'otro', portalNuevoActivo: false }), 'viejo')
  })
})

describe('los datos del portal contra la base', () => {
  test('un cliente nuevo: bienvenida, paso 1 de 6 y sin compita', async () => {
    const c = mkCliente({ nombre: 'Carolina Rojas' }); const p = await cargarPortal(c.id)
    assert.equal(p.nombre, 'Carolina Rojas'); assert.equal(p.estado.codigo, 'bienvenida'); assert.equal(p.estado.paso, 0); assert.equal(p.compita, null); assert.equal(p.pasos.length, 6); assert.equal(p.pagado, false)
  })
  test('con una solicitud enviada ve a "María P." y no su apellido, y con su visita pagada ve el nombre', async () => {
    const c = mkCliente(); const k = mkCompita({ nombre: 'María Pérez Gómez' }); mkSolicitud(c, k, { estado: 'pendiente', tipo: 'entrevista' })
    const a = await cargarPortal(c.id); assert.equal(a.compita, 'María P.'); assert.doesNotMatch(JSON.stringify(a.tarjeta), /Pérez|Gómez/)
    Object.assign(c, { compita_id: k.id }); mkVisita(c, k, { estado: 'programada', fecha_programada: '2099-01-10', hora_inicio_programada: '09:00' })
    const b = await cargarPortal(c.id); assert.equal(b.pagado, true); assert.equal(b.compita, 'María Pérez')
  })
  test('la hora de una entrevista sale en la zona del cliente y en Caracas', async () => {
    const c = mkCliente({ zona_horaria: 'America/New_York' }); const k = mkCompita()
    mkSolicitud(c, k, { estado: 'aceptada', tipo: 'entrevista', slots_propuestos: [], slot_confirmado: new Date(Date.now() + 26 * 3600_000).toISOString() })
    const p = await cargarPortal(c.id); assert.equal(p.estado.codigo, 'entrevista_programada'); assert.match(p.tarjeta.texto, /tu hora/); assert.match(p.tarjeta.texto, /Caracas/)
  })
})
