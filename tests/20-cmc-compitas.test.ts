/* eslint-disable */
// CMC → compitas (Compitas habilitadas en la selección) — nov-2026
//
// Cubre las correcciones obligatorias de Luis (10-nov):
//   · Fotos vacías, incompletas, duplicadas o anómalas se rechazan enteras; el freno no
//     permite retirar a las dos únicas Compitas gestionadas a la vez.
//   · COM- como identificador estable; conflictos con perfiles existentes antes de insertar.
//   · Idempotencia y una sola bienvenida.
//   · Altas inactivas hasta Telegram + perfil + verificación de Juan.
//   · Autorización también en el backend de solicitudes.
//   · Bloqueos manuales intactos; nunca reactiva sola a una suspendida.
//   · Simulación de solo lectura.
//   · Compitas anteriores sin código y demos intactas.
// Y el Apps Script nuevo (docs/cmc/publicar-compitas.gs) ejecutado en una VM contra la ruta real.
import { db, net, session, req, limpiar, SITE, mkCompita, mkCliente, mkSolicitud, mkVisita, ahoraMas } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { POST as publicar, GET as publicarGet } from '@/app/api/cmc/compitas/route'
import { POST as toggleVerificado } from '@/app/api/admin/toggle-verificado/route'
import { POST as toggleEstado } from '@/app/api/admin/toggle-estado/route'
import { POST as crearSolicitudRuta } from '@/app/api/solicitudes/route'
import { POST as registrarOnboarding } from '@/app/api/onboarding/registrar/route'
import { planificar, validarFoto, permiteCmc, limitePerdidas, type FotoCmc, type RegistroFoto } from '@/lib/cmc-compitas'
import { getCompitasActivas } from '@/lib/compitas'
import { asignarCompita } from '@/lib/usuarios'
import { crearSolicitud } from '@/lib/solicitudes'

const TOKEN = 'cmc-escritura-de-pruebas-0123456789abcdef'
const raiz = process.cwd()

// ── Utilidades ─────────────────────────────────────────────────────────────────
function reg(codigo: string, o: Partial<RegistroFoto> = {}): RegistroFoto {
  const n = codigo.slice(-4)
  return { codigo, nombre: `Compita ${n}`, email: `c${n}@mail.test`, ubicacion: 'Valencia, Carabobo', etapa: 'Habilitado', estado_operativo: 'Activo', acepta_nuevos: 'Sí', ...o }
}
function foto(compitas: RegistroFoto[], o: Partial<FotoCmc> = {}): FotoCmc {
  return { version: 1, generado_en: new Date().toISOString(), filas_leidas: 1000, completo: true, desactivacion_masiva_autorizada: false, compitas, ...o }
}
const enviar = (f: unknown, o: { dryRun?: boolean; token?: string | null } = {}) =>
  publicar(req('/api/cmc/compitas' + (o.dryRun ? '?dryRun=1' : ''), {
    method: 'POST', body: JSON.stringify(f),
    headers: { 'content-type': 'application/json', ...(o.token === null ? {} : { authorization: 'Bearer ' + (o.token ?? TOKEN) }) },
  }))
const aplicar = async (f: unknown) => { const r = await enviar(f); return { status: r.status, body: await r.json() } }
const porCodigo = (c: string) => db.rows('compitas').find((x) => x.codigo === c)
const foto2 = () => JSON.parse(JSON.stringify(db.tables))
const admin = () => { session.user = { id: 'adm', email: 'admin@compaz.test' } }

/** Compita ya gestionada por el CMC, activa, verificada y con Telegram (en la oferta). */
function gestionada(codigo: string, o: Record<string, any> = {}) {
  return mkCompita({ codigo, nombre: `Compita ${codigo.slice(-4)}`, email: `c${codigo.slice(-4)}@mail.test`, cmc_permite: true, cmc_estado: 'Habilitado · Activo · Acepta: Sí', cmc_bienvenida_enviada_en: '2026-11-01T00:00:00.000Z', ...o })
}
/** Compitas anteriores al CMC (Lorna, Reyna) y una demo: no deben cambiar nunca. */
function anteriores() {
  return [
    mkCompita({ nombre: 'Lorna Anterior', email: 'lorna@mail.test' }),
    mkCompita({ nombre: 'Reyna Anterior', email: 'reyna@mail.test' }),
    mkCompita({ nombre: 'Demo Uno', email: null, telegram_chat_id: null, es_demo: true }),
  ]
}

beforeEach(() => {
  limpiar()
  process.env.CMC_ESCRITURA_TOKEN = TOKEN
  process.env.CMC_COMPITAS_MODO = 'aplicar'
})

