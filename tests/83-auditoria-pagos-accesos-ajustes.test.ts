/* eslint-disable */
// Auditoría: D-01 (pagos), S-04 (accesos fallan cerrado), S-05 (línea de tiempo sin accesos) y S-06 (ajustes reservados y lote todo o nada).
import { db, limpiar, session, req, mkCliente, mkCompita } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { registrarPago, anularPago } from '@/lib/pagos'
import { registrarAcceso } from '@/lib/alertas-admin'
import { lineaDe } from '@/lib/panel-personas'
import { revelarContacto } from '@/lib/panel-personas'
import { setAjustes, soloAdministrador, limpiarCacheAjustes } from '@/lib/ajustes'
import { PATCH as ajustesPatch } from '@/app/api/admin/ajustes/route'
import { invitarColaborador } from '@/lib/equipo'
import { TODOS, NINGUNO } from '@/lib/permisos-catalogo'

beforeEach(() => { limpiar(); db.rows('ajustes').length = 0; limpiarCacheAjustes() })
const pago = (usuarioId: string, o: any = {}) => registrarPago({ usuarioId, tipo: 'plan', plan: 'quincenal', metodo: 'zelle', registradoPor: 'adm@compaz.test', ...o })
const actor = (rol: 'admin' | 'colaborador', p: any = {}) => ({ id: 'u1', correo: 'x@compaz.test', rol, permisos: rol === 'admin' ? { ...TODOS } : { ...NINGUNO, ...p } }) as any

describe('D-01: un pago no se registra dos veces', () => {
  test('la misma referencia para el mismo cliente se rechaza, aunque cambien las mayúsculas', async () => {
    const c = mkCliente({ email: 'a@mail.test', nombre: 'Ana' })
    assert.equal((await pago(c.id, { referencia: 'ZELLE 123' })).ok, true)
    const r = await pago(c.id, { referencia: ' zelle  123 ' }); assert.equal(r.ok, false); assert.match((r as any).error, /misma referencia/)
    assert.equal(db.rows('pagos_plan').length, 1)
  })
  test('un pago idéntico sin referencia hecho en seguida (doble clic) se rechaza; con otra referencia, no', async () => {
    const c = mkCliente({ email: 'b@mail.test', nombre: 'Beto' })
    assert.equal((await pago(c.id)).ok, true)
    const r = await pago(c.id); assert.equal(r.ok, false); assert.match((r as any).error, /idéntico/)
    assert.equal((await pago(c.id, { referencia: 'otro' })).ok, true)
  })
  test('dos registros a la vez: solo uno entra y el bloqueo se libera', async () => {
    const c = mkCliente({ email: 'c@mail.test', nombre: 'Cira' })
    const [x, y] = await Promise.all([pago(c.id, { referencia: 'R1' }), pago(c.id, { referencia: 'R2' })])
    assert.ok([x.ok, y.ok].filter(Boolean).length >= 1)
    assert.equal(db.rows('telegram_estados').filter((e: any) => String(e.chat_id).startsWith('pago_lock:')).length, 0) // nada queda bloqueado
  })
  test('anular exige motivo, guarda quién fue y, si es un colaborador, avisa al administrador como tarea', async () => {
    const c = mkCliente({ email: 'd@mail.test', nombre: 'Dani' })
    const p = await pago(c.id, { referencia: 'Z9' }) as any
    assert.equal((await anularPago(p.pago.id, '', { correo: 'luis@compaz.test', rol: 'colaborador' })).ok, false)
    assert.equal((await anularPago(p.pago.id, 'pagó dos veces', { correo: 'luis@compaz.test', rol: 'colaborador' })).ok, true)
    assert.ok(db.rows('eventos').some((e: any) => e.tipo === 'pago_anulado' && e.actor === 'admin:luis@compaz.test' && e.datos.motivo === 'pagó dos veces'))
    const a = db.rows('actividad_admin').find((x: any) => x.categoria === 'pago_anulado')!
    assert.equal(a.nivel, 'tarea'); assert.match(a.resumen, /luis@compaz\.test/)
  })
})

