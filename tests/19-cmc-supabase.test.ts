/* eslint-disable */
// CMC desde Supabase (nov-2026)
//
// Dos niveles:
//   1. La ruta GET /api/cmc/postulaciones (seguridad, formato, exclusiones, paginación).
//   2. De extremo a extremo con el Apps Script REAL del CMC: se carga en una VM de Node
//      la copia literal de su sincronización (tests/cmc/cmc-sync-original.gs.js,
//      verificada por huella contra el editor), se le aplican las tres ediciones y las
//      funciones de docs/cmc/fuente-supabase.gs tal como se pegarían, y se ejecuta sobre
//      hojas 02/03 simuladas. UrlFetchApp responde con lo que devuelve la ruta real.
// No hay red: Airtable y la web están simulados.
import { db, req, limpiar, SITE } from './harness'
import { beforeEach, test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { randomUUID } from 'crypto'
import { GET } from '@/app/api/cmc/postulaciones/route'
import { registroCmcDesdeFila, codificarCursor } from '@/lib/cmc'

const TOKEN = 'cmc-token-de-pruebas-0123456789abcdef'
const DESDE = '2026-11-02T04:30:02.000Z'
const URL_CMC = `${SITE}/api/cmc/postulaciones`
const raiz = process.cwd()

// ── Postulaciones en Supabase (falso) ──────────────────────────────────────────
function postulacion(o: Record<string, any>) {
  return db.seed('postulaciones', {
    id: randomUUID(), tipo: 'compita', clasificacion: 'nueva',
    nombre_declarado: 'Nombre', telefono_declarado: '+584140000000', email_declarado: 'x@ejemplo.org',
    ubicacion_declarada: 'Chacao, Miranda', recibida_en: '2026-11-03T12:00:00.000Z', ...o,
  })
}
const pedir = (offset = '', token: string | null = TOKEN) =>
  GET(req('/api/cmc/postulaciones' + (offset ? '?offset=' + encodeURIComponent(offset) : ''),
    { headers: token ? { authorization: 'Bearer ' + token } : {} }))

beforeEach(() => {
  limpiar()
  Object.assign(process.env, { CMC_LECTURA_TOKEN: TOKEN, CAPTACION_DESDE: DESDE })
})

// ═══ 1. Ruta ═════════════════════════════════════════════════════════════════════
describe('GET /api/cmc/postulaciones', () => {
  test('falla cerrado: sin CMC_LECTURA_TOKEN o sin CAPTACION_DESDE → 503; token ausente o erróneo → 401', async () => {
    postulacion({})
    delete process.env.CMC_LECTURA_TOKEN
    assert.equal((await pedir()).status, 503)
    process.env.CMC_LECTURA_TOKEN = TOKEN
    delete process.env.CAPTACION_DESDE
    assert.equal((await pedir()).status, 503)
    process.env.CAPTACION_DESDE = DESDE
    assert.equal((await pedir('', null)).status, 401)
    assert.equal((await pedir('', 'otro-token')).status, 401)
    assert.equal((await pedir('', TOKEN + 'x')).status, 401)
    const ok = await pedir()
    assert.equal(ok.status, 200)
    assert.equal(ok.headers.get('cache-control'), 'no-store')
  })

  test('formato Airtable: claves rec…/SB-…, Rol compa/familia y Contacto canónico', async () => {
    const conRec = postulacion({ tipo: 'familia', airtable_id: 'recwF7DwMRr2tJCtP', nombre_declarado: 'Familia A', telefono_declarado: '+584125550001', email_declarado: 'a@ejemplo.org', utm_source: 'chatgpt.com', recibida_en: '2026-11-02T05:00:00.123Z' })
    const sinRec = postulacion({ tipo: 'compita', nombre_declarado: 'Compita B', telefono_declarado: '+584148820000', email_declarado: 'b@ejemplo.org', ubicacion_declarada: 'Valencia, Carabobo', recibida_en: '2026-11-05T01:59:19.394Z' })
    const body = await (await pedir()).json()
    assert.equal(body.ok, true)
    assert.equal(body.data.offset, '')
    const [r1, r2] = body.data.records
    assert.deepEqual(r1.fields, {
      'ID Airtable': 'recwF7DwMRr2tJCtP', 'ID Supabase': `SB-${conRec.id}`, Rol: 'familia', Nombre: 'Familia A',
      Fecha: '2026-11-02T05:00:00.123Z', Contacto: 'WA: +584125550001 | Email: a@ejemplo.org | Rol: familia',
      Telefono: '+584125550001', Email: 'a@ejemplo.org', Ciudad: 'Chacao, Miranda',
      'UTM Source': 'chatgpt.com', 'UTM Medium': '', 'UTM Campaign': '',
    })
    assert.equal(r2.fields['ID Airtable'], `SB-${sinRec.id}`)
    assert.equal(r2.fields['ID Supabase'], `SB-${sinRec.id}`)
    assert.equal(r2.fields.Rol, 'compa')
    assert.equal(r2.fields.Ciudad, 'Valencia, Carabobo')
  })

  test('no entrega: anteriores a CAPTACION_DESDE, repetidas, «no procede» ni tipo desconocido; sí las registradas a mano en el CMC', async () => {
    postulacion({ nombre_declarado: 'antigua', recibida_en: '2026-10-30T10:00:00.000Z' })
    postulacion({ nombre_declarado: 'repetida', clasificacion: 'repetida' })
    postulacion({ nombre_declarado: 'no procede', resolucion: 'no_procede' })
    postulacion({ nombre_declarado: 'sin rol', tipo: 'desconocido' })
    postulacion({ nombre_declarado: 'manual', resolucion: 'registrada_en_cmc' })
    postulacion({ nombre_declarado: 'normal' })
    const nombres = (await (await pedir()).json()).data.records.map((r: any) => r.fields.Nombre).sort()
    assert.deepEqual(nombres, ['manual', 'normal'])
  })

  test('paginación por cursor: 230 postulaciones en 3 páginas, en orden y sin repetir; offset inválido → 400', async () => {
    const base = Date.parse('2026-11-03T00:00:00.000Z')
    for (let i = 0; i < 230; i++) postulacion({ nombre_declarado: `p${String(i).padStart(3, '0')}`, recibida_en: new Date(base + Math.floor(i / 3) * 1000).toISOString() })
    const vistos: string[] = []
    let offset = '', paginas = 0
    do {
      const b = await (await pedir(offset)).json()
      vistos.push(...b.data.records.map((r: any) => r.fields.Nombre))
      offset = b.data.offset
      paginas++
    } while (offset && paginas < 10)
    assert.equal(paginas, 3)
    assert.equal(vistos.length, 230)
    assert.equal(new Set(vistos).size, 230)
    assert.equal((await pedir('no-es-un-cursor')).status, 400)
    assert.equal((await pedir(codificarCursor(DESDE, 'no-uuid'))).status, 400)
  })
})

// ═══ 2. Apps Script real del CMC en una VM ═══════════════════════════════════════
const ORIGINAL = readFileSync(path.join(raiz, 'tests/cmc/cmc-sync-original.gs.js'), 'utf8')
const PARCHE = readFileSync(path.join(raiz, 'docs/cmc/fuente-supabase.gs'), 'utf8')
const EDICIONES: [string, string][] = [
  ['    registros = obtenerRegistrosAirtable_(token);', '    registros = obtenerRegistrosFuente_(token, opciones);'],
  ["      const idAirtable = String(fields['ID Airtable'] || '').trim();",
    "      const idAirtable = String(fields['ID Airtable'] || '').trim();\n      const idSupabase = String(fields['ID Supabase'] || '').trim();"],
  ['        const fila = idxLeads[idAirtable];', '        const fila = idxLeads[idAirtable] || (idSupabase ? idxLeads[idSupabase] : undefined);'],
  ['        const fila = idxCompitas[idAirtable];', '        const fila = idxCompitas[idAirtable] || (idSupabase ? idxCompitas[idSupabase] : undefined);'],
]
function codigoParcheado(): string {
  let s = ORIGINAL
  for (const [antes, despues] of EDICIONES) {
    assert.equal(s.split(antes).length - 1, 1, `la edición debe aplicarse exactamente una vez: ${antes.trim()}`)
    s = s.replace(antes, despues)
  }
  return s + '\n' + PARCHE
}

const ddmmyyyy = (d: Date) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/New_York', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
const yyyymmdd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

/** Hoja simulada. Fuera de la cuadrícula lanza, como Range de Apps Script. */
class Hoja {
  valores: any[][]
  constructor(public nombre: string, columnas: number, filas: any[][], vacias: number) {
    const ancho = (f: any[]) => [...f, ...Array(Math.max(0, columnas - f.length)).fill('')]
    this.valores = [ancho(['ID']), ...filas.map(ancho), ...Array.from({ length: vacias }, () => ancho([]))]
  }
  getMaxRows() { return this.valores.length }
  getLastRow() { for (let i = this.valores.length - 1; i >= 0; i--) if (this.valores[i].some((v) => v !== '' && v != null)) return i + 1; return 0 }
  getRange(r: number, c: number, nr = 1, nc = 1) {
    if (r < 1 || c < 1 || r + nr - 1 > this.valores.length || c + nc - 1 > this.valores[0].length) {
      throw new Error('The coordinates of the range are outside the dimensions of the sheet.')
    }
    const h = this
    const celdas = () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => h.valores[r - 1 + i][c - 1 + j]))
    return {
      getValues: () => celdas().map((f) => f.map((v) => (v instanceof Date ? new Date(v) : v))),
      getDisplayValues: () => celdas().map((f) => f.map((v) => (v instanceof Date ? ddmmyyyy(v) : String(v ?? '')))),
      setValues: (m: any[][]) => { m.forEach((f, i) => f.forEach((v, j) => { h.valores[r - 1 + i][c - 1 + j] = v })) },
      setValue: (v: any) => { h.valores[r - 1][c - 1] = v },
      setNumberFormat: () => {}, copyTo: () => {},
    }
  }
  fila(id: string) { return this.valores.find((f) => f[0] === id) }
  ids() { return this.valores.map((f) => f[0]).filter(Boolean).slice(1) }
}

