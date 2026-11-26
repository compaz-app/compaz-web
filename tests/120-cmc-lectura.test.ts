/* eslint-disable */
// CMC fase 2A: lectura real del CMC (solo lectura). Contrato con la API de Apps Script (docs/cmc/api-lectura/, ejecutada aquí
// en una caja de arena con hojas SINTÉTICAS), cliente firmado, minimización de datos, clasificación y permiso de administrador.
// Todos los datos son inventados (COM-9xxx y nombres ficticios): ningún dato real de aspirantes entra al repositorio.
import { net } from './harness'
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash, createHmac } from 'node:crypto'
import vm from 'node:vm'
import { CLAVES_PRIVADAS, HUELLAS_REGLAS_CMC, compararReglas, CmcError, configuracionCmc, firmar, leerFichaCmc, leerListaCmc, limpiarPrivados, pingCmc, urlValida, validarLista, type FilaCmc } from '@/lib/cmc-api'
import { construirFilas, normalizarEtapa, resumenReal, cuentaComoAspirante, preentrevistaRespondida } from '@/lib/confianza/real'
import { fichaSintetica, fuenteSinteticaPermitida, listaSintetica } from '@/lib/confianza/real-sintetico'
import { fuenteDisponible } from '@/lib/confianza/lectura-real'

const TOKEN = 'x'.repeat(24) + 'y'.repeat(24) + 'z'.repeat(8) // 56 caracteres, inventado
const URL_API = 'https://script.google.com/macros/s/AKfycbSINTETICO_de_prueba-123/exec'

