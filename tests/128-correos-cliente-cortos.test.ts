/* eslint-disable */
// Correos del cliente: más cortos y sin repetir. La bienvenida baja de 227 a ~65 palabras, el lema de pie ya no va en los correos, el aviso «llegó con tu familiar» solo sale cuando el
// inicio fue automático (el cliente no actuó) y las advertencias de seguridad siguen, en versión breve.
import { db, limpiar, cron, emailsA, mkCompita, mkCliente, mkVisita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sendBienvenidaCliente } from '@/lib/resend'
import { POST as avisoInicio } from '@/app/api/cron/aviso-inicio-visita/route'
import { AVISO_FRAUDE, AVISO_FUERA } from '@/lib/avisos-seguridad'
import { defAjuste } from '@/lib/ajustes'

beforeEach(limpiar)
const pal = (t: string) => (t.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').match(/[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡0-9$%]+/g) ?? []).length

describe('bienvenida del cliente', () => {
  test('máximo 80 palabras (antes 227), 3 pasos, el botón con su enlace, la vigencia y el aviso de fraude', async () => {
    await sendBienvenidaCliente('carlos@mail.test', 'Carlos Ruiz', 'https://micompaz.test/auth/confirm?token_hash=abc&type=invite')
    const m = emailsA('carlos@mail.test')[0]
    assert.ok(pal(m.subject) + pal(m.html) <= 80, `tiene ${pal(m.subject) + pal(m.html)} palabras`)
    assert.equal((m.html.match(/<li>/g) ?? []).length, 3); assert.match(m.html, /token_hash=abc/); assert.match(m.html, /vale 1 hora/); assert.ok(m.html.includes(AVISO_FRAUDE))
    assert.doesNotMatch(m.html, /Paso 1|Paso 2|Paso 3/)
  })
})

describe('el inicio de la visita', () => {
  test('si el inicio fue AUTOMÁTICO (el cliente no confirmó) sí llega «llegó con tu familiar»', async () => {
    const compita = mkCompita({ telegram_chat_id: '910', nombre: 'Lucía Fernández' }); const cli = mkCliente({ email: 'cli@mail.test', nombre: 'Carlos Ruiz' })
    const v = mkVisita(cli, compita, { estado: 'confirmando_inicio', confirmando_inicio_en: new Date(Date.now() - 10 * 60_000).toISOString() })
    const r = await avisoInicio(cron('a')); assert.equal(r.status, 200)
    assert.equal(db.rows('visitas').find((x: any) => x.id === v.id)!.estado, 'en_curso')
    assert.equal(emailsA('cli@mail.test').filter((e: any) => e.subject.includes('llegó con tu familiar')).length, 1)
  })
})

describe('menos texto repetido', () => {
  test('el lema «Cerca aunque estés lejos» ya no cierra los correos ni mensajes de código (queda en la landing)', () => {
    const quedan = ['lib/resend.ts', 'lib/plantillas-aviso.ts', 'lib/acciones-equipo.ts', 'lib/citas.ts', 'lib/enlace-llamada.ts', 'lib/entrevista-confirmada.ts', 'app/api/cron/seguimiento/route.ts', 'app/api/cron/recordatorios/route.ts', 'app/api/pago/confirmar/route.ts', 'app/api/telegram-webhook/route.ts', 'app/api/solicitud/responder/route.ts']
      .filter((f) => /Cerca aunque est/.test(readFileSync(f, 'utf8')))
    assert.deepEqual(quedan, [])
  })
  test('los textos de seguridad de Ajustes son cortos (máximo 30 palabras) y conservan lo esencial', () => {
    const c = defAjuste('antifraude_cliente')!, p = defAjuste('antifraude_compita')!, r = defAjuste('recordatorio_chat_contactos')!
    for (const d of [c, p, r]) assert.ok(String(d.defecto).split(/\s+/).length <= 30, `${d.clave}: ${String(d.defecto).split(/\s+/).length}`)
    assert.match(String(c.defecto), /pagos se hacen solo con los datos de tu portal/); assert.match(String(p.defecto), /nunca te da el contacto del cliente/); assert.match(String(r.defecto), /acordar por fuera/)
  })
  test('el aviso largo de los correos de seguimiento usa la frase común de contacto por fuera', () => {
    const s = readFileSync('app/api/cron/seguimiento/route.ts', 'utf8')
    assert.match(s, /AVISO_PLATAFORMA_CLIENTE = `[\s\S]*\$\{AVISO_FUERA\}/); assert.doesNotMatch(s, /Para que Compaz pueda garantizarte el servicio/); assert.ok(AVISO_FUERA.length > 30)
  })
})