type Entorno = { ctx: vm.Context; props: Map<string, string>; leads: Hoja; compitas: Hoja; llamadas: string[]; respuestas: Map<string, { code: number; body: string }>; airtable: any[] }

function entorno(codigo: string, opciones: { vacias?: number; airtable?: any[] } = {}): Entorno {
  const vacias = opciones.vacias ?? 5
  const compitas = new Hoja('03 · Compitas', 36, [
    ['COM-0001', new Date('2026-08-26T15:00:00Z'), 'Compita Histórica', '+584121110000', 'h@ejemplo.org', 'Caracas, Distrito Capital', '', 'Activo', '', '', '', '', '', 'Sí', 'Sí', '', '', 'rec0000000000000H'],
    ['COM-1062', new Date('2026-11-02T04:45:00Z'), 'PRUEBA – Luis Compita', '+584125554585', 'luis+compita@ejemplo.org', 'San Juan de Manapiare, Amazonas', '', 'Registrado', '', '', '', '', '', 'No', 'No', '', '', 'recCckAI1O8nL07T3'],
  ], vacias)
  const leads = new Hoja('02 · Leads & Clientes', 27, [
    ['CLI-0001', new Date('2026-08-20T15:00:00Z'), 'Familia Histórica', '+15550000000', 'f@ejemplo.org', '', '', '', 'Maracay, Aragua', '', '', '', 'Cliente', '', '', '', '', '', '', '', '', 'rec000000000000FH'],
    ['CLI-0020', new Date('2026-11-02T04:40:00Z'), 'PRUEBA – Luis Familia', '+584125554584', 'luis+familia@ejemplo.org', '', '', '', 'Chacao, Miranda', '', '', '', 'Nuevo', '', '', '', '', 'chatgpt.com', '', '', '', 'recwF7DwMRr2tJCtP'],
  ], vacias)
  const props = new Map<string, string>([['AIRTABLE_TOKEN', 'patFALSO'], ['CMC_SUPABASE_URL', URL_CMC], ['CMC_LECTURA_TOKEN', TOKEN]])
  const llamadas: string[] = []
  const respuestas = new Map<string, { code: number; body: string }>()
  const airtable = opciones.airtable ?? []
  const respuesta = (code: number, body: string) => ({ getResponseCode: () => code, getContentText: () => body })
  const ctx = vm.createContext({
    console: { log: () => {} }, Date, JSON, Math, String, Number, Array, Object, RegExp, Error, isNaN, parseInt, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props.get(k) ?? null, setProperty: (k: string, v: string) => { props.set(k, v) } }) },
    SpreadsheetApp: {
      getActive: () => ({ getSheetByName: (n: string) => (n === leads.nombre ? leads : n === compitas.nombre ? compitas : null) }),
      getUi: () => { throw new Error('sin interfaz en pruebas') },
      CopyPasteType: { PASTE_FORMAT: 'f', PASTE_DATA_VALIDATION: 'v' },
    },
    Utilities: { formatDate: (d: Date) => yyyymmdd(d) },
    Session: { getScriptTimeZone: () => 'America/New_York' },
    CONTROL_DUPLICADOS_ALTA_CFG: { ACTIVO: false },
    UrlFetchApp: {
      fetch: (url: string, o: any) => {
        llamadas.push(url)
        if (url.startsWith('https://api.airtable.com/')) return respuesta(200, JSON.stringify({ records: airtable }))
        if (o?.headers?.Authorization !== 'Bearer ' + props.get('CMC_LECTURA_TOKEN')) return respuesta(401, '{"ok":false}')
        const r = respuestas.get(url)
        if (!r) throw new Error('URL no precargada: ' + url)
        return respuesta(r.code, r.body)
      },
    },
  })
  vm.runInContext(codigo, ctx)
  return { ctx, props, leads, compitas, llamadas, respuestas, airtable }
}