// ═══ 1. Ruta: seguridad y modos ═════════════════════════════════════════════════
describe('POST /api/cmc/compitas — seguridad y modos', () => {
  test('sin CMC_ESCRITURA_TOKEN → 503; token ausente o erróneo → 401; GET → 405; sin caché', async () => {
    delete process.env.CMC_ESCRITURA_TOKEN
    assert.equal((await enviar(foto([]))).status, 503)
    process.env.CMC_ESCRITURA_TOKEN = TOKEN
    assert.equal((await enviar(foto([]), { token: null })).status, 401)
    assert.equal((await enviar(foto([]), { token: 'otro' })).status, 401)
    const r = await enviar(foto([]))
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('cache-control'), 'no-store')
    assert.equal(publicarGet().status, 405)
  })

  test('cuerpo inválido → 400 (JSON roto, versión, filas_leidas, fecha, demasiados registros)', async () => {
    const malo = async (b: unknown) => (await publicar(req('/api/cmc/compitas', { method: 'POST', body: typeof b === 'string' ? b : JSON.stringify(b), headers: { authorization: 'Bearer ' + TOKEN } }))).status
    assert.equal(await malo('{no json'), 400)
    assert.equal(await malo({ ...foto([]), version: 2 }), 400)
    assert.equal(await malo({ ...foto([]), filas_leidas: -1 }), 400)
    assert.equal(await malo({ ...foto([]), generado_en: 'ayer' }), 400)
    assert.equal(await malo({ ...foto([]), compitas: Array.from({ length: 2001 }, (_, i) => reg(`COM-${String(i).padStart(4, '0')}`)) }), 400)
    assert.equal(db.rows('compitas').length, 0)
  })

  test('modo por defecto = SIMULAR: sin CMC_COMPITAS_MODO=aplicar no escribe nada', async () => {
    delete process.env.CMC_COMPITAS_MODO
    const r = await aplicar(foto([reg('COM-0025')]))
    assert.equal(r.status, 200)
    assert.equal(r.body.data.modo, 'simular')
    assert.deepEqual(r.body.data.resumen.altas, ['COM-0025'])
    assert.equal(db.rows('compitas').length, 0)
  })

  test('?dryRun=1 simula aunque el entorno diga aplicar', async () => {
    const r = await enviar(foto([reg('COM-0025')]), { dryRun: true })
    assert.equal((await r.json()).data.modo, 'simular')
    assert.equal(db.rows('compitas').length, 0)
  })
})

// ═══ 2. Simulación de solo lectura ═══════════════════════════════════════════════
describe('Simulación: solo lecturas', () => {
  test('no cambia ninguna tabla, ni envía correos ni Telegram, ni registra — con altas, restricciones y rechazo', async () => {
    anteriores()
    gestionada('COM-0187')
    const suspendida = gestionada('COM-0300')
    mkCliente({ compita_id: suspendida.id })
    const antes = foto2()
    for (const f of [
      foto([reg('COM-0025'), reg('COM-0187'), reg('COM-0300', { estado_operativo: 'Suspendido' })]), // altas + restricción
      foto([], { filas_leidas: 1000 }),                                                                // rechazo (lista vacía)
    ]) {
      const r = await enviar(f, { dryRun: true })
      assert.equal(r.status, 200)
    }
    assert.deepEqual(foto2(), antes)
    assert.equal(net.emails.length, 0)
    assert.equal(net.tg.length, 0)
  })

  test('la simulación devuelve el plan: altas, restricciones, bienvenidas y rechazo', async () => {
    gestionada('COM-0187')
    const r = await (await enviar(foto([reg('COM-0025'), reg('COM-0187', { acepta_nuevos: 'No' })]), { dryRun: true })).json()
    assert.equal(r.data.rechazo, null)
    assert.deepEqual(r.data.resumen.altas, ['COM-0025'])
    assert.deepEqual(r.data.resumen.restringidas, ['COM-0187'])
    assert.deepEqual(r.data.resumen.bienvenidas, ['COM-0025'])
    const rech = await (await enviar(foto([]), { dryRun: true })).json()
    assert.match(rech.data.rechazo, /Lista vacía/)
  })
})

