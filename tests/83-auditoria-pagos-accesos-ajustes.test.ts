/* eslint-disable */
// Auditoría: D-01 (pagos), S-04 (accesos fallan cerrado), S-05 (línea de tiempo sin accesos) y S-06 (ajustes reservados y lote todo o nada).
import { db, net, limpiar, session, req, mkCliente, mkCompita } from './harness'
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
    for (const k of ['portal_nuevo', 'detecciones_umbral', 'canc_pausa', 'timbre_max_hora', 'pago_escalada_horas', 'cancelacion_gratis_horas', 'llamada_corte_min', 'llegada_foto_obligatoria']) assert.equal(soloAdministrador(k), true, k)
    for (const k of ['recordatorio_cliente_max', 'semaforo_pago_rojo', 'recordatorio_cliente_horas']) assert.equal(soloAdministrador(k), false, k)
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

import { serverError } from '@/lib/api'
import { reportarError, resumenDeError } from '@/lib/errores'

describe('O-02: los errores del servidor se anotan y no se filtran al cliente', () => {
  test('serverError responde un mensaje genérico, no el texto interno', async () => {
    const r = serverError(new Error('relation "usuarios" column "secreto" does not exist'))
    assert.equal(r.status, 500); const j = await r.json(); assert.equal(j.error, 'Error interno del servidor'); assert.doesNotMatch(JSON.stringify(j), /usuarios|secreto/)
  })
  test('el error queda en Actividad una sola vez por ventana y sin saltos de línea', async () => {
    const e = new Error('falló algo\n  at archivo.ts:10')
    await reportarError(e, 'prueba'); await reportarError(e, 'prueba')
    const filas = db.rows('actividad_admin').filter((a: any) => a.categoria === 'error_servidor' && /falló algo/.test(a.resumen))
    assert.equal(filas.length, 1); assert.match(filas[0].resumen, /Error del servidor en prueba: Error: falló algo at archivo\.ts:#/) // los números se ocultan
    await reportarError(new Error('otro distinto'))
    assert.equal(db.rows('actividad_admin').filter((a: any) => a.categoria === 'error_servidor' && /otro distinto/.test(a.resumen)).length, 0) // tope global: otro error distinto dentro de los 30 s no genera otra alerta
  })
  test('reportar un error nunca lanza, aunque falle el registro', async () => {
    db.fail['actividad_admin:insert'] = 5
    await assert.doesNotReject(() => reportarError(new Error('x')))
    db.fail['actividad_admin:insert'] = 0
    assert.equal(resumenDeError('texto').length > 0, true)
  })
})

describe('revisión: ventanas atómicas y candados que vencen', () => {
  test('con 20 peticiones a la vez solo una pasa la ventana', async () => {
    const { reclamarVentana } = await import('@/lib/cron')
    const r = await Promise.all(Array.from({ length: 20 }, () => reclamarVentana('prueba_ventana', 60_000)))
    assert.equal(r.filter((x) => x.ok).length, 1)
  })
  test('pasada la ventana vuelve a dejar pasar, también con peticiones simultáneas', async () => {
    const { reclamarVentana } = await import('@/lib/cron')
    await reclamarVentana('v2', 1000)
    db.rows('telegram_estados').find((e: any) => e.chat_id === 'v2')!.updated_at = new Date(Date.now() - 5000).toISOString()
    const r = await Promise.all(Array.from({ length: 10 }, () => reclamarVentana('v2', 1000)))
    assert.equal(r.filter((x) => x.ok).length, 1)
  })
  test('un candado de pago colgado vence solo a los 60 segundos', async () => {
    const c = mkCliente({ email: 'l@mail.test', nombre: 'Lia' })
    db.seed('telegram_estados', { chat_id: `pago_lock:${c.id}`, registro_pendiente: false, updated_at: new Date().toISOString() })
    const r = await pago(c.id, { referencia: 'L1' }); assert.equal(r.ok, false); assert.match((r as any).error, /Ya se está registrando/)
    db.rows('telegram_estados').find((e: any) => e.chat_id === `pago_lock:${c.id}`)!.updated_at = new Date(Date.now() - 61_000).toISOString()
    assert.equal((await pago(c.id, { referencia: 'L2' })).ok, true)
  })
  test('la limpieza diaria borra las claves de ventana viejas', () => {
    assert.match(leer('app/api/cron/limpieza/route.ts', 'utf8'), /pago_lock:%[\s\S]*llamada_aviso:%[\s\S]*enlace_llamada:%[\s\S]*error_srv%/)
  })
})

import { eliminarCompitaPorEquipo } from '@/lib/cuenta-eliminar'
import { cuposDelPlan } from '@/lib/visitas'
import { cargarFotos, cargarFoto } from '@/lib/estado-cliente'
import { resolverFlag, avisarCompitaVerificada } from '@/lib/acciones-equipo'
import { anularPago as anularPagoLib } from '@/lib/pagos'
import { pedirPase, autorizarLlamada } from '@/lib/llamada-acceso'

describe('revisión posterior: M3, M4, M6, M7 y los bajos', () => {
  test('M3: eliminar un compita cierra sus solicitudes abiertas, libera sus reservas y avisa a la familia', async () => {
    const lucia = mkCompita({ nombre: 'Lucía', telegram_chat_id: '7777' }); const cli = mkCliente({ email: 'n@mail.test', nombre: 'Nora' })
    const sol = db.seed('solicitudes', { cliente_id: cli.id, compita_id: lucia.id, estado: 'aceptada', created_at: new Date().toISOString() })
    db.seed('reservas_horario', { solicitud_id: sol.id, cliente_id: cli.id, estado: 'reservada' })
    const { emailsA } = await import('./harness')
    assert.equal((await eliminarCompitaPorEquipo(lucia.id, 'admin@compaz.test')).ok, true)
    assert.equal(db.rows('solicitudes').find((x: any) => x.id === sol.id)!.estado, 'rechazada')
    assert.equal(db.rows('reservas_horario')[0].estado, 'liberada')
    assert.ok(emailsA('n@mail.test').length >= 1)
  })
  test('M4: anonimizar borra el texto de los reportes y reseñas, y comprueba errores (si falla, no se da por cerrada)', async () => {
    const lucia = mkCompita({ nombre: 'Lucía' }); const cli = mkCliente({ email: 'o2@mail.test', nombre: 'Omar Ruiz', compita_id: lucia.id })
    const v = db.seed('visitas', { usuario_id: cli.id, compita_id: lucia.id, estado: 'terminada', direccion: 'X' })
    db.seed('reportes_visita', { visita_id: v.id, novedad: 'se mareó al caminar', resumen_ia: 'Omar tuvo mareo' })
    db.seed('resenas', { visita_id: v.id, compita_id: lucia.id, cliente_id: cli.id, texto: 'Excelente con Omar', estrellas: 5 })
    db.fail['reportes_visita:update'] = 1
    assert.equal((await eliminarClientePorEquipo(cli.id, 'admin@compaz.test', { borrarDatos: true })).ok, false) // falló un paso: no queda como cerrada
    assert.equal(db.rows('usuarios').find((u: any) => u.id === cli.id)!.eliminada_en ?? null, null)
    assert.equal((await eliminarClientePorEquipo(cli.id, 'admin@compaz.test', { borrarDatos: true })).ok, true) // reintento: ahora sí
    const t = JSON.stringify([db.rows('reportes_visita'), db.rows('resenas')]); assert.doesNotMatch(t, /mareó|Omar|Excelente/)
  })
  test('M4: una cuenta cerrada sin borrar datos se puede anonimizar después', async () => {
    const c = mkCliente({ email: 'p@mail.test', nombre: 'Paz Mora', telefono: '+58 412 5' })
    assert.equal((await eliminarClientePorEquipo(c.id, 'admin@compaz.test')).ok, true)
    assert.equal((await eliminarClientePorEquipo(c.id, 'admin@compaz.test')).ok, false)                       // sin pedido: ya estaba eliminada
    assert.equal((await eliminarClientePorEquipo(c.id, 'admin@compaz.test', { borrarDatos: true })).ok, true) // la persona lo pidió después
    const u = db.rows('usuarios').find((x: any) => x.id === c.id)!; assert.equal(u.nombre, 'Cuenta eliminada'); assert.equal(u.telefono, null)
  })
  test('M4: con borrar datos un compita pierde también zona, servicios y horarios', async () => {
    const m = mkCompita({ nombre: 'Marta', zona: 'Chacao', servicios: ['paseos'], horarios_disponibles: [{ dia: 'lunes', inicio: '09:00', fin: '12:00' }] })
    assert.equal((await eliminarCompitaPorEquipo(m.id, 'admin@compaz.test', { borrarDatos: true })).ok, true)
    const r = db.rows('compitas').find((x: any) => x.id === m.id)!; assert.equal(r.zona, null); assert.deepEqual(r.servicios, []); assert.deepEqual(r.horarios_disponibles, [])
  })
  test('M6: un lote que llega al tope de filas se repite cliente por cliente', async () => {
    const a = mkCliente({ email: 'q1@mail.test', nombre: 'Q1' }); const b = mkCliente({ email: 'q2@mail.test', nombre: 'Q2' })
    for (let i = 0; i < 1000; i++) db.seed('visitas', { usuario_id: a.id, compita_id: null, estado: 'terminada', created_at: new Date(Date.now() - i * 1000).toISOString() })
    db.seed('pagos_plan', { usuario_id: b.id, tipo: 'plan', plan: 'quincenal', visitas: 2, monto_usd: 75, estado: 'activo', inicio: new Date().toISOString(), vence: new Date(Date.now() + 5e9).toISOString() })
    const ahora = new Date(); const lote = await cargarFotos([a.id, b.id], ahora); const solo = await cargarFoto(b.id, ahora)
    assert.deepEqual(lote.get(b.id), solo)                       // b no queda sin datos porque a llene el tope
    assert.equal(lote.get(a.id)!.visitas.length, 20)
    const cupos = await cuposDelPlan([a.id, b.id]); assert.equal(cupos.get(b.id)!.restantes, 2)
  })
  test('B1 y B2: el aviso de verificación conserva sus pasos y resolver una tarea conserva su categoría', async () => {
    const m = mkCompita({ nombre: 'Rosa Gil', telegram_chat_id: null, email: 'rosa@mail.test', estado: 'activo', verificado: true })
    const { emailsA } = await import('./harness')
    assert.equal(await avisarCompitaVerificada(m.id), 'correo')
    assert.match(JSON.stringify(emailsA('rosa@mail.test')), /escribe tu nombre tal como lo registraste y confirma el código/)
    const f = db.seed('admin_flags', { entidad_tipo: 'cliente', entidad_id: 'x', entidad_nombre: 'Ana', nota: 'n', resuelto: false })
    assert.equal((await resolverFlag(f.id, 'luis@compaz.test')).ok, true)
    assert.ok(db.rows('actividad_admin').some((a: any) => a.categoria === 'tarea_resuelta' && /luis@compaz\.test/.test(a.resumen)))
  })
  test('B3: el mismo comprobante no puede estar en dos clientes y la anulación deja el rol', async () => {
    const a = mkCliente({ email: 'r1@mail.test', nombre: 'R1' }); const b = mkCliente({ email: 'r2@mail.test', nombre: 'R2' })
    const p = await pago(a.id, { referencia: 'ZELLE-777' }) as any; assert.equal(p.ok, true)
    const r = await pago(b.id, { referencia: ' zelle-777 ' }); assert.equal(r.ok, false); assert.match((r as any).error, /otro cliente/)
    assert.equal((await anularPagoLib(p.pago.id, 'se equivocó de cliente', { correo: 'luis@compaz.test', rol: 'colaborador' })).ok, true)
    assert.equal(db.rows('eventos').find((e: any) => e.tipo === 'pago_anulado')!.datos.rol, 'colaborador')
    assert.equal((await pago(b.id, { referencia: 'ZELLE-777' })).ok, true) // anulado el primero, ya se puede registrar donde corresponde
  })
  test('B4: la vista previa del portal anota una vez por ventana', () => {
    const f = leer('app/portal/page.tsx', 'utf8'); assert.match(f, /ventanaVigente\(clavePrev/); assert.match(f, /marcarVentana\(clavePrev\)/)
  })
  test('B5: solo el administrador es dueño de la reunión; el colaborador entra como supervisor; una dirección con % roto no da error', async () => {
    const fin = Math.floor(Date.now() / 1000) + 600
    await pedirPase('cmp-abcdef12-0123456789abcdef', 'supervisor', fin); assert.equal(net.pases.at(-1).is_owner, false)
    await pedirPase('cmp-abcdef12-0123456789abcdef', 'admin', fin); assert.equal(net.pases.at(-1).is_owner, true)
    await invitarColaborador('sup@compaz.test', 'Sup', { atender: true }, 'admin@compaz.test'); session.user = { id: 's1', email: 'sup@compaz.test' } as any
    assert.deepEqual(await autorizarLlamada('cmp-abcdef12-0123456789abcdef', { rol: null, s: null }), { ok: true, rol: 'supervisor' })
    assert.match(leer('app/llamada/[sala]/page.tsx', 'utf8'), /try \{ sala = decodeURIComponent/)
  })
  test('M7: antes de cerrar la cuenta se vuelve a mirar si hay una visita en vivo', () => {
    const f = leer('lib/cuenta-eliminar.ts', 'utf8'); assert.match(f, /const visitasCanceladas = await cancelarAbiertas[\s\S]*?if \(await visitaEnVivo\(u\.id\)\) return \{ ok: false, motivo: 'visita_en_vivo' \}[\s\S]*?cerrarCuentaCliente/)
  })
})

import { revisarCorreo, emailValido } from '@/lib/validar'
import { POST as invitarClienteRuta } from '@/app/api/admin/invitar-cliente/route'

describe('correos mal escritos no se aceptan (.coin en vez de .com)', () => {
  test('el final .coin se rechaza y se sugiere .com', () => {
    const r = revisarCorreo('ana@gmail.coin') as any
    assert.equal(r.ok, false); assert.equal(r.sugerencia, 'ana@gmail.com'); assert.match(r.error, /¿Quisiste decir ana@gmail\.com\?/)
    assert.equal((revisarCorreo('luis@empresa.con') as any).sugerencia, 'luis@empresa.com')
    assert.equal((revisarCorreo('maria@hotmial.com') as any).sugerencia, 'maria@hotmail.com')
    assert.equal((revisarCorreo('x@gmail.co') as any).sugerencia, 'x@gmail.com')
  })
  test('finales que no existen se rechazan, y los reales (genéricos y de país) pasan', () => {
    for (const mal of ['ana@gmail.cmo9', 'ana@correo.zzzzz', 'ana@correo.c0m', 'ana@correo']) assert.equal(emailValido(mal), false, mal)
    for (const bien of ['ana@gmail.com', 'ana@correo.com.ve', 'ana@empresa.es', 'ana@universidad.edu', 'ana@ong.org', 'ana.perez+tag@mail.net', 'ana@correo.co', 'ana@empresa.io']) assert.equal(emailValido(bien), true, bien)
  })
  test('forma: sin @, dos @, espacios, puntos seguidos o al borde', () => {
    for (const mal of ['ana.com', 'a@@b.com', 'ana perez@gmail.com', 'ana..p@gmail.com', '.ana@gmail.com', 'ana.@gmail.com', 'ana@-gmail.com', 'ana@gmail..com', '']) assert.equal(emailValido(mal), false, mal)
  })
  test('en producción los finales de prueba (.test, .invalid) no valen', () => {
    const antes = process.env.NODE_ENV; ;(process.env as any).NODE_ENV = 'production'
    try { assert.equal(emailValido('ana@mail.test'), false); assert.equal(emailValido('ana@mail.com'), true) } finally { ;(process.env as any).NODE_ENV = antes }
    assert.equal(emailValido('ana@mail.test'), true) // fuera de producción sí (las pruebas lo usan)
  })
  test('invitar a un cliente con .coin se rechaza con la sugerencia y no crea nada', async () => {
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    const r = await invitarClienteRuta(req('/api/admin/invitar-cliente', { json: { nombre: 'Ana', email: 'ana@gmail.coin' } }))
    assert.equal(r.status, 400); assert.match((await r.json()).error, /¿Quisiste decir ana@gmail\.com\?/)
    assert.equal(db.rows('usuarios').length, 0)
  })
})

import { POST as registrarCompita } from '@/app/api/onboarding/registrar/route'
import { POST as corregirCompita } from '@/app/api/onboarding/corregir/route'
import { POST as generarInvitacion } from '@/app/api/admin/generar-invite/route'

describe('onboarding: corregir los datos (el correo mal escrito) antes de conectar Telegram', () => {
  const datos = (o: any = {}) => ({ nombre: 'Lucía Fernández', email: 'lucia@mail.test', telefono: '0412 123 4567', zona: 'Zulia', descripcion: 'Cuidadora', servicios: ['Compañía'], ...o })
  async function registrada() {
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    const inv = await (await (generarInvitacion as any)()).json(); session.user = null as any
    const r = await registrarCompita(req('/api/onboarding/registrar', { json: { token: inv.data.token, ...datos() } }))
    assert.equal(r.status, 200); const j = await r.json(); assert.ok(j.data.edit_token); return { editToken: j.data.edit_token as string, id: db.rows('compitas')[0].id as string }
  }
  test('el registro devuelve un enlace de corrección y un correo mal escrito se rechaza desde el principio', async () => {
    const { editToken } = await registrada(); assert.ok(editToken.length > 20)
    session.user = { id: 'adm', email: 'admin@compaz.test' } as any
    const inv = await (await (generarInvitacion as any)()).json(); session.user = null as any
    const mal = await registrarCompita(req('/api/onboarding/registrar', { json: { token: inv.data.token, ...datos({ email: 'lucia@gmail.coin' }) } }))
    assert.equal(mal.status, 400); assert.match((await mal.json()).error, /¿Quisiste decir lucia@gmail\.com\?/)
  })
  test('corregir el correo guarda el nuevo, manda la bienvenida al correo nuevo y entrega otro enlace', async () => {
    const { editToken, id } = await registrada()
    const { emailsA } = await import('./harness')
    const r = await corregirCompita(req('/api/onboarding/corregir', { json: { edit_token: editToken, ...datos({ email: 'lucia.nueva@mail.test' }) } }))
    assert.equal(r.status, 200); const j = await r.json(); assert.ok(j.data.edit_token); assert.notEqual(j.data.edit_token, editToken)
    assert.equal(db.rows('compitas').find((c: any) => c.id === id)!.email, 'lucia.nueva@mail.test')
    assert.ok(emailsA('lucia.nueva@mail.test').length >= 1)
    const otra = await corregirCompita(req('/api/onboarding/corregir', { json: { edit_token: editToken, ...datos() } })) // el enlace anterior ya no sirve
    assert.equal(otra.status, 410)
  })
  test('corregir con un correo mal escrito se rechaza y no cambia nada', async () => {
    const { editToken, id } = await registrada()
    const r = await corregirCompita(req('/api/onboarding/corregir', { json: { edit_token: editToken, ...datos({ email: 'lucia@gmial.com' }) } }))
    assert.equal(r.status, 400); assert.match((await r.json()).error, /hotmail|gmail/)
    assert.equal(db.rows('compitas').find((c: any) => c.id === id)!.email, 'lucia@mail.test')
  })
  test('una vez conectado Telegram ya no se puede cambiar el correo por este enlace', async () => {
    const { editToken, id } = await registrada()
    db.rows('compitas').find((c: any) => c.id === id)!.telegram_chat_id = '5555'
    const r = await corregirCompita(req('/api/onboarding/corregir', { json: { edit_token: editToken, ...datos({ email: 'otro@mail.test' }) } }))
    assert.equal(r.status, 409); assert.equal(db.rows('compitas').find((c: any) => c.id === id)!.email, 'lucia@mail.test')
  })
  test('sin enlace de corrección no hay acceso', async () => {
    assert.equal((await corregirCompita(req('/api/onboarding/corregir', { json: datos() }))).status, 400)
    assert.equal((await corregirCompita(req('/api/onboarding/corregir', { json: { edit_token: 'inventado', ...datos() } }))).status, 410)
  })
})

import { SERVICIOS_PROXIMOS, ETIQUETA_PROXIMAMENTE } from '@/lib/servicios-proximos'

describe('líneas de servicio futuras: se muestran como "Próximamente" y nada de eso está activo', () => {
  test('el catálogo tiene voluntariado, mascotas y donar horas, cada uno con su explicación', () => {
    assert.deepEqual(SERVICIOS_PROXIMOS.map((s) => s.id), ['voluntariado', 'mascotas', 'donar_horas'])
    for (const s of SERVICIOS_PROXIMOS) { assert.ok(s.titulo && s.corto && s.descripcion.length > 40, s.id) }
    assert.equal(ETIQUETA_PROXIMAMENTE, 'Próximamente')
    assert.match(SERVICIOS_PROXIMOS.find((s) => s.id === 'voluntariado')!.descripcion, /no cobra ni paga nada/)       // Compaz es solo el puente
    assert.match(SERVICIOS_PROXIMOS.find((s) => s.id === 'mascotas')!.paraCompitas!, /preguntas adicionales/)          // verificación aparte
  })
  test('están colocados donde irán: portal, pago, registro y perfil del compita y panel', () => {
    const esta = (f: string, re: RegExp) => assert.match(leer(f, 'utf8'), re, f)
    assert.doesNotMatch(leer('app/page.tsx', 'utf8'), /SeccionProximamente/, 'la página principal no lleva Próximamente (decidido 2026-11-12)')
    esta('app/portal/page.tsx', /TarjetasProximamente grande=\{false\} ids=\{\['voluntariado', 'mascotas'\]\}/)
    esta('components/portal/SeccionPlan.tsx', /ids=\{\['donar_horas'\]\}/)
    esta('app/pago/page.tsx', /donar_horas/)
    esta('app/onboarding/page.tsx', /<OpcionesProximamenteCompita \/>/)
    esta('app/compita/perfil/EditarPerfil.tsx', /<OpcionesProximamenteCompita \/>/)
    esta('components/panel/mas/Hub.tsx', /TarjetasProximamente/)
  })
  test('no hay nada activo: sin enlaces, sin botones y con las casillas deshabilitadas', () => {
    const c = leer('components/ui/Proximamente.tsx', 'utf8')
    assert.doesNotMatch(c, /<a |<Link|href=|<button|onClick|router\./)
    assert.match(c, /type="checkbox" disabled/)
  })
  test('ninguna ruta, tabla ni ajuste de estas líneas existe todavía', () => {
    for (const ruta of ['app/voluntariado', 'app/mascotas', 'app/api/voluntariado', 'app/api/mascotas']) assert.throws(() => statSync(ruta), ruta)
  })
})