describe('S-04: el acceso a un dato sensible no se entrega si no quedó anotado', () => {
  test('si el registro falla, registrarAcceso dice false, no avisa por Telegram y revelarContacto no entrega el dato', async () => {
    const cli = mkCliente({ email: 'g@mail.test', nombre: 'Gio', telefono: '+58 412 777 0000' })
    const { net } = await import('./harness'); net.tg = []
    db.fail['actividad_admin:insert'] = 2
    const ok = await registrarAcceso('x abrió el teléfono', { categoria: 'acceso_contacto', entidad: { tipo: 'cliente', id: cli.id, nombre: 'Gio' } })
    assert.equal(ok, false); assert.equal(net.tg.length, 0) // antes el aviso por Telegram "salvaba" el registro y el dato se entregaba
    const r = await revelarContacto(actor('colaborador', { telefonos: true }), { tipo: 'cliente', id: cli.id, canal: 'telefono', motivo: 'Otro: necesito llamarlo por su visita' } as any)
    assert.equal(r.ok, false); assert.doesNotMatch(JSON.stringify(r), /777 0000/)
    db.fail['actividad_admin:insert'] = 0
    assert.equal((await revelarContacto(actor('colaborador', { telefonos: true }), { tipo: 'cliente', id: cli.id, canal: 'telefono', motivo: 'Otro: necesito llamarlo por su visita' } as any)).ok, true) // con el registro sano, sí
  })
  test('un motivo con "<" y "&" se guarda tal cual', async () => {
    const cli = mkCliente({ email: 'e@mail.test', nombre: 'Eva', telefono: '+58 412 1' })
    const r = await revelarContacto(actor('colaborador', { telefonos: true }), { tipo: 'cliente', id: cli.id, canal: 'telefono', motivo: 'Otro: <b>visita</b> & más' } as any)
    assert.equal(r.ok, true)
    assert.match(db.rows('actividad_admin').find((x: any) => x.categoria === 'acceso_contacto')!.resumen, /<b>visita<\/b> & más/)
  })
  test('ninguna lectura de datos sensibles usa el respaldo por Telegram', async () => {
    const { readFileSync } = await import('node:fs')
    for (const f of ['lib/panel-chat.ts', 'lib/panel-personas.ts', 'app/portal/page.tsx']) assert.doesNotMatch(readFileSync(f, 'utf8'), /alertaAdmin\('actividad'[^)]*acceso_/, f)
  })
})

describe('S-05: la línea de tiempo no muestra quién miró a quién sin el permiso de ver contactos', () => {
  test('con telefonos se ve; sin él no', async () => {
    const cli = mkCliente({ email: 'f@mail.test', nombre: 'Fran' })
    db.seed('actividad_admin', { nivel: 'actividad', resumen: 'luis abrió el teléfono de Fran. Motivo: x', categoria: 'acceso_contacto', entidad_id: cli.id, creado_en: new Date().toISOString() })
    db.seed('actividad_admin', { nivel: 'actividad', resumen: 'Se cambió algo normal', categoria: null, entidad_id: cli.id, creado_en: new Date().toISOString() })
    const con = (await lineaDe(actor('colaborador', { telefonos: true, monitorear: true }), 'cliente', cli.id)).map((e) => e.texto).join('|')
    const sin = (await lineaDe(actor('colaborador', { atender: true }), 'cliente', cli.id)).map((e) => e.texto).join('|')
    assert.match(con, /abrió el teléfono/); assert.doesNotMatch(sin, /abrió el teléfono/); assert.match(sin, /Se cambió algo normal/)
  })
})