// ═══ 3. Altas, COM- estable, conflictos, idempotencia, bienvenida ═══════════════
describe('Altas desde el CMC', () => {
  test('alta inactiva y sin verificar, con COM-, zona provisional y una bienvenida; no aparece en la oferta', async () => {
    const r = await aplicar(foto([reg('COM-0025', { ubicacion: 'Guacara, Carabobo' }), reg('COM-0187', { ubicacion: '' })]))
    assert.equal(r.status, 200)
    const c = porCodigo('COM-0025')!
    assert.equal(c.estado, 'inactivo')
    assert.equal(c.verificado, false)
    assert.equal(c.es_demo, false)
    assert.equal(c.cmc_permite, true)
    assert.equal(c.zona, 'Guacara, Carabobo')
    assert.equal(porCodigo('COM-0187')!.zona, 'Por confirmar')
    assert.equal(net.emails.filter((e) => e.to === 'c0025@mail.test').length, 1)
    assert.ok(c.cmc_bienvenida_enviada_en)
    assert.equal((await getCompitasActivas()).length, 0)
    assert.equal(db.rows('cmc_sincronizaciones').length, 1)
    assert.equal(db.rows('cmc_sincronizaciones')[0].estado, 'aplicada')
  })

  test('idempotente: la misma foto 3 veces = 0 cambios, 0 duplicados y una sola bienvenida', async () => {
    const f = foto([reg('COM-0025'), reg('COM-0187')])
    await aplicar(f)
    const tras1 = JSON.stringify(db.rows('compitas'))
    for (let i = 0; i < 2; i++) {
      const r = await aplicar(f)
      assert.deepEqual(r.body.data.resumen.altas, [])
      assert.deepEqual(r.body.data.resumen.actualizadas, [])
      assert.deepEqual(r.body.data.resumen.bienvenidas, [])
    }
    assert.equal(JSON.stringify(db.rows('compitas')), tras1)
    assert.equal(db.rows('compitas').length, 2)
    assert.equal(net.emails.length, 2)
  })

  test('bienvenida: si el correo falla se libera la reserva y se reintenta en la siguiente foto (una sola entrega)', async () => {
    net.resendFail = true
    const r1 = await aplicar(foto([reg('COM-0025')]))
    assert.equal(porCodigo('COM-0025')!.cmc_bienvenida_enviada_en, null)
    assert.equal(r1.body.data.resumen.errores.length, 1)
    net.resendFail = false
    await aplicar(foto([reg('COM-0025')]))
    await aplicar(foto([reg('COM-0025')]))
    assert.equal(net.emails.length, 1)
  })

  test('sin bienvenida mientras el CMC no permite (habilitada pero pausada); llega al reactivarse', async () => {
    await aplicar(foto([reg('COM-0025', { estado_operativo: 'Pausado' })]))
    assert.equal(net.emails.length, 0)
    assert.equal(porCodigo('COM-0025')!.cmc_permite, false)
    await aplicar(foto([reg('COM-0025')]))
    assert.equal(net.emails.length, 1)
    assert.equal(porCodigo('COM-0025')!.estado, 'inactivo') // sigue inactiva: la activa Juan
  })

  test('conflictos antes de insertar: email de una Compita anterior, nombre de una anterior sin código, email de otro COM-', async () => {
    const [lorna, reyna] = anteriores()
    gestionada('COM-0100', { email: 'compartido@mail.test' })
    const r = await aplicar(foto([
      reg('COM-0100', { email: 'compartido@mail.test' }),
      reg('COM-0201', { email: 'LORNA@mail.test' }),                     // mismo email que Lorna (sin código)
      reg('COM-0202', { nombre: 'reyna  anterior', email: 'otra@mail.test' }), // mismo nombre que Reyna
      reg('COM-0203', { email: 'compartido@mail.test' }),               // persona repetida en el CMC
      reg('COM-0204'),
    ]))
    assert.equal(r.status, 200)
    assert.deepEqual(r.body.data.resumen.altas, ['COM-0204'])
    assert.deepEqual(r.body.data.resumen.conflictos.sort(), ['COM-0201 (email_existente)', 'COM-0202 (nombre_existente)', 'COM-0203 (email_existente)'])
    for (const c of ['COM-0201', 'COM-0202', 'COM-0203']) assert.equal(porCodigo(c), undefined)
    // Lorna y Reyna siguen sin código
    assert.equal(db.rows('compitas').find((x) => x.id === lorna.id)!.codigo, null)
    assert.equal(db.rows('compitas').find((x) => x.id === reyna.id)!.codigo, null)
    // Avisos en Atención solo la primera vez
    assert.equal(db.rows('admin_flags').filter((f) => /conflicto/.test(f.entidad_nombre)).length, 3)
    await aplicar(foto([reg('COM-0100', { email: 'compartido@mail.test' }), reg('COM-0201', { email: 'lorna@mail.test' }), reg('COM-0202', { nombre: 'Reyna Anterior', email: 'otra@mail.test' }), reg('COM-0203', { email: 'compartido@mail.test' }), reg('COM-0204')]))
    assert.equal(db.rows('admin_flags').filter((f) => /conflicto/.test(f.entidad_nombre)).length, 3)
  })

  test('dos COM- distintos con el mismo email en la misma foto: solo se crea el primero', async () => {
    const r = await aplicar(foto([reg('COM-0301', { email: 'misma@mail.test' }), reg('COM-0302', { email: 'misma@mail.test' })]))
    assert.deepEqual(r.body.data.resumen.altas, ['COM-0301'])
    assert.deepEqual(r.body.data.resumen.conflictos, ['COM-0302 (email_existente)'])
  })

  test('el COM- es estable: cambios de nombre o email en el CMC no tocan el perfil existente', async () => {
    await aplicar(foto([reg('COM-0025')]))
    const id = porCodigo('COM-0025')!.id
    await aplicar(foto([reg('COM-0025', { nombre: 'Otro Nombre', email: 'nuevo@mail.test' })]))
    const c = porCodigo('COM-0025')!
    assert.equal(c.id, id)
    assert.equal(c.nombre, 'Compita 0025')
    assert.equal(c.email, 'c0025@mail.test')
    assert.equal(db.rows('compitas').length, 1)
  })
})