// ── Caja de arena de Apps Script con hojas sintéticas ────────────────────────────────────────────────────────────────────
// Carga HojaSoloLectura.gs + ApiPanel.gs (los mismos archivos del proyecto independiente) con un servicio «Sheets» falso.
// ReglasCMC.gs (copia literal del CMC) no está en el repositorio: sus funciones se sustituyen aquí por dobles sintéticos.
const SERIE = (d: Date) => d.getTime() / 86400000 + 25569 // serie de Sheets en UTC (zona de la hoja: UTC en la prueba)
function cajaGas(opts: { activa?: string; token?: string; hojas03?: any[][]; hojas11?: any[][]; cuotaAgotada?: boolean } = {}) {
  const props: Record<string, string> = { CMC_API_ACTIVA: opts.activa ?? 'si', CMC_API_TOKEN: opts.token ?? TOKEN }
  const cache = new Map<string, string>()
  const lecturas: string[] = []
  const h03 = opts.hojas03 ?? [
    ['ID Compita', 'Fecha registro', 'Nombre', 'WhatsApp', 'Email', 'Ubicación declarada', 'Estado preentrevista', 'Estado operativo', 'Acepta nuevos servicios', 'Enlace preentrevista', 'Etapa de selección', 'Duplicado de (ID)', 'Clasificación duplicado'],
    ['COM-9001', new Date('2026-10-01T12:00:00Z'), 'Ana Ficticia', '+580000000000', 'ana@correo.com', 'Chacao', 'Respondida', '', '', 'https://forms.example/x', 'Registrado'],
    ['COM-9002', '', 'Bruno Inventado', '+580000000001', 'bruno@correo.com', 'Baruta', 'Enviada', 'Activo', 'Sí', '', 'Habilitado', '', ''],
    ['COM-9003', '', 'Bruno Inventado', '', '', 'Baruta', '', '', '', '', 'Registrado', 'COM-9002', 'Duplicado confirmado'],
    ['', '', 'Fila vacía'],
  ]
  const h11 = opts.hojas11 ?? [['ID Alerta', 'ID Compita', 'Estado', 'Bloquea matching'], ['A1', 'COM-9001', 'Abierta', 'Sí'], ['A2', 'COM-9001', 'Cerrada', 'Sí']]
  const hojas: Record<string, any[][]> = { '03 · Compitas': h03, '11 · Alertas Compitas': h11 }
  const recortar = (v: any[][]) => v.map((f) => { const g = f.slice(); while (g.length && (g[g.length - 1] === '' || g[g.length - 1] == null)) g.pop(); return g })
  const llamadasSheets: string[] = []
  const una = (id: string, rango: string, o: any) => {
    if (id !== 'HOJA-SINTETICA') throw new Error('otra hoja')
    if (opts.cuotaAgotada) throw new Error('Quota exceeded for quota metric Read requests per minute per user')
    const n = rango.replace(/^'|'$/g, '').replace(/''/g, "'"); lecturas.push(n)
    if (!hojas[n]) throw new Error('Unable to parse range: ' + rango)
    const v = recortar(hojas[n])
    return { values: v.map((f) => f.map((x) => (x instanceof Date ? (o.valueRenderOption === 'FORMATTED_VALUE' ? x.toISOString().slice(0, 10).split('-').reverse().join('/') : SERIE(x)) : x))) }
  }
  const Sheets = {
    Spreadsheets: {
      get: () => ({ properties: { timeZone: 'Etc/UTC' } }),
      Values: {
        get: (id: string, rango: string, o: any) => { llamadasSheets.push('get'); return una(id, rango, o) },
        batchGet: (id: string, o: any) => { llamadasSheets.push('batchGet'); return { valueRanges: o.ranges.map((r: string) => (hojas[r.replace(/^'|'$/g, '')] ? una(id, r, o) : { values: [] })) } },
      },
    },
  }
  const ctx: any = {
    console: { log() {}, error() {} },
    Sheets,
    V2_SS_ID: 'HOJA-SINTETICA',
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null }) },
    CacheService: { getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => void cache.set(k, v) }) },
    Utilities: {
      computeHmacSha256Signature: (m: string, k: string) => [...createHmac('sha256', k).update(m).digest()].map((b) => (b > 127 ? b - 256 : b)),
      formatDate: () => '+0000', DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_a: string, t: string) => [...createHash('sha256').update(t).digest()].map((b) => (b > 127 ? b - 256 : b)),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s: string) => ({ setMimeType: () => ({ contenido: s }) }) },
    SpreadsheetApp: {},
    // Dobles de las funciones copiadas del CMC (ReglasCMC.gs): leen por la vía real (SpreadsheetApp.getActive()) para probar la hoja de solo lectura.
    panel_obtenerPanelElegibilidad_core_: (id: string) => {
      const filas = ctx.SpreadsheetApp.getActive().getSheetByName('03 · Compitas').getDataRange().getValues()
      const f = filas.find((r: any[]) => r[0] === id)
      return { ok: true, id, etapaSeleccion: f[10], elegible: false, requisitos: [{ clave: 'identidad', etiqueta: 'Identidad', estado: 'Pendiente', detalle: { enlaceEvidencia: 'https://x', correoVerificador: 'v@correo.com' } }, { clave: 'referencia', etiqueta: 'Referencia verificada', estado: 'Pendiente', detalle: 'Ninguna Referencia Verificada + Vigente' }, { clave: 'operador', etiqueta: 'Operador', estado: 'Bloqueado' }] }
    },
    panel_obtenerAlertas: () => [{ idAlerta: 'A1', motivo: 'Llamar al 0412-555-0101 o escribir a ana@correo.com', estado: 'Abierta' }],
    panel_obtenerOnboarding: () => ({ historial: [], masReciente: null }),
    v2_obtenerTabRaw_: (id: string, t: string) => t === 'entrevista'
      ? { ok: true, campos: [{ campo: 'Decision', valor: 'Avanza a verificación' }, { campo: 'Datos de las referencias', valor: 'Pedro 04145550000' }, { campo: 'En que zona especifica vives actualmente?', valor: 'Calle 0, casa 1' }] }
      : { ok: true, tab: t, items: [{ atributo: 'Identidad', telefonoReferencia: '+580000000002', evidencia: 'V-12.345.678' }] },
    Date, JSON, Math, Number, String, Array, Object, isFinite, Error, RegExp,
  }
  ctx.globalThis = ctx
  vm.createContext(ctx)
  vm.runInContext(readFileSync('docs/cmc/api-lectura/HojaSoloLectura.gs', 'utf8'), ctx)
  vm.runInContext(readFileSync('docs/cmc/api-lectura/ApiPanel.gs', 'utf8'), ctx)
  const post = (cuerpo: string) => { ctx.CMC_SL_MEMO_ = {}; return JSON.parse(ctx.doPost({ postData: { contents: cuerpo } }).contenido) }
  return { post, props, cache, lecturas, ctx, llamadasSheets }
}
const peticion = (op: string, id = '', extra: any = {}) => {
  const p = { v: 1, op, id, ts: Math.floor(Date.now() / 1000), nonce: `n-${Math.random().toString(36).slice(2)}-abcdefgh`, ...extra }
  return JSON.stringify({ ...p, firma: firmar(TOKEN, p), ...(extra.firma ? { firma: extra.firma } : {}) })
}