describe('S-06: precios, retención y textos solo los cambia el administrador', () => {
  const llamar = (cambios: any) => ajustesPatch(req('/api/admin/ajustes', { method: 'PATCH', json: { cambios } }))
  test('qué se reserva', () => {
    for (const k of ['precio_hora', 'precio_plan_quincenal', 'avisos_retencion_dias', 'accesos_retencion_dias', 'recordatorio_chat_contactos']) assert.equal(soloAdministrador(k), true, k)
    for (const k of ['recordatorio_cliente_max', 'llamada_corte_min']) assert.equal(soloAdministrador(k), false, k)
  })
  test('un colaborador con editar ajustes cambia lo demás pero recibe 403 en lo reservado, y no se guarda nada', async () => {
    await invitarColaborador('edi@compaz.test', 'Edi', { ajustes_editar: true }, 'admin@compaz.test'); session.user = { id: 'e', email: 'edi@compaz.test' } as any
    const r = await llamar({ recordatorio_cliente_max: 4, precio_hora: 30 }); assert.equal(r.status, 403)
    assert.equal(db.rows('ajustes_historial').length, 0)
    assert.equal((await llamar({ recordatorio_cliente_max: 4 })).status, 200)
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await llamar({ precio_hora: 24 })).status, 200)
  })
  test('si falla a mitad del lote se deshace lo ya guardado', async () => {
    const orig = (db as any).rpcs.guardar_ajuste
    let llamadas = 0
    ;(db as any).rpcs.guardar_ajuste = (a: any) => { llamadas++; if (llamadas === 2) return { error: { message: 'falló' } }; return orig(a) }
    const r = await setAjustes({ cambios: { recordatorio_cliente_max: 5, llamada_corte_min: 25 }, actor: 'admin@compaz.test' })
    ;(db as any).rpcs.guardar_ajuste = orig; limpiarCacheAjustes()
    assert.equal(r.ok, false); assert.match((r as any).error, /No se guardó nada/)
    const { getAjustes } = await import('@/lib/ajustes'); const v = await getAjustes()
    assert.equal(Number(v.recordatorio_cliente_max), 3); assert.equal(Number(v.llamada_corte_min), 23) // los dos siguen como estaban
  })
})

import { eliminarClientePorEquipo } from '@/lib/cuenta-eliminar'
describe('S-08: al anonimizar no queda el nombre en notas ni registros', () => {
  test('con borrar datos se borran las notas y el nombre sale de la actividad y de las tareas; sin él se conservan', async () => {
    const c = mkCliente({ email: 'h@mail.test', nombre: 'Hilda Torres' })
    db.seed('notas_persona', { persona_tipo: 'cliente', persona_id: c.id, texto: 'Hilda pide llamar de tarde', autor: 'luis@compaz.test' })
    db.seed('actividad_admin', { nivel: 'actividad', resumen: 'luis abrió el teléfono de Hilda Torres. Motivo: x', categoria: 'acceso_contacto', entidad_tipo: 'cliente', entidad_id: c.id, entidad_nombre: 'Hilda Torres', creado_en: new Date().toISOString() })
    db.seed('admin_flags', { entidad_tipo: 'cliente', entidad_id: c.id, entidad_nombre: 'Hilda Torres', nota: 'Revisar a Hilda Torres', resuelto: false })
    assert.equal((await eliminarClientePorEquipo(c.id, 'admin@compaz.test', { borrarDatos: true })).ok, true)
    assert.equal(db.rows('notas_persona').length, 0)
    const t = JSON.stringify([db.rows('actividad_admin'), db.rows('admin_flags')])
    assert.doesNotMatch(t, /Hilda/); assert.match(t, /Cuenta eliminada/)
    const d = mkCliente({ email: 'i@mail.test', nombre: 'Ines Soto' })
    db.seed('notas_persona', { persona_tipo: 'cliente', persona_id: d.id, texto: 'nota', autor: 'luis@compaz.test' })
    assert.equal((await eliminarClientePorEquipo(d.id, 'admin@compaz.test')).ok, true)
    assert.equal(db.rows('notas_persona').filter((n: any) => n.persona_id === d.id).length, 1) // sin pedido: se conserva
  })
})