// ═══ 4. Estados: suspensión, reactivación, bloqueo, ausencia ═══════════════════
describe('Cambios de estado desde el CMC', () => {
  test('suspendida: fuera de la oferta y sin solicitudes nuevas; conserva clientes, visitas y solicitudes; aviso a Juan', async () => {
    const c = gestionada('COM-0187')
    gestionada('COM-0025'); gestionada('COM-0026'); gestionada('COM-0027')
    const cli = mkCliente({ compita_id: c.id })
    const v = mkVisita(cli, c, { estado: 'programada' })
    const s = mkSolicitud(mkCliente(), c)
    const r = await aplicar(foto([reg('COM-0187', { estado_operativo: 'Suspendido' }), reg('COM-0025'), reg('COM-0026'), reg('COM-0027')]))
    assert.equal(r.status, 200)
    const d = porCodigo('COM-0187')!
    assert.equal(d.estado, 'inactivo')
    assert.equal(d.verificado, false)
    assert.equal(d.cmc_permite, false)
    assert.ok(d.telegram_chat_id) // conserva Telegram
    assert.equal(db.rows('usuarios').find((u) => u.id === cli.id)!.compita_id, c.id)
    assert.equal(db.rows('visitas').find((x) => x.id === v.id)!.estado, 'programada')
    assert.equal(db.rows('solicitudes').find((x) => x.id === s.id)!.estado, 'pendiente')
    const flag = db.rows('admin_flags').find((f) => f.entidad_id === c.id)!
    assert.match(flag.nota, /1 cliente\(s\).*1 solicitud\(es\).*1 visita\(s\)/)
    assert.ok(net.tg.some((m) => m.chat === '999' && /Retiradas de la oferta/.test(m.text)))
    assert.ok(!(await getCompitasActivas()).some((x) => x.id === c.id))
  })

  test('reactivada en el CMC: recupera el permiso pero NO se activa sola; Juan la verifica', async () => {
    gestionada('COM-0025'); gestionada('COM-0026'); gestionada('COM-0027')
    const c = gestionada('COM-0187')
    const resto = [reg('COM-0025'), reg('COM-0026'), reg('COM-0027')]
    await aplicar(foto([reg('COM-0187', { estado_operativo: 'Suspendido' }), ...resto]))
    await aplicar(foto([reg('COM-0187'), ...resto]))
    const d = porCodigo('COM-0187')!
    assert.equal(d.cmc_permite, true)
    assert.equal(d.estado, 'inactivo')
    assert.equal(d.verificado, false)
    admin()
    assert.equal((await toggleEstado(req('/api/admin/toggle-estado', { json: { compita_id: c.id, estado: 'activo' } }))).status, 200)
    assert.equal((await toggleVerificado(req('/api/admin/toggle-verificado', { json: { compita_id: c.id, verificado: true } }))).status, 200)
    assert.ok((await getCompitasActivas()).some((x) => x.id === c.id))
  })

  test('pausada, de baja o «Acepta nuevos = No» también salen de la oferta; valores desconocidos = no permite', async () => {
    for (const c of ['COM-0001', 'COM-0002', 'COM-0003', 'COM-0004', 'COM-0005', 'COM-0006', 'COM-0007', 'COM-0008', 'COM-0009', 'COM-0010', 'COM-0011', 'COM-0012', 'COM-0013', 'COM-0014', 'COM-0015', 'COM-0016']) gestionada(c)
    const extra = ['COM-0005', 'COM-0006', 'COM-0007', 'COM-0008', 'COM-0009', 'COM-0010', 'COM-0011', 'COM-0012', 'COM-0013', 'COM-0014', 'COM-0015', 'COM-0016'].map((c) => reg(c))
    const r = await aplicar(foto([reg('COM-0001', { estado_operativo: 'Pausado' }), reg('COM-0002', { estado_operativo: 'Baja' }), reg('COM-0003', { acepta_nuevos: 'No' }), reg('COM-0004', { estado_operativo: 'Vacaciones' }), ...extra]))
    assert.equal(r.status, 200)
    for (const c of ['COM-0001', 'COM-0002', 'COM-0003', 'COM-0004']) {
      assert.equal(porCodigo(c)!.cmc_permite, false, c)
      assert.equal(porCodigo(c)!.estado, 'inactivo', c)
    }
    assert.deepEqual(r.body.data.resumen.valores_desconocidos, ['COM-0004: «Vacaciones»'])
  })

  test('bloqueo manual: el CMC nunca lo sobrescribe ni lo deshace (solo actualiza su estado CMC)', async () => {
    gestionada('COM-0025'); gestionada('COM-0026'); gestionada('COM-0027')
    const b = gestionada('COM-0187', { estado: 'bloqueado', verificado: false, telegram_chat_id: null })
    await aplicar(foto([reg('COM-0187'), reg('COM-0025'), reg('COM-0026'), reg('COM-0027')]))
    assert.equal(porCodigo('COM-0187')!.estado, 'bloqueado')
    await aplicar(foto([reg('COM-0187', { estado_operativo: 'Suspendido' }), reg('COM-0025'), reg('COM-0026'), reg('COM-0027')]))
    const d = porCodigo('COM-0187')!
    assert.equal(d.estado, 'bloqueado')
    assert.equal(d.cmc_permite, false)
    assert.equal(db.rows('admin_flags').filter((f) => f.entidad_id === b.id).length, 0)
  })

  test('una gestionada que deja de figurar como Habilitado pierde el permiso (nunca se borra)', async () => {
    for (const c of ['COM-0025', 'COM-0026', 'COM-0027', 'COM-0187']) gestionada(c)
    await aplicar(foto([reg('COM-0025'), reg('COM-0026'), reg('COM-0027')]))
    const d = porCodigo('COM-0187')!
    assert.equal(d.cmc_permite, false)
    assert.equal(d.estado, 'inactivo')
    assert.match(d.cmc_estado, /Ya no figura/)
  })

  test('Juan no puede verificar ni reactivar a una Compita que el CMC no permite (409)', async () => {
    const c = gestionada('COM-0187', { estado: 'inactivo', verificado: false, cmc_permite: false, cmc_estado: 'Habilitado · Suspendido · Acepta: No' })
    admin()
    const rv = await toggleVerificado(req('/api/admin/toggle-verificado', { json: { compita_id: c.id, verificado: true } }))
    assert.equal(rv.status, 409)
    assert.match((await rv.json()).error, /CMC no permite/)
    assert.equal((await toggleEstado(req('/api/admin/toggle-estado', { json: { compita_id: c.id, estado: 'activo' } }))).status, 409)
    assert.equal(porCodigo('COM-0187')!.estado, 'inactivo')
  })
})

