/* eslint-disable */
// El chat de la visita muestra en qué etapa va: «Visita agendada: día, hora», «Visita iniciada», «Visita terminada». No hacen círculo rojo ni se duplican.
import { db, limpiar, mkCompita, mkCliente, mkVisita, confirmarLlegada, hoyVEstr } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { anotarEventoChat } from '@/lib/chat-eventos'
import { esEventoChat, textoEventoChat, PREFIJO_EVENTO_CHAT } from '@/lib/chat-eventos-texto'
import { anunciarCitaConfirmada } from '@/lib/citas'
import { contarMensajesSinLeer } from '@/lib/portal-mensajes'

beforeEach(limpiar)
const eventos = (visitaId: string) => db.rows('mensajes').filter((m) => m.visit_id === visitaId && esEventoChat(m.contenido)).map((m) => textoEventoChat(m.contenido))

describe('avisos de estado en el chat', () => {
  test('se guardan con su prefijo, una sola vez por texto', async () => {
    const v = mkVisita(mkCliente(), mkCompita(), { estado: 'pre_visita' })
    await anotarEventoChat(v.id, 'Visita iniciada'); await anotarEventoChat(v.id, 'Visita iniciada')
    assert.deepEqual(eventos(v.id), ['Visita iniciada'])
    assert.ok(db.rows('mensajes')[0].contenido.startsWith(PREFIJO_EVENTO_CHAT))
    assert.equal(db.rows('mensajes')[0].origen, 'admin')
  })

  test('al confirmarse la hora, el chat dice «Visita agendada» con el día y el horario', async () => {
    const cli = mkCliente({ email: 'caro@mail.test' }); const cmp = mkCompita({ telegram_chat_id: '910' }); const v = mkVisita(cli, cmp, { estado: 'pre_visita' })
    await anunciarCitaConfirmada(v.id, cli.id, cmp.id, hoyVEstr(2), '10:00', '12:00')
    const e = eventos(v.id)
    assert.equal(e.length, 1)
    assert.match(e[0], /^Visita agendada: .+, 10:00 – 12:00$/)
  })

  test('cuando el cliente confirma la llegada, el chat dice «Visita iniciada»', async () => {
    const cli = mkCliente({ email: 'caro@mail.test' }); const cmp = mkCompita({ telegram_chat_id: '910' }); const v = mkVisita(cli, cmp, { estado: 'confirmando_inicio' })
    await confirmarLlegada()
    assert.deepEqual(eventos(v.id), ['Visita iniciada'])
  })

  test('no cuentan como mensajes sin leer ni las marcas internas tampoco', async () => {
    const cli = mkCliente(); const v = mkVisita(cli, mkCompita(), { estado: 'pre_visita' })
    await anotarEventoChat(v.id, 'Visita agendada: lunes, 10:00 – 12:00')
    db.seed('mensajes', { visit_id: v.id, origen: 'admin', tipo: 'texto', contenido: 'email_notif_mensaje', created_at: new Date().toISOString() })
    assert.equal(await contarMensajesSinLeer(cli.id), 0)
    db.seed('mensajes', { visit_id: v.id, origen: 'compita', tipo: 'texto', contenido: 'Hola', created_at: new Date().toISOString() })
    assert.equal(await contarMensajesSinLeer(cli.id), 1)
  })

  test('el chat los muestra como aviso de estado (no como mensaje) y el panel del equipo les quita el prefijo', () => {
    const chat = readFileSync('components/ui/Chat.tsx', 'utf8')
    assert.match(chat, /esEventoChat\(m\.contenido\)/); assert.match(chat, /EventoChat/)
    assert.match(readFileSync('lib/panel-chat.ts', 'utf8'), /textoEventoChat/)
  })
})
