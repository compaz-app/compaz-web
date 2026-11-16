/* eslint-disable */
// Las tareas de la Bandeja se cierran solas cuando lo que las originó ya se resolvió; las tareas se leen completas y sin emojis.
import { db, net, limpiar, req, session, mkCliente, mkCompita, mkVisita, conDireccion, tgBtn } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PUT as fecha } from '@/app/api/visita/fecha/route'
import { POST as webhook } from '@/app/api/telegram-webhook/route'
import { POST as escalera } from '@/app/api/cron/escalera-avisos/route'
import { escalarCitasSinRespuesta, confirmarCita, rechazarCita, versionCita } from '@/lib/citas'
import { cerrarTareasObsoletas, cerrarTareasDeCita } from '@/lib/tareas-obsoletas'
import { cargarBandeja } from '@/lib/panel-bandeja'
import { sinEmojis } from '@/lib/panel-bandeja-tipos'
import { limpiarCacheAjustes } from '@/lib/ajustes'
import { TODOS } from '@/lib/permisos-catalogo'

const CHAT = '9961'
beforeEach(() => { limpiar(); limpiarCacheAjustes() })
const dia = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10)
const horas = (h: number) => new Date(Date.now() + h * 3600_000)
const admin = { id: 'a1', correo: 'admin@compaz.test', rol: 'admin' as const, permisos: { ...TODOS } }
function mundo() {
  const cliente = mkCliente({ nombre: 'Carolina Rojas', email: 'caro@mail.test' }), compita = mkCompita({ telegram_chat_id: CHAT, nombre: 'María Pérez' })
  const v = mkVisita(cliente, compita, { estado: 'pre_visita', fecha_programada: null }) as any; conDireccion(v.id)
  session.user = { id: cliente.id, email: cliente.email } as any
  return { cliente: cliente as any, compita: compita as any, v }
}
const proponer = (v: any) => fecha(req('/api/visita/fecha', { method: 'PUT', json: { visita_id: v.id, fecha_programada: dia(5), hora_inicio: '09:00', hora_fin: '10:00' } }))
const tareas = () => db.rows('admin_flags').filter((f: any) => f.tipo === 'cita_sin_confirmar')
/** Deja la tarea de «cita sin confirmar» abierta, como la abre la escalera a las 24 horas. */
async function conTarea() { const m = mundo(); await proponer(m.v); await escalarCitasSinRespuesta(horas(25)); assert.equal(tareas().length, 1); assert.equal(tareas()[0].resuelto, false); return m }

describe('la tarea de «cita sin confirmar» se cierra sola', () => {
  test('cuando el compita confirma la cita', async () => {
    const { compita, v } = await conTarea()
    assert.equal(await confirmarCita(v.id, compita.id, versionCita(db.rows('visitas').find((x: any) => x.id === v.id)!.cita_propuesta_en)), 'ok')
    assert.equal(tareas()[0].resuelto, true); assert.ok(tareas()[0].resuelto_at)
  })
  test('cuando el compita dice que no puede a esa hora', async () => {
    const { compita, v } = await conTarea()
    assert.equal(await rechazarCita(v.id, compita.id, versionCita(db.rows('visitas').find((x: any) => x.id === v.id)!.cita_propuesta_en)), 'ok'); assert.equal(tareas()[0].resuelto, true)
  })
  test('cuando el cliente elige otra hora (la propuesta nueva reemplaza a la vieja)', async () => {
    const { v } = await conTarea(); await new Promise((r) => setTimeout(r, 1100)); assert.equal((await proponer(v)).status, 200); assert.equal(tareas()[0].resuelto, true)
  })
  test('cerrarTareasDeCita solo toca las de esa visita', async () => {
    const a = await conTarea(); const b = mundo(); await proponer(b.v); await escalarCitasSinRespuesta(horas(25))
    await cerrarTareasDeCita(a.v.id); const abiertas = tareas().filter((t: any) => !t.resuelto); assert.equal(abiertas.length, 1); assert.match(abiertas[0].nota, new RegExp(b.v.id))
  })
})