// ═══ 5. Fotos anómalas y freno de seguridad ═════════════════════════════════════
describe('Fotos anómalas (falla cerrado)', () => {
  test('freno: con 2 gestionadas no se pueden retirar las dos a la vez (ni por ausencia ni por estado)', async () => {
    gestionada('COM-0025'); gestionada('COM-0187')
    const antes = JSON.stringify(db.rows('compitas'))
    for (const f of [
      foto([reg('COM-0025', { estado_operativo: 'Suspendido' }), reg('COM-0187', { estado_operativo: 'Pausado' })]),
      foto([reg('COM-0999')]),                                // las dos «desaparecen»
      foto([reg('COM-0025', { etapa: '' }), reg('COM-0187', { etapa: 'Registrado' })]),
    ]) {
      const r = await aplicar(f)
      assert.equal(r.status, 409)
      assert.match(r.body.error, /Freno de seguridad/)
    }
    assert.equal(JSON.stringify(db.rows('compitas')), antes)
    assert.equal(db.rows('compitas').length, 2) // ni siquiera la alta COM-0999
    assert.equal(db.rows('cmc_sincronizaciones').filter((s) => s.estado === 'rechazada').length, 3)
    // Aviso de rechazo como máximo una vez cada 6 h
    assert.equal(net.tg.filter((m) => /foto rechazada/.test(m.text)).length, 1)
  })

  test('freno: con 2 gestionadas, retirar UNA sí se aplica (suspensión normal)', async () => {
    gestionada('COM-0025'); gestionada('COM-0187')
    const r = await aplicar(foto([reg('COM-0025'), reg('COM-0187', { estado_operativo: 'Suspendido' })]))
    assert.equal(r.status, 200)
    assert.equal(porCodigo('COM-0187')!.estado, 'inactivo')
    assert.equal(porCodigo('COM-0025')!.estado, 'activo')
  })

  test('freno: retirada masiva solo con autorización expresa del CMC', async () => {
    gestionada('COM-0025'); gestionada('COM-0187')
    const r = await aplicar(foto([reg('COM-0025', { estado_operativo: 'Baja' }), reg('COM-0187', { estado_operativo: 'Baja' })], { desactivacion_masiva_autorizada: true }))
    assert.equal(r.status, 200)
    assert.equal(porCodigo('COM-0025')!.estado, 'inactivo')
    assert.equal(porCodigo('COM-0187')!.estado, 'inactivo')
  })

  test('límite del freno según el tamaño: 1→1, 2→1, 4→1, 8→2, 20→5', () => {
    assert.deepEqual([1, 2, 4, 8, 20].map(limitePerdidas), [1, 1, 1, 2, 5])
  })

  test('lista vacía con gestionadas habilitadas → rechazo; sin gestionadas → se acepta sin cambios', async () => {
    anteriores()
    assert.equal((await aplicar(foto([]))).status, 200)
    gestionada('COM-0025')
    const r = await aplicar(foto([]))
    assert.equal(r.status, 409)
    assert.match(r.body.error, /Lista vacía/)
    assert.equal(porCodigo('COM-0025')!.estado, 'activo')
  })

  test('foto incompleta o con más registros que filas leídas → rechazo', async () => {
    assert.equal((await aplicar(foto([reg('COM-0025')], { completo: false }))).status, 409)
    assert.equal((await aplicar(foto([reg('COM-0025'), reg('COM-0026')], { filas_leidas: 1 }))).status, 409)
    assert.equal(db.rows('compitas').length, 0)
  })

  test('caída brusca de filas leídas (>20 %) frente a la última foto aplicada → rechazo', async () => {
    await aplicar(foto([reg('COM-0025')], { filas_leidas: 1000 }))
    const r = await aplicar(foto([reg('COM-0025'), reg('COM-0026')], { filas_leidas: 700 }))
    assert.equal(r.status, 409)
    assert.match(r.body.error, /Lectura incompleta/)
    assert.equal(porCodigo('COM-0026'), undefined)
    assert.equal((await aplicar(foto([reg('COM-0025'), reg('COM-0026')], { filas_leidas: 950 }))).status, 200)
  })

  test('COM- duplicado en la foto: queda en cuarentena (ni se crea ni cambia ni «desaparece»); el resto se aplica', async () => {
    gestionada('COM-0274'); gestionada('COM-0025'); gestionada('COM-0026'); gestionada('COM-0027')
    const r = await aplicar(foto([
      reg('COM-0274', { estado_operativo: 'Suspendido' }), reg('COM-0274'), // duplicado (como en la hoja 03)
      reg('COM-0318'), reg('COM-0318'),
      reg('COM-0025'), reg('COM-0026'), reg('COM-0027'), reg('COM-0500'),
    ]))
    assert.equal(r.status, 200)
    assert.deepEqual(r.body.data.resumen.cuarentena, ['COM-0274 (codigo_duplicado)', 'COM-0318 (codigo_duplicado)'])
    assert.equal(porCodigo('COM-0274')!.estado, 'activo')
    assert.equal(porCodigo('COM-0274')!.cmc_permite, true)
    assert.equal(porCodigo('COM-0318'), undefined)
    assert.ok(porCodigo('COM-0500'))
  })

  test('demasiados registros inválidos o duplicados → rechazo entero', async () => {
    const r = await aplicar(foto([reg('X-1'), reg('COM-1'), reg(''), reg('COM-0025')]))
    assert.equal(r.status, 409)
    assert.match(r.body.error, /Demasiados registros/)
    assert.equal(db.rows('compitas').length, 0)
  })
})