/** La VM es síncrona: se precargan las respuestas reales de la ruta, página a página. */
async function precargar(e: Entorno) {
  e.respuestas.clear()
  let offset = ''
  for (let i = 0; i < 60; i++) {
    const res = await pedir(offset, e.props.get('CMC_LECTURA_TOKEN') ?? null)
    const body = await res.text()
    e.respuestas.set(URL_CMC + (offset ? '?offset=' + encodeURIComponent(offset) : ''), { code: res.status, body })
    if (res.status !== 200) return
    offset = JSON.parse(body).data.offset
    if (!offset) return
  }
}
const sincronizar = (e: Entorno, opciones: Record<string, any> = { silencioso: true }) =>
  vm.runInContext(`sincronizarAirtableInterno_(${JSON.stringify(opciones)})`, e.ctx)
const copiaHojas = (e: Entorno) => JSON.stringify([e.leads.valores, e.compitas.valores])

function escenarioBase() {
  // Las dos pruebas del Bloque 1 (llegaron a Airtable y ya están en la hoja)
  const pf = postulacion({ tipo: 'familia', airtable_id: 'recwF7DwMRr2tJCtP', nombre_declarado: 'PRUEBA – Luis Familia', telefono_declarado: '+584125554584', email_declarado: 'luis+familia@ejemplo.org', ubicacion_declarada: 'Chacao, Miranda', utm_source: 'chatgpt.com', recibida_en: '2026-11-02T04:40:00.000Z' })
  const pc = postulacion({ tipo: 'compita', airtable_id: 'recCckAI1O8nL07T3', nombre_declarado: 'PRUEBA – Luis Compita', telefono_declarado: '+584125554585', email_declarado: 'luis+compita@ejemplo.org', ubicacion_declarada: 'San Juan de Manapiare, Amazonas', recibida_en: '2026-11-02T04:45:00.000Z' })
  // Un Compita y una familia que no llegaron a Airtable (bloqueado)
  const nc = postulacion({ tipo: 'compita', nombre_declarado: 'Compita Nueva', telefono_declarado: '+584148820001', email_declarado: 'cn@ejemplo.org', ubicacion_declarada: 'Valencia, Carabobo', airtable_estado: 'agotada', recibida_en: '2026-11-05T01:59:19.394Z' })
  const nf = postulacion({ tipo: 'familia', nombre_declarado: 'Familia Nueva', telefono_declarado: '+34600000001', email_declarado: 'fn@ejemplo.org', ubicacion_declarada: 'Barquisimeto, Lara', utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'piloto', recibida_en: '2026-11-05T03:00:00.000Z' })
  // Repetida: no debe crear nada
  postulacion({ tipo: 'compita', clasificacion: 'repetida', nombre_declarado: 'Compita Nueva', telefono_declarado: '+584148820001', email_declarado: 'cn@ejemplo.org', recibida_en: '2026-11-05T02:00:00.000Z' })
  return { pf, pc, nc, nf }
}

