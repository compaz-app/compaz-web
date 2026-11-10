// Notas de voz: el bot solo retransmite texto y fotos. Antes ignoraba un audio en silencio y el compita creía que el
// cliente lo había recibido. Ahora responde que no están activas y no guarda ni reenvía nada.
import { db, net, limpiar, tgReq, tgText, tgFoto, tgPara, emailsA, mkCompita, mkCliente, mkVisita, avisosAdmin } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { TEXTO_NOTA_DE_VOZ } from '@/lib/telegram'

beforeEach(limpiar)

const mensajeCon = (chat: number, extra: Record<string, unknown>) =>
  tgReq({ message: { message_id: 1, from: { id: chat, first_name: 'x' }, chat: { id: chat, type: 'private' }, date: 0, ...extra } })

const mundo = (estado: string | null = 'en_curso') => {
  const compita = mkCompita({ telegram_chat_id: '9500' })
  const cliente = mkCliente({ email: 'cli@mail.test', telegram_chat_id: null })
  const visita = estado ? mkVisita(cliente, compita, { estado, fecha_programada: null }) : null
  return { compita, cliente, visita }
}

describe('notas de voz del compita', () => {
  for (const [nombre, extra] of [
    ['nota de voz', { voice: { file_id: 'v1', duration: 12 } }],
    ['audio', { audio: { file_id: 'a1', duration: 30 } }],
    ['videomensaje', { video_note: { file_id: 'n1', duration: 8 } }],
  ] as const) {
    test(`${nombre} en plena visita: el compita recibe la explicación y no se guarda ni se reenvía nada`, async () => {
      const { cliente } = mundo('en_curso')
      await webhook(mensajeCon(9500, extra))
      const respuestas = tgPara(9500)
      assert.equal(respuestas.length, 1)
      assert.equal(respuestas[0].text, TEXTO_NOTA_DE_VOZ)
      assert.match(respuestas[0].text, /notas de voz no están activas/)
      assert.match(respuestas[0].text, /el cliente no las recibe/)
      assert.equal(db.rows('mensajes').length, 0, 'no se guarda nada en el chat')
      assert.equal(emailsA(cliente.email).length, 0, 'el cliente no recibe nada')
      assert.equal(avisosAdmin().length, 0, 'tampoco se avisa al admin')
    })
  }

  test('también responde en coordinación (antes de la visita) y sin visita: nunca se queda en silencio', async () => {
    mundo('pre_visita')
    await webhook(mensajeCon(9500, { voice: { file_id: 'v2' } }))
    assert.equal(tgPara(9500).at(-1)!.text, TEXTO_NOTA_DE_VOZ)
    limpiar()
    mundo(null)
    await webhook(mensajeCon(9500, { voice: { file_id: 'v3' } }))
    assert.equal(tgPara(9500).at(-1)!.text, TEXTO_NOTA_DE_VOZ)
  })

  test('el aviso dice cómo seguir (texto o foto) y no usa guiones como viñetas', () => {
    assert.match(TEXTO_NOTA_DE_VOZ, /texto o manda una foto/)
    assert.ok(!/^\s*[-•]/m.test(TEXTO_NOTA_DE_VOZ))
  })

  test('el texto y las fotos siguen retransmitiéndose igual que antes', async () => {
    const { cliente, visita } = mundo('en_curso')
    await webhook(tgText(9500, 'Ya llegué, todo bien'))
    await webhook(tgFoto(9500))
    // (el sistema guarda además una fila interna de control del correo de aviso; solo cuentan las del compita)
    const m = db.rows('mensajes').filter((x) => x.visit_id === visita!.id && x.origen === 'compita')
    assert.deepEqual(m.map((x) => x.tipo), ['texto', 'foto'])
    assert.ok(!tgPara(9500).some((x) => x.text === TEXTO_NOTA_DE_VOZ))
    void cliente
  })

  test('un texto y una nota de voz juntos (con pie de foto) se tratan como lo que son: la nota de voz se rechaza', async () => {
    mundo('en_curso')
    await webhook(mensajeCon(9500, { voice: { file_id: 'v4' }, caption: 'te dejo un audio' }))
    assert.equal(db.rows('mensajes').length, 0)
    assert.equal(tgPara(9500).at(-1)!.text, TEXTO_NOTA_DE_VOZ)
  })

  test('una persona sin cuenta vinculada sigue viendo el mensaje de siempre, no el de las notas de voz', async () => {
    await webhook(mensajeCon(9501, { voice: { file_id: 'v5' } }))
    const t = tgPara(9501).at(-1)!.text
    assert.match(t, /no está vinculada/)
    assert.notEqual(t, TEXTO_NOTA_DE_VOZ)
    void net
  })
})