// ═══ 6. Históricos, anteriores sin código y demos ═══════════════════════════════
describe('Datos históricos intactos', () => {
  test('Compitas anteriores sin código y demos no cambian en ninguna foto, aplicada o rechazada', async () => {
    const viejas = anteriores()
    const instantanea = () => JSON.stringify(db.rows('compitas').filter((c) => viejas.some((v) => v.id === c.id)))
    const antes = instantanea()
    gestionada('COM-0025'); gestionada('COM-0187')
    await aplicar(foto([reg('COM-0025'), reg('COM-0187'), reg('COM-0300')]))
    await aplicar(foto([reg('COM-0025', { estado_operativo: 'Suspendido' }), reg('COM-0187'), reg('COM-0300')]))
    await aplicar(foto([])) // rechazada
    assert.equal(instantanea(), antes)
    assert.ok((await getCompitasActivas()).some((c) => c.nombre === 'Lorna Anterior'))
  })

  test('planificar es una función pura: no muta sus entradas', () => {
    const actuales = [{ id: 'a', codigo: 'COM-0025', nombre: 'A', email: 'a@x.test', estado: 'activo', verificado: true, es_demo: false, cmc_permite: true, cmc_estado: 'x', cmc_bienvenida_enviada_en: null }]
    const f = foto([reg('COM-0025', { estado_operativo: 'Suspendido' }), reg('COM-0026')])
    const copia = JSON.stringify([actuales, f])
    const p = planificar(f, actuales, null)
    assert.equal(JSON.stringify([actuales, f]), copia)
    assert.equal(p.actualizaciones[0].despues.estado, 'inactivo')
  })

  test('permiteCmc tolera tildes, mayúsculas y espacios', () => {
    assert.equal(permiteCmc({ etapa: ' habilitado ', estado_operativo: 'ACTIVO', acepta_nuevos: 'si' }), true)
    assert.equal(permiteCmc({ etapa: 'Habilitado', estado_operativo: 'Activo', acepta_nuevos: '' }), false)
    assert.equal(validarFoto({ ...foto([reg('com-0025')]) }).ok && (validarFoto(foto([reg('com-0025')])) as any).foto.compitas[0].codigo, 'COM-0025')
  })
})