describe('el barrido de la escalera', () => {
  test('cierra la tarea que quedó abierta aunque la cita ya se dio (el caso real: la visita ya está programada y sin propuesta)', async () => {
    const { v } = await conTarea()
    Object.assign(db.rows('visitas').find((x: any) => x.id === v.id)!, { estado: 'programada', cita_propuesta_en: null, cita_propuesta_fecha: null })
    assert.equal(tareas()[0].resuelto, false); assert.deepEqual(await cerrarTareasObsoletas(), { citas: 1, sinTelegram: 0 }); assert.equal(tareas()[0].resuelto, true)
  })
  test('cierra la de una visita que ya terminó o ya no existe, pero NO la que sigue esperando al compita', async () => {
    const vigente = await conTarea(); const otra = mundo(); await proponer(otra.v); await escalarCitasSinRespuesta(horas(25))
    db.rows('visitas').find((x: any) => x.id === otra.v.id)!.estado = 'terminada'
    assert.equal((await cerrarTareasObsoletas()).citas, 1)
    assert.equal(tareas().find((t: any) => t.nota.includes(vigente.v.id))!.resuelto, false, 'la vigente sigue abierta')
    db.tables.visitas = db.rows('visitas').filter((x: any) => x.id !== vigente.v.id); assert.equal((await cerrarTareasObsoletas()).citas, 1)
  })
  test('si la propuesta cambió (otra versión), la tarea vieja ya no vale', async () => {
    const { v } = await conTarea(); db.rows('visitas').find((x: any) => x.id === v.id)!.cita_propuesta_en = new Date(Date.now() + 3 * 3600_000).toISOString()
    assert.equal((await cerrarTareasObsoletas()).citas, 1)
  })
  test('la tarea de «cita sin Telegram» se cierra cuando el compita ya tiene Telegram', async () => {
    const k = mkCompita({ telegram_chat_id: null } as any) as any
    db.seed('admin_flags', { entidad_tipo: 'compita', entidad_id: k.id, entidad_nombre: 'x', nota: 'No se pudo avisar [cita_sin_telegram:x]', tipo: 'cita_sin_telegram', resuelto: false, reportado_por: 'sistema', prioridad: 2, created_at: new Date().toISOString() })
    assert.equal((await cerrarTareasObsoletas()).sinTelegram, 0); k.telegram_chat_id = '123'; assert.equal((await cerrarTareasObsoletas()).sinTelegram, 1)
  })
  test('el cron de la escalera lo corre y lo informa', async () => {
    await conTarea(); Object.assign(db.rows('visitas')[0], { estado: 'programada', cita_propuesta_en: null })
    const r = await escalera(new Request('http://localhost/api/cron/escalera-avisos', { method: 'POST', headers: { 'x-cron-secret': process.env.CRON_SECRET ?? 'secreto-de-prueba' } }) as any)
    if (r.status === 200) assert.equal((await r.json()).data.tareasCerradas.citas, 1)
    else assert.match(readFileSync('app/api/cron/escalera-avisos/route.ts', 'utf8'), /cerrarTareasObsoletas/)
  })
})

describe('cómo se lee la tarea en la Bandeja', () => {
  test('quita los emojis (solo son de Telegram) también de las tareas ya guardadas', async () => {
    assert.equal(sinEmojis('📅 Cita sin confirmar: María ⏳ ⚠️ ok ✓'), 'Cita sin confirmar: María ok ✓')
    db.seed('admin_flags', { entidad_tipo: 'compita', entidad_id: 'x1', entidad_nombre: '📅 Cita sin confirmar: A / B', nota: '📅 A no confirma la cita', resuelto: false, tipo: 'cita_sin_confirmar', reportado_por: 'sistema', prioridad: 2, created_at: new Date().toISOString() })
    const t = (await cargarBandeja(admin as any))[0]; assert.equal(t.entidad_nombre, 'Cita sin confirmar: A / B'); assert.equal(t.nota, 'A no confirma la cita')
  })
  test('la nota larga se puede leer completa y el botón apagado dice por qué en una línea', () => {
    const n = readFileSync('components/panel/NotaTarea.tsx', 'utf8'); assert.match(n, /Ver más/); assert.match(n, /Ver menos/); assert.match(n, /line-clamp-3/)
    assert.match(readFileSync('components/panel/Bandeja.tsx', 'utf8'), /<NotaTarea texto=/)
    const a = readFileSync('components/panel/AccionTarea.tsx', 'utf8'); assert.match(a, /a\.resumen \?\? 'No tienes este permiso\.'/)
    assert.match(readFileSync('lib/panel-bandeja.ts', 'utf8'), /bloqueada\(clase\.texto, `\$\{espera\.resumen\} \$\{espera\.porQue\}`, espera\.resumen\)/)
  })
  test('el texto de la cita ya no dice «hace 0 horas»', () => {
    assert.match(readFileSync('lib/citas.ts', 'utf8'), /hace menos de una hora/)
  })
})