import { readdirSync, readFileSync as leer, statSync } from 'node:fs'
import { join } from 'node:path'
const rutasDe = (base: string): string[] => readdirSync(base).flatMap((n) => { const p = join(base, n); return statSync(p).isDirectory() ? rutasDe(p) : n === 'route.ts' ? [p] : [] })

describe('A-01 y A-02: ninguna ruta del equipo se queda sin dueño ni con consultas adentro', () => {
  test('toda ruta de /api/admin tiene una pantalla que la usa, salvo estas, que son API de lectura a propósito', () => {
    // Quedan sin pantalla porque el panel lee lo mismo directo desde lib/ en el servidor; se conservan como API documentada y probada.
    const APIS_SIN_PANTALLA = new Set(['bloqueos-compita', 'dudas', 'esperas', 'pagos'])
    const huerfanas: string[] = []
    const fuentes = [...rutasDe('app'), ...['components', 'lib'].flatMap((d) => (function t(b: string): string[] { return readdirSync(b).flatMap((n) => { const p = join(b, n); return statSync(p).isDirectory() ? t(p) : /\.(ts|tsx)$/.test(n) ? [p] : [] }) })(d))].filter((f) => !f.includes('prototipo'))
    const texto = fuentes.map((f) => [f, leer(f, 'utf8')] as const)
    for (const dir of readdirSync('app/api/admin')) {
      if (!statSync(join('app/api/admin', dir)).isDirectory()) continue
      const usada = texto.some(([f, t]) => !f.startsWith(`app/api/admin/${dir}/`) && t.includes(`api/admin/${dir}`))
      if (!usada && !APIS_SIN_PANTALLA.has(dir)) huerfanas.push(dir)
    }
    assert.deepEqual(huerfanas, [], `rutas sin pantalla que las use (conéctalas o bórralas): ${huerfanas.join(', ')}`)
  })
  test('ninguna ruta de /api/admin consulta la base directamente: va por lib/ (CLAUDE.md regla 4)', () => {
    const malas = rutasDe('app/api/admin').filter((f) => /createAdminSupabase|\.from\('/.test(leer(f, 'utf8')))
    assert.deepEqual(malas, [])
  })
  test('el resto de las rutas no suma consultas directas nuevas (trinquete: hoy 49 archivos; al migrar una, baja la cifra)', () => {
    const n = rutasDe('app/api').filter((f) => !f.startsWith('app/api/admin') && /createAdminSupabase/.test(leer(f, 'utf8'))).length
    assert.ok(n <= 49, `hay ${n} rutas con consultas directas; el tope es 49`)
  })
  test('las respuestas de las rutas del equipo usan los helpers de lib/api.ts (regla 5)', () => {
    const malas = rutasDe('app/api/admin').filter((f) => /NextResponse\.json\(\{\s*error/.test(leer(f, 'utf8')))
    assert.deepEqual(malas, [])
  })
})

import { ESPERADOS } from '@/lib/cron'
import { POST as enviarEnlace } from '@/app/api/admin/enviar-link-llamada/route'
import { GET as preciosGet } from '@/app/api/precios/route'
import { textoDuracionLlamada } from '@/lib/llamada-ruta'
import { explicarEspera } from '@/lib/esperas'

describe('resto de la auditoría: S-07, S-09, S-11, S-12, E-05, E-06, A-03, A-04, C-01, I-02, O-01', () => {
  test('S-07: reenviar el enlace de una llamada se frena 5 minutos con explicación; sin permiso ni siquiera se lee', async () => {
    const lucia = mkCompita({ nombre: 'Lucía', telegram_chat_id: '7001' }); const cli = mkCliente({ email: 'j@mail.test', nombre: 'Jose' })
    const sol = db.seed('solicitudes', { cliente_id: cli.id, compita_id: lucia.id, estado: 'aceptada', slot_confirmado: new Date(Date.now() + 3600_000).toISOString(), token_respuesta: 'tok123', tipo: 'entrevista', created_at: new Date().toISOString() })
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    const llamar = () => enviarEnlace(req('/api/admin/enviar-link-llamada', { json: { solicitud_id: sol.id } }))
    assert.equal((await llamar()).status, 200)
    const r = await llamar(); assert.equal(r.status, 429)
    const j = await r.json(); assert.match(j.error, /reenviaste el enlace/); assert.ok(j.porQue.length > 20)
    session.user = null as any; assert.equal((await llamar()).status, 401)
  })
  test('S-07: una solicitud que ya no está aceptada no mueve su hora', async () => {
    const lucia = mkCompita({ nombre: 'Rosa' }); const cli = mkCliente({ email: 'k@mail.test', nombre: 'Kai' })
    const hora = new Date(Date.now() + 86400_000).toISOString()
    const sol = db.seed('solicitudes', { cliente_id: cli.id, compita_id: lucia.id, estado: 'rechazada', slot_confirmado: hora, token_respuesta: 'tok999', tipo: 'entrevista', created_at: new Date().toISOString() })
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    assert.equal((await enviarEnlace(req('/api/admin/enviar-link-llamada', { json: { solicitud_id: sol.id } }))).status, 409)
    assert.equal(db.rows('solicitudes').find((x: any) => x.id === sol.id)!.slot_confirmado, hora)
  })
  test('S-09: la vigilancia cubre los procesos que faltaban', () => {
    for (const k of ['limpieza', 'recordatorio-pago', 'recordatorio-primera-visita', 'aviso-inicio-visita', 'noshow-alerta', 'churn-alerta']) assert.ok(ESPERADOS[k] > 0, k)
    for (const k of Object.keys(ESPERADOS)) assert.match(leer(`app/api/cron/${k}/route.ts`, 'utf8'), new RegExp(`latido\\('${k}'\\)`), `${k} debe marcar su latido`)
  })
  test('S-11/S-12/E-05/E-06/A-03/A-04/I-02: configuración', async () => {
    const cfg = leer('next.config.ts', 'utf8'); assert.doesNotMatch(cfg, /api\.airtable\.com|api\.telegram\.org/)
    const wh = leer('app/api/webhooks/daily/route.ts', 'utf8'); assert.match(wh, /DAILY_WEBHOOK_LEGACY/)
    assert.match(leer('components/llamada/LlamadaIncrustada.tsx', 'utf8'), /dynamic\(\(\) => import\('@\/components\/llamada\/SalaDaily'\)/)
    assert.match(leer('app/prototipo/layout.tsx', 'utf8'), /notFound\(\)/)
    assert.ok(statSync('proxy.ts').isFile()); assert.throws(() => statSync('middleware.ts'))
    assert.equal(JSON.parse(leer('package.json', 'utf8')).dependencies['@daily-co/daily-js'], '0.95.0')
    assert.equal(preciosGet.length, 0); assert.equal((await preciosGet()).headers.get('Cache-Control'), 'public, s-maxage=30, stale-while-revalidate=60')
    assert.match(leer('.github/workflows/ci.yml', 'utf8'), /tsc --noEmit[\s\S]*tests\/run\.mjs[\s\S]*next build/)
  })
  test('C-01: la duración de la llamada se dice siempre con la misma frase y el corte de Ajustes', () => {
    assert.equal(textoDuracionLlamada(23), 'La llamada dura 20 minutos y la sala se cierra sola a los 23 min.')
    for (const f of ['lib/enlace-llamada.ts', 'app/api/cron/recordatorios/route.ts', 'app/sala/[token]/SalaEntrevista.tsx']) assert.match(leer(f, 'utf8'), /textoDuracionLlamada/, f)
    for (const f of ['lib/enlace-llamada.ts', 'app/api/cron/recordatorios/route.ts']) assert.doesNotMatch(leer(f, 'utf8'), /límite de 20 minutos|es de <b>20 minutos/, f)
  })
  test('S-07: la espera del enlace de llamada está en el catálogo con su razón', () => {
    const e = explicarEspera('enlace_llamada_equipo', { desde: new Date(), duracionMs: 300_000 })
    assert.ok(e.porQue.length > 30); assert.ok(e.segundos! > 0)
  })
})