// ═══ 7. Autorización en el backend de solicitudes y asignaciones ══════════════════
describe('Backend: sin permiso del CMC no hay solicitudes ni asignaciones nuevas', () => {
  test('ruta /api/solicitudes y crearSolicitud rechazan Compitas con cmc_permite = false', async () => {
    const c = gestionada('COM-0187', { cmc_permite: false }) // aun activa y verificada (p. ej. carrera)
    const cli = mkCliente()
    session.user = { id: cli.id, email: cli.email }
    const r = await crearSolicitudRuta(req('/api/solicitudes', { json: { compita_id: c.id, mensaje: 'hola', slots_propuestos: [ahoraMas(120)] } }))
    assert.equal(r.status, 400)
    assert.match((await r.json()).error, /no está disponible/)
    await assert.rejects(crearSolicitud({ cliente_id: cli.id, compita_id: c.id, mensaje: 'x', slots_propuestos: [ahoraMas(120)] }), /no está disponible/)
    assert.equal(db.rows('solicitudes').length, 0)
  })

  test('crearSolicitud también rechaza Compitas inactivas o sin verificar (llamada directa al backend)', async () => {
    const cli = mkCliente()
    for (const o of [{ estado: 'inactivo' }, { verificado: false }, { estado: 'bloqueado' }]) {
      const c = mkCompita(o)
      await assert.rejects(crearSolicitud({ cliente_id: cli.id, compita_id: c.id, mensaje: 'x', slots_propuestos: [ahoraMas(120)] }), /no está disponible/)
    }
  })

  test('Compitas anteriores (cmc_permite NULL) siguen recibiendo solicitudes como hoy', async () => {
    const [lorna] = anteriores()
    const s = await crearSolicitud({ cliente_id: mkCliente().id, compita_id: lorna.id, mensaje: 'x', slots_propuestos: [ahoraMas(120)] })
    assert.equal(s.estado, 'pendiente')
  })

  test('asignarCompita rechaza Compitas sin permiso del CMC', async () => {
    const c = gestionada('COM-0187', { cmc_permite: false })
    await assert.rejects(asignarCompita(mkCliente().id, c.id), /permiso del CMC/)
  })

  test('la invitación por enlace no duplica un perfil creado desde el CMC', async () => {
    await aplicar(foto([reg('COM-0025')]))
    db.seed('onboarding_tokens', { token: 'tok-1', expires_at: ahoraMas(60) })
    const r = await registrarOnboarding(req('/api/onboarding/registrar', { json: { token: 'tok-1', email: 'C0025@mail.test', nombre: 'Compita 0025', zona: 'Carabobo — Valencia', descripcion: 'Hola, soy compita', servicios: ['Compañía'] } }))
    assert.equal(r.status, 409)
    assert.equal(db.rows('compitas').length, 1)
    assert.equal(db.rows('onboarding_tokens')[0].usado, false) // el token no se gasta
  })
})

