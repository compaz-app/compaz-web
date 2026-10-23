// ══════════════════════════════════════════════════════════════════════════════
// Compaz · Bloque 1 · Prueba de extremo a extremo (CI)
//
// Entorno, creado por .github/workflows/captacion.yml en cada ejecución:
//   · Supabase local completo (CLI oficial) con la migración de captación.
//   · La web compilada (next build + next start) en http://localhost:3000.
//   · Airtable REAL, en una base de PRUEBAS (nunca la de producción).
// Nada de esto toca producción: el script aborta si la base de Airtable es la de
// producción o si la URL de Supabase no es local.
//
// Escenarios:
//   E1  alta normal: Supabase guarda, Airtable recibe una copia con la misma huella
//   E2  reintento técnico (mismo envío): sin filas ni registros nuevos
//   E3  concurrencia por HTTP: 6 envíos simultáneos → 1 fila, 1 registro en Airtable
//   E4  confirmación perdida: el registro ya existe en Airtable → el cron lo vincula, no lo crea
//   E5  copia pendiente sin registro: el cron la crea una vez; otra ejecución no duplica
//   E6  Airtable inalcanzable para una fila → 5 intentos → bandeja → resolución con autor
//   E7  Supabase caído (se detiene de verdad) → la web guarda en Airtable → al volver,
//       la conciliación la importa una sola vez
//   E8  honeypot: no guarda nada
// ══════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { crearRegistroAirtable, buscarPorContacto, obtenerRegistro, mismaFecha } from '../../lib/airtable.ts'

const SITE = process.env.E2E_SITE_URL ?? 'http://localhost:3000'
const DB = process.env.E2E_DB_URL ?? ''
const CRON = process.env.CRON_SECRET ?? ''
const KONG = process.env.E2E_KONG_CONTAINER ?? ''
const BASE_PRODUCCION = 'appd3xCmNZEIJ0rWS'