describe('API de lectura en Apps Script (proyecto independiente: docs/cmc/api-lectura/)', () => {
  test('la firma del panel es la que comprueba Apps Script y la lista sale sin contactos', () => {
    const g = cajaGas()
    const r = g.post(peticion('lista'))
    assert.equal(r.ok, true); assert.equal(r.op, 'lista'); assert.equal(r.v, 1)
    assert.deepEqual(r.datos.filas.map((f: any) => f.id), ['COM-9001', 'COM-9002', 'COM-9003'])
    assert.equal(r.datos.filas[0].registro, '2026-10-01T12:00:00.000Z')
    assert.equal(r.datos.filas[0].alertasAbiertas, 1); assert.equal(r.datos.filas[0].alertasBloquean, 1) // la cerrada no cuenta
    assert.doesNotMatch(JSON.stringify(r), /\+58|@correo\.com/)
  })
  test('rechaza sin leer: interruptor apagado, token corto, firma mala, hora vieja, nonce repetido, operación desconocida', () => {
    assert.equal(cajaGas({ activa: 'no' }).post(peticion('lista')).error, 'inactiva')
    assert.equal(cajaGas({ token: 'corto' }).post(peticion('lista')).error, 'sin_configurar')
    const g = cajaGas()
    assert.equal(g.post(peticion('lista', '', { firma: 'f'.repeat(64) })).error, 'firma_invalida')
    assert.equal(g.post(peticion('lista', '', { ts: Math.floor(Date.now() / 1000) - 3600 })).error, 'fuera_de_tiempo')
    const una = peticion('ping'); assert.equal(g.post(una).ok, true); assert.equal(g.post(una).error, 'repetida')
    assert.equal(g.post(peticion('escribir')).error, 'operacion_no_permitida')
    assert.equal(g.post(peticion('ficha', 'COM-9001; borrar')).error, 'id_invalido')
    assert.equal(g.post('no es json').error, 'peticion_invalida')
    assert.equal(g.post('x'.repeat(5000)).error, 'peticion_invalida')
  })
  test('la firma cubre el código pedido: cambiar el id invalida la petición', () => {
    const g = cajaGas()
    const p = JSON.parse(peticion('ficha', 'COM-9001')); p.id = 'COM-9002'
    assert.equal(g.post(JSON.stringify(p)).error, 'firma_invalida')
  })
  test('la ficha sale con lista blanca de la hoja 03 y se limpia en cualquier nivel (teléfono, correo, cédula, enlaces, referencias, dónde vive)', () => {
    const r = cajaGas().post(peticion('ficha', 'COM-9001'))
    assert.equal(r.ok, true); assert.equal(r.datos.ficha.ficha['Nombre'], 'Ana Ficticia')
    assert.equal(r.datos.ficha.ficha['Fecha registro'], '2026-10-01T12:00:00.000Z', 'las fechas llegan como fecha (no como número de serie)')
    assert.deepEqual(Object.keys(r.datos.ficha.ficha).filter((k) => /WhatsApp|Email|Enlace/.test(k)), [])
    const txt = JSON.stringify(r)
    assert.doesNotMatch(txt, /\+58|@correo|V-12|Calle 0|https:\/\/|0412|04145|Pedro/)
    assert.match(txt, /\[teléfono\]/); assert.match(txt, /\[correo\]/)
    assert.deepEqual(r.datos.pestanas.entrevista.campos.map((c: any) => c.campo), ['Decision'], 'sin referencias ni dónde vive')
    assert.deepEqual(Object.keys(r.datos.pestanas).sort(), ['entrevista', 'historial', 'preentrevista', 'verificaciones'])
    assert.equal(r.datos.ficha.elegibilidad.etapaSeleccion, 'Registrado', 'las funciones copiadas leen la hoja por la vía de solo lectura')
    assert.deepEqual(r.datos.ficha.elegibilidad.requisitos.map((q: any) => q.clave), ['identidad', 'referencia', 'operador'], 'el requisito «Referencia verificada» no se confunde con los datos de referencias personales')
    assert.equal(cajaGas().post(peticion('ficha', 'COM-9999')).error, 'no_existe')
  })
  test('la hoja de solo lectura no tiene ningún método de escritura y no abre otras hojas', () => {
    const g = cajaGas(); g.post(peticion('lista'))
    const hoja = g.ctx.CMC_SL_LIBRO_.getSheetByName('03 · Compitas')
    const metodos = [...Object.keys(g.ctx.CMC_SL_LIBRO_), ...Object.keys(hoja), ...Object.keys(hoja.getRange(1, 1, 1, 1))]
    assert.deepEqual(metodos.filter((m) => /^(set|append|insert|delete|clear|copy|move|sort|protect|hide|add|remove)/i.test(m)), [])
    assert.equal(g.ctx.SpreadsheetApp.getActive(), g.ctx.CMC_SL_LIBRO_)
    assert.throws(() => g.ctx.SpreadsheetApp.openById('OTRA-HOJA'), /solo_hoja_cmc/)
    assert.equal(g.ctx.CMC_SL_LIBRO_.getSheetByName('No existe'), null)
    assert.equal(hoja.getRange(2, 1, 1, 3).getValues()[0][0], 'COM-9001')
    assert.equal(hoja.getRange(5, 13).getValue(), '', 'celdas vacías como en getValues()')
    assert.equal(hoja.createTextFinder('COM-9003').matchEntireCell(true).findNext().getRow(), 4)
  })
  test('lee cada operación con 2 llamadas a la API de Sheets y, si Google limita, responde un código reintentable', () => {
    const g = cajaGas(); g.post(peticion('lista'))
    assert.deepEqual([...g.llamadasSheets], ['batchGet', 'batchGet'])
    const f = cajaGas(); f.post(peticion('ficha', 'COM-9001'))
    assert.deepEqual([...f.llamadasSheets], ['batchGet', 'batchGet'])
    assert.equal(cajaGas({ cuotaAgotada: true }).post(peticion('lista')).error, 'limite_google')
  })
  test('el tope por minuto corta a partir de 120 peticiones', () => {
    const g = cajaGas(); let ultima: any
    for (let i = 0; i < 121; i++) ultima = g.post(peticion('ping'))
    assert.equal(ultima.error, 'limite')
  })
  test('los archivos del proyecto no escriben, no tienen doGet ni página, y no traen datos, tokens ni direcciones', () => {
    const archivos = ['ApiPanel.gs', 'HojaSoloLectura.gs'].map((f) => readFileSync('docs/cmc/api-lectura/' + f, 'utf8'))
    for (const s of archivos) {
      assert.doesNotMatch(s, /\.(setValue|setValues|appendRow|deleteRow|insertRow|insertSheet|clear|clearContent|setFormula)\s*\(/)
      assert.doesNotMatch(s, /function\s+doGet|HtmlService|ScriptApp\.newTrigger|UrlFetchApp|MailApp|GmailApp|DriveApp/)
      assert.doesNotMatch(s, /COM-\d{4}\b|AKfyc|script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{10}|1-ZOER7V|1V1GXmUk|1FtEuRUp/)
    }
    const s = archivos[0]
    assert.equal(String(CLAVES_PRIVADAS), s.match(/CMC_API_CLAVES_PRIVADAS_ = (\/.*\/i);/)![1], 'las claves privadas de la web y de Apps Script deben ser las mismas')
    const man = JSON.parse(readFileSync('docs/cmc/api-lectura/appsscript.json', 'utf8'))
    assert.deepEqual(man.oauthScopes, ['https://www.googleapis.com/auth/spreadsheets.readonly'], 'único permiso: ver hojas de cálculo')
    assert.deepEqual(man.dependencies.enabledAdvancedServices.map((x: any) => x.serviceId), ['sheets'])
    assert.deepEqual(man.webapp, { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' }, 'lo escribe Google al publicar: ejecuta como el propietario y acepta llamadas sin cuenta (protegidas por la firma)')
  })
  test('version devuelve la huella de cada función copiada del CMC', () => {
    const r = cajaGas().post(peticion('version'))
    assert.equal(r.ok, true); assert.equal(r.datos.reglas.panel_obtenerPanelElegibilidad_core_.length, 16)
    assert.equal(r.datos.reglas.panel_evaluarHabilitacion_, 'falta', 'en la caja de arena no está la copia')
  })
})

describe('cliente del panel (lib/cmc-api.ts)', () => {
  const env = { ...process.env }
  beforeEach(() => { process.env.CMC_API_URL = env.CMC_API_URL; process.env.CMC_API_TOKEN = env.CMC_API_TOKEN; delete process.env.CMC_API_URL; delete process.env.CMC_API_TOKEN })
  test('solo acepta una dirección /macros/s/<id>/exec de script.google.com y un token de 48 o más', () => {
    assert.equal(urlValida(URL_API), URL_API)
    for (const u of ['http://script.google.com/macros/s/abc/exec', 'https://script.google.com.evil.com/macros/s/abc/exec', 'https://evil.com/macros/s/abc/exec', `${URL_API}?x=1`, 'https://script.google.com/macros/s/abc/dev', 'nada'])
      assert.equal(urlValida(u), null, u)
    process.env.CMC_API_URL = URL_API; process.env.CMC_API_TOKEN = 'corto'
    assert.equal(configuracionCmc(), null)
    process.env.CMC_API_TOKEN = TOKEN
    assert.deepEqual(configuracionCmc(), { url: URL_API, token: TOKEN })
  })
  test('ida y vuelta completa contra la caja de arena: firma, lista validada y ficha limpia', async () => {
    const g = cajaGas()
    const pedidas: any[] = []
    const antes = globalThis.fetch
    globalThis.fetch = (async (url: string, init: any) => {
      if (url !== URL_API) return antes(url, init)
      pedidas.push(JSON.parse(init.body))
      return new Response(JSON.stringify(g.post(init.body)), { status: 200 })
    }) as any
    try {
      process.env.CMC_API_URL = URL_API; process.env.CMC_API_TOKEN = TOKEN
      const { lista, descartadas } = await leerListaCmc()
      assert.equal(lista.filas.length, 3); assert.equal(descartadas, 0)
      const f = await leerFichaCmc('COM-9001')
      assert.doesNotMatch(JSON.stringify(f), /\+58|@correo/)
      assert.deepEqual(pedidas.map((p) => p.op), ['lista', 'ficha'])
      assert.ok(pedidas.every((p) => /^[0-9a-f]{64}$/.test(p.firma) && p.v === 1))
      await assert.rejects(leerFichaCmc('COM-1; x'), (e: any) => e instanceof CmcError && e.codigo === 'id_invalido')
      process.env.CMC_API_TOKEN = 'w'.repeat(56) // token distinto al del CMC
      await assert.rejects(pingCmc(), (e: any) => e instanceof CmcError && e.codigo === 'firma_invalida')
    } finally { globalThis.fetch = antes }
    assert.equal(net.tg.length, 0); assert.equal(net.emails.length, 0)
  })
  test('una respuesta con otro contrato o sin conexión da un código corto, nunca el contenido', async () => {
    const antes = globalThis.fetch
    process.env.CMC_API_URL = URL_API; process.env.CMC_API_TOKEN = TOKEN
    try {
      globalThis.fetch = (async () => new Response('<html>Inicia sesión en Google</html>', { status: 200 })) as any
      await assert.rejects(pingCmc(), (e: any) => e.codigo === 'respuesta_no_json' && !/html/i.test(e.message))
      globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, v: 2, op: 'ping', generado: 'x', datos: {} }))) as any
      await assert.rejects(pingCmc(), (e: any) => e.codigo === 'contrato_distinto')
      globalThis.fetch = (async () => { throw new Error('ECONNRESET 10.0.0.1') }) as any
      await assert.rejects(pingCmc(), (e: any) => e.codigo === 'sin_conexion' && !/10\.0/.test(e.message))
    } finally { globalThis.fetch = antes }
  })
  test('limpiarPrivados borra contactos también en la web (segunda barrera)', () => {
    const x = limpiarPrivados({ a: { telefono: '1', correoAlterno: '2', nombre: 'Ana', lista: [{ whatsapp: '3', ok: 1 }] }, e: 'x', t: 'y' })
    assert.deepEqual(x, { a: { nombre: 'Ana', lista: [{ ok: 1 }] } })
  })
  test('validarLista descarta códigos inválidos y repetidos y los cuenta; nunca inventa valores', () => {
    const { lista, descartadas } = validarLista({ filas: [{ id: 'COM-9001', nombre: 'A', alertasAbiertas: 'x' }, { id: 'COM-9001' }, { id: 'DEMO-1' }, { id: 'COM-12' }, {}], filasLeidas: 5 })
    assert.equal(descartadas, 4); assert.equal(lista.filas.length, 1)
    assert.equal(lista.filas[0].zona, ''); assert.equal(lista.filas[0].alertasAbiertas, 0)
    assert.throws(() => validarLista({}), (e: any) => e.codigo === 'contrato_distinto')
  })
  test('control de divergencia: las huellas de las reglas copiadas deben ser las comprobadas contra el CMC', () => {
    assert.equal(Object.keys(HUELLAS_REGLAS_CMC).length, 15)
    assert.ok(Object.values(HUELLAS_REGLAS_CMC).every((h) => /^[0-9a-f]{16}$/.test(h)))
    assert.deepEqual(compararReglas({ ...HUELLAS_REGLAS_CMC }), { estado: 'iguales', distintas: [] })
    assert.deepEqual(compararReglas({ ...HUELLAS_REGLAS_CMC, panel_evaluarHabilitacion_: '0000000000000000' }), { estado: 'distintas', distintas: ['panel_evaluarHabilitacion_'] })
    assert.equal(compararReglas(null).estado, 'sin_comprobar')
    const gs = readFileSync('docs/cmc/api-lectura/ApiPanel.gs', 'utf8')
    for (const f of Object.keys(HUELLAS_REGLAS_CMC)) assert.match(gs, new RegExp(`'${f}'`), `${f} debe estar en la lista de version de la API`)
  })
  test('el cliente solo pide operaciones de lectura', () => {
    const s = readFileSync('lib/cmc-api.ts', 'utf8')
    assert.match(s, /export type OperacionLectura = 'ping' \| 'lista' \| 'ficha'/)
    assert.doesNotMatch(s, /llamar\w*\(\s*'(?!ping|lista|ficha)/)
  })
})

describe('clasificación de la operación real (lib/confianza/real.ts)', () => {
  const fila = (o: Partial<FilaCmc>): FilaCmc => ({ id: 'COM-9100', nombre: 'Persona Ficticia', zona: '', registro: '', etapa: 'Registrado', estadoOperativo: '', aceptaNuevos: '', preentrevista: '', duplicadoDe: '', clasificacionDuplicado: '', alertasAbiertas: 0, alertasBloquean: 0, ...o })
  test('normaliza la etapa y nunca inventa una: vacía o desconocida es «Sin etapa»', () => {
    assert.equal(normalizarEtapa('  en verificación '), 'En verificación')
    assert.equal(normalizarEtapa(''), 'Sin etapa'); assert.equal(normalizarEtapa('Algo raro'), 'Sin etapa')
  })
  test('duplicados confirmados y perfiles de prueba no cuentan como aspirantes; los posibles duplicados sí', () => {
    const filas = construirFilas([
      fila({ id: 'COM-9101' }), fila({ id: 'COM-9102', clasificacionDuplicado: 'Duplicado confirmado', duplicadoDe: 'COM-9101' }),
      fila({ id: 'COM-9103', clasificacionDuplicado: 'Posible duplicado' }), fila({ id: 'COM-9104', nombre: 'Prueba Test' }),
    ], new Map())
    assert.deepEqual(filas.filter(cuentaComoAspirante).map((f) => f.id), ['COM-9101', 'COM-9103'])
    const r = resumenReal(filas)
    assert.equal(r.total, 4); assert.equal(r.aspirantes, 2); assert.equal(r.duplicados, 1); assert.equal(r.pruebas, 1)
    assert.equal(filas[1].atencion, 'excluido')
  })
  test('una alerta que bloquea manda sobre la etapa; habilitado sin catálogo pide activarlo', () => {
    const [a, b, c] = construirFilas([fila({ etapa: 'Preseleccionado', alertasBloquean: 1 }), fila({ id: 'COM-9105', etapa: 'Habilitado' }), fila({ id: 'COM-9106', etapa: 'Habilitado' })], new Map([['COM-9106', 'catalogo' as const]]))
    assert.equal(a.atencion, 'bloqueado'); assert.equal(b.atencion, 'accion'); assert.equal(c.atencion, 'al-dia')
    assert.equal(resumenReal([a, b, c]).enCatalogo, 1)
  })
  test('registrado con la preentrevista completada pide decisión; enviada o sin enviar es espera (valores reales del CMC)', () => {
    const [a, b, c, d] = construirFilas([
      fila({ id: 'COM-9111', preentrevista: 'Formulario completado' }), fila({ id: 'COM-9112', preentrevista: 'Enviado' }),
      fila({ id: 'COM-9113', preentrevista: '' }), fila({ id: 'COM-9114', etapa: 'Descartado', preentrevista: 'Formulario completado' }),
    ], new Map())
    assert.equal(a.atencion, 'accion'); assert.equal(b.atencion, 'espera'); assert.equal(c.atencion, 'espera'); assert.equal(d.atencion, 'cerrado')
    assert.equal(resumenReal([a, b, c, d]).requierenAtencion, 1)
    assert.equal(preentrevistaRespondida(' formulario completado '), true); assert.equal(preentrevistaRespondida('Respondida'), false)
  })
  test('el resumen cuadra: la suma por etapa es igual a los aspirantes', () => {
    const r = resumenReal(construirFilas(listaSintetica(), new Map()))
    assert.equal(Object.values(r.porEtapa).reduce((s, n) => s + n, 0), r.aspirantes)
  })
})

describe('fuente sintética y permisos', () => {
  test('la fuente sintética solo existe en un deploy preview (nunca en producción ni en desarrollo)', () => {
    assert.equal(fuenteSinteticaPermitida('deploy-preview'), true)
    for (const c of ['production', 'branch-deploy', 'dev', '']) assert.equal(fuenteSinteticaPermitida(c), false, c)
    const antes = { ...process.env }
    try {
      delete process.env.CMC_API_URL; delete process.env.CMC_API_TOKEN
      process.env.COMPAZ_CONTEXTO_DESPLIEGUE = 'production'; assert.equal(fuenteDisponible(), null)
      process.env.COMPAZ_CONTEXTO_DESPLIEGUE = 'deploy-preview'; assert.equal(fuenteDisponible(), 'sintetica')
      process.env.CMC_API_URL = URL_API; process.env.CMC_API_TOKEN = TOKEN; assert.equal(fuenteDisponible(), 'cmc', 'con la API configurada nunca se mezcla la fuente sintética')
    } finally { for (const k of ['CMC_API_URL', 'CMC_API_TOKEN', 'COMPAZ_CONTEXTO_DESPLIEGUE']) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k] } }
  })
  test('los datos sintéticos son ficticios (COM-9xxx, sin contactos) y la ficha tiene la forma del CMC', () => {
    const l = listaSintetica()
    assert.ok(l.every((f) => /^COM-9\d{3}$/.test(f.id)))
    assert.doesNotMatch(JSON.stringify(l) + JSON.stringify(fichaSintetica('COM-9001')), /@|\+58|\b0?4\d{2}[- ]?\d{7}\b/)
    assert.ok(Array.isArray((fichaSintetica('COM-9001')!.ficha as any).elegibilidad.requisitos))
    assert.equal(fichaSintetica('COM-1234'), null)
  })
  test('la vista real solo se monta para un administrador, decidido en el servidor', () => {
    const s = readFileSync('app/panel/page.tsx', 'utf8')
    assert.match(s, /const lecturaReal = actor\.rol === 'admin' && fuenteDisponible\(\) !== null/)
    assert.match(s, /else if \(!lecturaReal\) \{\s*vista = <ConfianzaOperativo/)
    for (const f of ['components/panel/confianza/ConfianzaReal.tsx', 'components/panel/confianza/FichaReal.tsx'])
      assert.doesNotMatch(readFileSync(f, 'utf8'), /^import (?!type )[^\n]*(cmc-api|lectura-real)|fetch\s*\(|['"`]\/api\//m, `${f} no debe leer el CMC por su cuenta (solo tipos)`)
    assert.doesNotMatch(readFileSync('components/panel/confianza/ConfianzaReal.tsx', 'utf8'), /'use server'/)
  })
  test('Clarity no graba el texto de la vista real ni de la ficha', () => {
    for (const f of ['components/panel/confianza/ConfianzaReal.tsx', 'components/panel/confianza/FichaReal.tsx'])
      assert.match(readFileSync(f, 'utf8'), /return \(\s*<div className="[^"]*" data-clarity-mask="True">/, f)
  })
  test('ninguna ruta pública ni de la API expone el CMC en esta fase', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = `${d}/${n}`; return statSync(p).isDirectory() ? walk(p) : [p] })
    const usan = walk('app').filter((f) => /\.(ts|tsx)$/.test(f) && /@\/lib\/(cmc-api|confianza\/lectura-real)/.test(readFileSync(f, 'utf8')))
    assert.deepEqual(usan, ['app/panel/page.tsx'])
  })
  test('el repositorio no trae datos reales de aspirantes en los archivos de esta fase', () => {
    const archivos = ['lib/cmc-api.ts', 'lib/confianza/real.ts', 'lib/confianza/real-sintetico.ts', 'lib/confianza/lectura-real.ts', 'components/panel/confianza/ConfianzaReal.tsx', 'components/panel/confianza/FichaReal.tsx', 'docs/cmc/api-lectura/ApiPanel.gs', 'docs/cmc/api-lectura/HojaSoloLectura.gs', 'docs/cmc/api-panel.md']
    for (const f of archivos) {
      const s = readFileSync(f, 'utf8')
      assert.doesNotMatch(s, /COM-[0-8]\d{3}\b/, `${f}: solo códigos ficticios COM-9xxx`)
      assert.doesNotMatch(s, /[\w.+-]+@(gmail|hotmail|yahoo|outlook)\.com/i, `${f}: sin correos`)
      assert.doesNotMatch(s, /\+58\d{6,}|\b04(12|14|16|24|26)\d{7}\b/, `${f}: sin teléfonos`)
      assert.doesNotMatch(s, /AKfyc[\w-]{20,}|1-ZOER7V|1V1GXmUk/, `${f}: sin identificadores de implementaciones ni archivos`)
    }
  })
})