describe('Apps Script del CMC con fuente Supabase', () => {
  test('las cuatro ediciones se aplican exactamente una vez sobre el código real', () => {
    assert.doesNotThrow(() => codigoParcheado())
  })

  test('SIMULACIÓN: planifica COM-1063 y una familia nueva, cero cambios en las pruebas, sin escribir ni llamar a Airtable', async () => {
    const { nc } = escenarioBase()
    const e = entorno(codigoParcheado())
    await precargar(e)
    const antes = copiaHojas(e)
    const r = vm.runInContext('simularFuenteSupabase()', e.ctx)
    assert.equal(copiaHojas(e), antes, 'la simulación no escribe')
    assert.equal(e.props.get('CMC_FUENTE'), undefined, 'la simulación no cambia el interruptor')
    assert.equal(e.llamadas.filter((u) => u.includes('airtable')).length, 0)
    assert.deepEqual([...r.planificadas], [`ALTA COM-1063 SB-${nc.id} Compita Nueva`])
    assert.equal(r.familiasNuevas, 1)
    assert.equal(r.compitasActualizados + r.familiasActualizadas, 0)
    assert.equal(r.revisadasC + r.revisadasL, 2)
    assert.equal(r.simulacionFallos.length, 0)
  })

  test('RECEPCIÓN: crea COM-1063 y CLI-0021 con los mismos campos que desde Airtable; la segunda pasada no crea nada', async () => {
    const { nc, nf } = escenarioBase()
    const e = entorno(codigoParcheado())
    e.props.set('CMC_FUENTE', 'supabase')
    await precargar(e)
    const r = sincronizar(e)
    assert.equal(r.compitasNuevos, 1)
    assert.equal(r.familiasNuevas, 1)
    assert.equal(r.compitasActualizados + r.familiasActualizadas, 0)
    const c = e.compitas.fila('COM-1063')!
    assert.deepEqual([c[2], c[3], c[4], c[5], c[7], c[13], c[14], c[17]], ['Compita Nueva', '+584148820001', 'cn@ejemplo.org', 'Valencia, Carabobo', 'Registrado', 'No', 'No', `SB-${nc.id}`])
    assert.equal(yyyymmdd(c[1]), '2026-11-04', 'fecha de registro en la zona de la hoja (20:59 NY del 4-nov)')
    const f = e.leads.fila('CLI-0021')!
    assert.deepEqual([f[2], f[3], f[4], f[8], f[12], f[17], f[18], f[19], f[21]], ['Familia Nueva', '+34600000001', 'fn@ejemplo.org', 'Barquisimeto, Lara', 'Nuevo', 'meta', 'paid', 'piloto', `SB-${nf.id}`])
    assert.equal(e.llamadas.filter((u) => u.includes('airtable')).length, 0)

    await precargar(e)
    const r2 = sincronizar(e)
    assert.equal(r2.compitasNuevos + r2.familiasNuevas, 0, 'idempotente')
    assert.equal(e.compitas.ids().length, 3)
    assert.equal(e.leads.ids().length, 3)
  })

  test('SOLO_SUPABASE: postulaciones con copia diferida (pendiente, sin Airtable) llegan al CMC y quedan listas para la bienvenida', async () => {
    const c = postulacion({ tipo: 'compita', nombre_declarado: 'Compita Diferida', telefono_declarado: '+584148820009', email_declarado: 'cd@ejemplo.org', airtable_estado: 'pendiente', recibida_en: '2026-11-10T15:00:00.000Z' })
    const f = postulacion({ tipo: 'familia', nombre_declarado: 'Familia Diferida', telefono_declarado: '+34600000009', email_declarado: 'fd@ejemplo.org', airtable_estado: 'pendiente', recibida_en: '2026-11-10T15:05:00.000Z' })
    const e = entorno(codigoParcheado())
    e.props.set('CMC_FUENTE', 'supabase')
    await precargar(e)
    const r = sincronizar(e)
    assert.equal(r.compitasNuevos, 1)
    assert.equal(r.familiasNuevas, 1)
    const fc = e.compitas.fila('COM-1063')!
    // Condiciones del flujo de nuevos registros del CMC: ID nuevo, Estado «Registrado», correo válido y «Estado preentrevista» vacío
    assert.deepEqual([fc[7], fc[4], fc[17], fc[21] ?? ''], ['Registrado', 'cd@ejemplo.org', `SB-${c.id}`, ''])
    assert.equal(e.leads.fila('CLI-0021')![21], `SB-${f.id}`)
    assert.equal(e.llamadas.filter((u) => u.includes('airtable')).length, 0)
  })

  test('SIN DUPLICADOS: una fila creada como SB-… se reconoce aunque la postulación obtenga después un rec…', async () => {
    const { nc } = escenarioBase()
    const e = entorno(codigoParcheado())
    e.props.set('CMC_FUENTE', 'supabase')
    await precargar(e)
    sincronizar(e)
    db.rows('postulaciones').find((p) => p.id === nc.id)!.airtable_id = 'recNUEVO000000001'
    await precargar(e)
    const r = sincronizar(e)
    assert.equal(r.compitasNuevos, 0)
    assert.equal(e.compitas.ids().filter((id) => id === 'COM-1064').length, 0)
  })

  test('SIN DUPLICADOS: alta manual con SB-<uuid> en «ID Airtable» (caso del Compita de Valencia)', async () => {
    const { nc } = escenarioBase()
    db.rows('postulaciones').find((p) => p.id === nc.id)!.resolucion = 'registrada_en_cmc'
    const e = entorno(codigoParcheado())
    e.compitas.getRange(4, 1, 1, 18).setValues([['COM-1063', new Date('2026-11-05T01:59:19.394Z'), 'Compita Nueva', '+584148820001', 'cn@ejemplo.org', 'Valencia, Carabobo', '', 'Registrado', '', '', '', '', '', 'No', 'No', '', 'Alta manual', `SB-${nc.id}`]])
    e.props.set('CMC_FUENTE', 'supabase')
    await precargar(e)
    const r = sincronizar(e)
    assert.equal(r.compitasNuevos, 0)
    assert.equal(r.compitasActualizados, 0)
    assert.deepEqual(e.compitas.ids(), ['COM-0001', 'COM-1062', 'COM-1063'])
  })

  test('HISTÓRICO: las filas anteriores al 2-nov no se tocan y conservan sus IDs', async () => {
    escenarioBase()
    const e = entorno(codigoParcheado())
    const histC = JSON.stringify(e.compitas.fila('COM-0001')), histL = JSON.stringify(e.leads.fila('CLI-0001'))
    e.props.set('CMC_FUENTE', 'supabase')
    await precargar(e)
    sincronizar(e)
    assert.equal(JSON.stringify(e.compitas.fila('COM-0001')), histC)
    assert.equal(JSON.stringify(e.leads.fila('CLI-0001')), histL)
  })

  test('REVERSIÓN: con CMC_FUENTE=airtable (o sin la propiedad) el código parcheado hace exactamente lo mismo que el original', async () => {
    const airtable = [
      { id: 'recA0000000000001', fields: { 'ID Airtable': 'recA0000000000001', Rol: 'compa', Nombre: 'Desde Airtable', Fecha: '2026-11-03T10:00:00.000Z', Contacto: 'WA: +584120000009 | Email: da@ejemplo.org | Rol: compa', Ciudad: 'Mérida, Mérida' } },
      { id: 'recCckAI1O8nL07T3', fields: { 'ID Airtable': 'recCckAI1O8nL07T3', Rol: 'compa', Nombre: 'PRUEBA – Luis Compita', Fecha: '2026-11-02T04:45:00.000Z', Contacto: 'WA: +584125554585 | Email: luis+compita@ejemplo.org | Rol: compa', Ciudad: 'San Juan de Manapiare, Amazonas' } },
    ]
    const original = entorno(ORIGINAL, { airtable })
    const parcheado = entorno(codigoParcheado(), { airtable })
    const rO = sincronizar(original)
    const rP = sincronizar(parcheado)
    parcheado.props.set('CMC_FUENTE', 'airtable')
    const rP2 = sincronizar(parcheado)
    assert.equal(copiaHojas(parcheado), copiaHojas(original))
    assert.equal(JSON.stringify({ ...rP, ms: 0 }), JSON.stringify({ ...rO, ms: 0 }))
    assert.equal(rP2.compitasNuevos, 0)
    assert.ok(parcheado.llamadas.every((u) => u.startsWith('https://api.airtable.com/')), 'no llama a la web')
  })

  test('FALLA CERRADO: token erróneo, web sin configurar o propiedad inválida → no escribe nada', async () => {
    escenarioBase()
    for (const prepara of [
      (e: Entorno) => e.props.set('CMC_LECTURA_TOKEN', 'otro'),
      (e: Entorno) => e.props.delete('CMC_SUPABASE_URL'),
      (e: Entorno) => e.props.set('CMC_FUENTE', 'supabas'),
    ]) {
      const e = entorno(codigoParcheado())
      e.props.set('CMC_FUENTE', 'supabase')
      prepara(e)
      await precargar(e)
      const antes = copiaHojas(e)
      assert.equal(sincronizar(e), null)
      assert.equal(copiaHojas(e), antes)
    }
    delete process.env.CMC_LECTURA_TOKEN // 503 en la web
    const e = entorno(codigoParcheado())
    e.props.set('CMC_FUENTE', 'supabase')
    await precargar(e)
    const antes = copiaHojas(e)
    assert.equal(sincronizar(e), null)
    assert.equal(copiaHojas(e), antes)
  })

  test('PRECONDICIÓN (modelo: Range fuera de la cuadrícula lanza): sin filas vacías al final de la hoja, la alta se omite y se reintenta en la siguiente hora', async () => {
    escenarioBase()
    const e = entorno(codigoParcheado(), { vacias: 0 })
    e.props.set('CMC_FUENTE', 'supabase')
    await precargar(e)
    const r = sincronizar(e)
    assert.equal(r.compitasNuevos, 0)
    assert.ok(r.omitidos >= 1)
  })
})

test('registroCmcDesdeFila: el Contacto es idéntico al que se envía a Airtable', () => {
  const r = registroCmcDesdeFila({ id: '00000000-0000-4000-8000-000000000000', tipo: 'compita', clasificacion: 'nueva', nombre_declarado: 'N', telefono_declarado: '+584140000000', email_declarado: 'n@e.org', ubicacion_declarada: 'X, Y', utm_source: null, utm_medium: null, utm_campaign: null, recibida_en: '2026-11-05T00:00:00Z', airtable_id: null, resolucion: null })
  assert.equal(r.fields.Contacto, 'WA: +584140000000 | Email: n@e.org | Rol: compa')
  assert.equal(r.fields.Fecha, '2026-11-05T00:00:00.000Z')
})