const resultados = []
const enCI = process.env.GITHUB_ACTIONS === 'true'
const limpio = (t) => String(t).replace(/[\r\n]+/g, ' ').replace(/::/g, ': :')
const anotar = (id, ok, detalle) => {
  resultados.push({ id, ok, detalle })
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${id} · ${detalle}`)
  // En CI, cada resultado queda como anotación del trabajo (visible sin abrir los registros)
  if (enCI) console.log(`::${ok ? 'notice' : 'error'} title=${id} ${ok ? 'OK' : 'FALLO'}::${limpio(detalle)}`)
}
const sql = (q) => execFileSync('psql', [DB, '-At', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim()
const sqlJson = (q) => JSON.parse(sql(`select coalesce(json_agg(t), '[]') from (${q}) t`) || '[]')
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

let sec = 0
function persona() {
  sec++
  const tel = `+58414${String(Date.now()).slice(-6)}${sec}`.slice(0, 13)
  return { tel, email: `e2e.${Date.now().toString(36)}.${sec}@prueba.test`, nombre: `E2E Prueba ${sec}` }
}
const contactoDe = (p, rol = 'compa') => `WA: ${p.tel} | Email: ${p.email} | Rol: ${rol}`

async function postular(p, extra = {}) {
  const res = await fetch(`${SITE}/api/waitlist`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://micompaz.com' },
    body: JSON.stringify({
      nombre: p.nombre, whatsapp: p.tel, email: p.email, ciudad: 'Chacao, Miranda', contacto: contactoDe(p),
      website: '', turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX', utmSource: 'e2e', utmMedium: 'ci', utmCampaign: 'bloque1',
      utmContent: 'contenido', utmTerm: 'termino', fuente: 'home', claveIdempotencia: p.clave ?? randomUUID(), ...extra,
    }),
  })
  return res.status
}
async function cron(nombre) {
  const res = await fetch(`${SITE}/api/cron/${nombre}`, { method: 'POST', headers: { 'x-cron-secret': CRON } })
  const body = await res.json().catch(() => null)
  return { status: res.status, data: body?.data }
}
const filas = (tel) => sqlJson(`select id, airtable_estado, airtable_id, recibida_en, fuente, airtable_intentos, utm_content from public.postulaciones where telefono_declarado = '${tel}' order by recibida_en`)
const enAirtable = async (p, rol = 'compa') => { const b = await buscarPorContacto(contactoDe(p, rol)); if (!b.ok) throw new Error(b.error); return b.registros }
const vencerEsperas = () => sql(`update public.postulaciones set airtable_reclamada_hasta = null, airtable_proximo_intento = now() - interval '1 second' where airtable_estado in ('pendiente','error')`)
function registrarDirecto(p) {
  return sqlJson(`select * from public.registrar_postulacion('${randomUUID()}', 'compita', 'home', '${p.nombre}', '${p.tel}', '${p.email}', 'Chacao', 'Miranda', '${p.tel}', '${p.email}', 'Chacao, Miranda')`)[0]
}

async function main() {
  // Salvaguardas de aislamiento
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) { console.log('SALTADA: faltan los secretos de la base de Airtable de pruebas'); if (process.env.AIRTABLE_OBLIGATORIA === 'si') { console.log('::error title=E2E::Secretos de Airtable de pruebas ausentes'); process.exit(1) } return }
  if (process.env.AIRTABLE_BASE_ID === BASE_PRODUCCION) { console.error('ABORTADO: la base de Airtable es la de producción'); process.exit(1) }
  if (!/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):/.test(DB)) { console.error('ABORTADO: la base de datos no es local'); process.exit(1) }

  // E1 · alta normal
  const p1 = persona(); p1.clave = randomUUID()
  const s1 = await postular(p1)
  const f1 = filas(p1.tel)
  const r1 = await enAirtable(p1)
  const reg1 = f1[0]?.airtable_id ? await obtenerRegistro(f1[0].airtable_id) : null
  anotar('E1', s1 === 200 && f1.length === 1 && f1[0].airtable_estado === 'enviada' && r1.length === 1 && r1[0].id === f1[0].airtable_id
    && !!reg1 && mismaFecha(reg1.fecha, f1[0].recibida_en) && f1[0].utm_content === 'contenido',
    `HTTP ${s1}, filas=${f1.length}, estado=${f1[0]?.airtable_estado}, Airtable=${r1.length}, misma huella=${!!reg1 && mismaFecha(reg1.fecha, f1[0]?.recibida_en)}`)

  // E2 · reintento técnico (mismo envío, misma clave)
  const s2 = await postular(p1)
  const f2 = filas(p1.tel), r2 = await enAirtable(p1)
  anotar('E2', [200, 429].includes(s2) && f2.length === 1 && r2.length === 1, `HTTP ${s2}, filas=${f2.length}, Airtable=${r2.length}`)

  // E3 · concurrencia: 6 envíos simultáneos de la misma persona con claves distintas
  const p3 = persona()
  const s3 = await Promise.all(Array.from({ length: 6 }, () => postular(p3)))
  await esperar(1500)
  const f3 = filas(p3.tel), r3 = await enAirtable(p3)
  anotar('E3', s3.every((s) => s === 200 || s === 429) && f3.length === 1 && r3.length === 1,
    `HTTP ${[...new Set(s3)].join('/')}, filas=${f3.length}, Airtable=${r3.length}`)

  // E4 · confirmación perdida: la copia existe en Airtable pero Supabase no lo sabe
  const p4 = persona()
  const d4 = registrarDirecto(p4)
  const c4 = await crearRegistroAirtable({ nombre: p4.nombre, contacto: contactoDe(p4), ciudad: 'Chacao, Miranda',
    fecha: new Date(d4.recibida_en).toISOString(), utmSource: '', utmMedium: '', utmCampaign: '' })
  vencerEsperas()
  const k4 = await cron('reintentar-airtable')
  const f4 = filas(p4.tel), r4 = await enAirtable(p4)
  anotar('E4', c4.ok && k4.status === 200 && f4[0].airtable_estado === 'enviada' && f4[0].airtable_id === c4.id && r4.length === 1,
    `cron=${k4.status} ${JSON.stringify(k4.data)}, estado=${f4[0]?.airtable_estado}, Airtable=${r4.length}`)

  // E5 · copia pendiente sin registro en Airtable: se crea una sola vez
  const p5 = persona()
  registrarDirecto(p5)
  vencerEsperas()
  const k5 = await cron('reintentar-airtable')
  vencerEsperas()
  await cron('reintentar-airtable')
  const f5 = filas(p5.tel), r5 = await enAirtable(p5)
  anotar('E5', k5.status === 200 && f5[0].airtable_estado === 'enviada' && r5.length === 1,
    `estado=${f5[0]?.airtable_estado}, Airtable=${r5.length}`)

  // E6 · una fila cuya búsqueda es imposible (salto de línea en el correo) → nunca se crea,
  //      agota sus 5 intentos, aparece en la bandeja y se resuelve con autor
  const p6 = persona()
  const d6 = sqlJson(`select * from public.registrar_postulacion('${randomUUID()}', 'compita', 'home', '${p6.nombre}', '${p6.tel}', null, null, null, '${p6.tel}', E'roto\\n@prueba.test', 'Caracas')`)[0]
  for (let i = 0; i < 5; i++) { vencerEsperas(); await cron('reintentar-airtable') }
  const f6 = filas(p6.tel)
  const bandeja = sqlJson(`select id from public.postulaciones_por_resolver(500)`).map((x) => x.id)
  const resuelta = sql(`select public.resolver_postulacion('${d6.postulacion_id}', 'registrada_en_cmc', 'e2e@ci', 'Prueba E2E')`)
  const bandeja2 = sqlJson(`select id from public.postulaciones_por_resolver(500)`).map((x) => x.id)
  const autor = sql(`select actor from public.eventos where entidad_id = '${d6.postulacion_id}' and tipo = 'resuelta_registrada_en_cmc'`)
  anotar('E6', f6[0].airtable_estado === 'agotada' && f6[0].airtable_intentos === 5 && bandeja.includes(d6.postulacion_id)
    && resuelta === 't' && !bandeja2.includes(d6.postulacion_id) && autor === 'e2e@ci',
    `estado=${f6[0]?.airtable_estado}, intentos=${f6[0]?.airtable_intentos}, en bandeja=${bandeja.includes(d6.postulacion_id)}, resuelta=${resuelta}, autor=${autor}`)

  // E7 · Supabase caído de verdad → la web guarda solo en Airtable → al volver, se importa una vez
  const p7 = persona()
  let s7 = 0, conc1 = null, conc2 = null
  if (KONG) {
    execFileSync('docker', ['stop', KONG])
    s7 = await postular(p7)
    execFileSync('docker', ['start', KONG])
    for (let i = 0; i < 30; i++) { try { sql('select 1'); const r = await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/`); if (r.status < 500) break } catch {} await esperar(1000) }
    await esperar(2000)
    conc1 = await cron('conciliar-airtable')
    conc2 = await cron('conciliar-airtable')
  }
  const f7 = filas(p7.tel), r7 = await enAirtable(p7)
  anotar('E7', !!KONG && s7 === 200 && r7.length === 1 && f7.length === 1 && f7[0].fuente === 'respaldo_airtable' && f7[0].airtable_id === r7[0].id
    && conc1?.status === 200 && conc2?.data?.importada === 0,
    `HTTP con Supabase caído=${s7}, Airtable=${r7.length}, filas tras conciliar=${f7.length}, fuente=${f7[0]?.fuente}, 1ª=${JSON.stringify(conc1?.data)}, 2ª importadas=${conc2?.data?.importada}`)

  // E8 · honeypot
  const p8 = persona()
  const s8 = await postular(p8, { website: 'http://spam.test' })
  anotar('E8', s8 === 200 && filas(p8.tel).length === 0 && (await enAirtable(p8)).length === 0, `HTTP ${s8}, sin filas ni registros`)
}

main().then(() => {
  const fallos = resultados.filter((r) => !r.ok)
  console.log(`\n${resultados.length - fallos.length}/${resultados.length} escenarios de extremo a extremo correctos`)
  if (enCI) console.log(`::notice title=Resumen E2E::${resultados.length - fallos.length}/${resultados.length} escenarios correctos`)
  if (fallos.length) process.exit(1)
}).catch((e) => { console.error(e); process.exit(1) })