// ═══ 8. Apps Script nuevo (VM) contra la ruta real ═══════════════════════════════
describe('Apps Script: docs/cmc/publicar-compitas.gs', () => {
  const CAB = ['ID Compita', 'Fecha registro', 'Nombre', 'WhatsApp', 'Email', 'Ubicación declarada', 'Etapa de selección', 'Estado operativo', 'Acepta nuevos servicios', 'Clasificación duplicado', 'Observaciones']
  function hoja(extra: string[][] = []) {
    const filas: string[][] = []
    for (let i = 1; i <= 60; i++) filas.push([`COM-${String(i + 100).padStart(4, '0')}`, '01/10/2026', `Aspirante ${i}`, '+58', `a${i}@mail.test`, 'Caracas', 'Registrado', '', '', '', 'privado'])
    return [CAB, ...filas, ...extra]
  }
  const HAB = (codigo: string, o: Partial<Record<'estado' | 'acepta' | 'dup', string>> = {}) =>
    [codigo, '15/09/2026', `Hab ${codigo}`, '+58412', `${codigo.toLowerCase()}@mail.test`, 'Valencia, Carabobo', 'Habilitado', o.estado ?? 'Activo', o.acepta ?? 'Sí', o.dup ?? 'Canónico', 'NO DEBE SALIR']

  function cargar(valores: string[][], props: Record<string, string>) {
    const llamadas: any[] = []
    const ctx: any = {
      console: { log: () => {} },
      PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null, setProperty: (k: string, v: string) => { props[k] = v }, deleteProperty: (k: string) => { delete props[k] } }) },
      LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
      SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n: string) => (n === '03 · Compitas' ? { getDataRange: () => ({ getDisplayValues: () => valores }) } : null) }) },
      ScriptApp: { getProjectTriggers: () => [] },
      UrlFetchApp: {
        fetch: (url: string, op: any) => { llamadas.push({ url, op }); return llamadas[llamadas.length - 1].respuesta },
      },
    }
    vm.createContext(ctx)
    vm.runInContext(readFileSync(path.join(raiz, 'docs/cmc/publicar-compitas.gs'), 'utf8'), ctx)
    return { ctx, llamadas, props }
  }
  const PROPS = () => ({ CMC_COMPITAS_URL: `${SITE}/api/cmc/compitas`, CMC_ESCRITURA_TOKEN: TOKEN, CMC_PUBLICAR_COMPITAS: 'si' })

  test('construye la foto: solo Habilitado, sin «Duplicado confirmado», solo 7 campos, columnas por nombre', () => {
    const v = hoja([HAB('COM-0025'), HAB('COM-0187', { estado: 'Suspendido', acepta: 'No' }), HAB('COM-0274', { dup: 'Duplicado confirmado' })])
    // columnas reordenadas
    const orden = [4, 0, 2, 1, 3, 5, 9, 6, 7, 8, 10]
    const reord = v.map((f) => orden.map((i) => f[i]))
    const { ctx } = cargar(reord, PROPS())
    const f = JSON.parse(JSON.stringify(ctx.construirFotoCompitas_(reord, new Date('2026-11-11T00:00:00Z'))))
    assert.equal(f.filas_leidas, 63)
    assert.equal(f.completo, true)
    assert.deepEqual(f.compitas.map((c: any) => c.codigo), ['COM-0025', 'COM-0187'])
    assert.deepEqual(Object.keys(f.compitas[0]).sort(), ['acepta_nuevos', 'codigo', 'email', 'estado_operativo', 'etapa', 'nombre', 'ubicacion'])
    assert.ok(!JSON.stringify(f).includes('NO DEBE SALIR'))
    assert.ok(!JSON.stringify(f).includes('+58'))
  })

  test('falla cerrado: columna que falta, lectura corta, sin token o sin URL → no envía nada', () => {
    const { ctx, llamadas } = cargar(hoja(), PROPS())
    assert.throws(() => ctx.construirFotoCompitas_([CAB.filter((c) => c !== 'Estado operativo'), ['COM-0001']], new Date()), /falta la columna/)
    assert.throws(() => ctx.construirFotoCompitas_(hoja().slice(0, 10), new Date()), /lectura sospechosa/)
    for (const quitar of ['CMC_ESCRITURA_TOKEN', 'CMC_COMPITAS_URL']) {
      const p = PROPS(); delete (p as any)[quitar]
      const x = cargar(hoja(), p)
      assert.throws(() => x.ctx.publicarCompitasWeb(), /FAIL-CLOSED/)
      assert.equal(x.llamadas.length, 0)
    }
    assert.equal(llamadas.length, 0)
  })

  test('interruptor apagado: el disparador no envía nada', () => {
    const p = { ...PROPS(), CMC_PUBLICAR_COMPITAS: 'no' }
    const { ctx, llamadas } = cargar(hoja([HAB('COM-0025')]), p)
    assert.deepEqual(JSON.parse(JSON.stringify(ctx.publicarCompitasWeb())), { omitido: 'apagado' })
    assert.equal(llamadas.length, 0)
  })

  test('de extremo a extremo: simulación (?dryRun=1, sin escrituras) y luego aplicación contra la ruta real', async () => {
    const props: Record<string, string> = PROPS()
    const { ctx, llamadas } = cargar(hoja([HAB('COM-0025'), HAB('COM-0187')]), props)
    // UrlFetchApp síncrono: se prepara la respuesta con la ruta real antes de que el script la lea
    const ejecutar = async (fn: string) => {
      let resultado: any, error: any
      const original = ctx.UrlFetchApp.fetch
      const pend: Promise<void>[] = []
      ctx.UrlFetchApp.fetch = (url: string, op: any) => {
        llamadas.push({ url, op })
        throw Object.assign(new Error('__pendiente__'), { url, op })
      }
      try { ctx[fn]() } catch (e: any) { error = e }
      ctx.UrlFetchApp.fetch = original
      assert.equal(error?.message, '__pendiente__')
      const { url, op } = error
      const u = new URL(url)
      const r = await publicar(req(u.pathname + u.search, { method: 'POST', body: op.payload, headers: op.headers }))
      const cuerpo = await r.text()
      ctx.UrlFetchApp.fetch = (url2: string, op2: any) => ({ getResponseCode: () => r.status, getContentText: () => cuerpo })
      try { resultado = ctx[fn]() } catch (e) { resultado = e }
      ctx.UrlFetchApp.fetch = original
      return { resultado, url, op }
    }
    const antes = JSON.stringify(db.tables)
    const sim = await ejecutar('simularPublicacionCompitas')
    assert.ok(sim.url.endsWith('?dryRun=1'))
    assert.equal(sim.op.headers.Authorization, 'Bearer ' + TOKEN)
    assert.equal(JSON.stringify(db.tables), antes)
    assert.equal(props.CMC_PUBLICAR_ULTIMO, undefined) // la simulación tampoco escribe propiedades
    assert.match(sim.resultado.respuesta, /"modo":"simular"/)

    const apl = await ejecutar('publicarCompitasWeb')
    assert.ok(!apl.url.includes('dryRun'))
    assert.equal(apl.resultado.http, 200)
    assert.equal(porCodigo('COM-0025')!.estado, 'inactivo')
    assert.equal(porCodigo('COM-0187')!.cmc_permite, true)
    assert.ok(props.CMC_PUBLICAR_ULTIMO)
  })

  test('autorización de retirada masiva: viaja una sola vez y se borra tras un 200; un error de la web hace fallar la ejecución', () => {
    const props: Record<string, string> = { ...PROPS(), CMC_AUTORIZAR_DESACTIVACION_MASIVA: 'si' }
    const { ctx, llamadas } = cargar(hoja([HAB('COM-0025')]), props)
    ctx.UrlFetchApp.fetch = (url: string, op: any) => { llamadas.push({ url, op }); return { getResponseCode: () => 409, getContentText: () => '{"ok":false}' } }
    assert.throws(() => ctx.publicarCompitasWeb(), /409/)
    assert.equal(props.CMC_AUTORIZAR_DESACTIVACION_MASIVA, 'si') // no se consumió
    ctx.UrlFetchApp.fetch = (url: string, op: any) => { llamadas.push({ url, op }); return { getResponseCode: () => 200, getContentText: () => '{"ok":true}' } }
    ctx.publicarCompitasWeb()
    assert.equal(JSON.parse(llamadas[1].op.payload).desactivacion_masiva_autorizada, true)
    assert.equal(props.CMC_AUTORIZAR_DESACTIVACION_MASIVA, undefined)
    // la simulación nunca la envía
    ctx.simularPublicacionCompitas()
    assert.equal(JSON.parse(llamadas[2].op.payload).desactivacion_masiva_autorizada, false)
  })
})
