// Copia los buckets de almacenamiento (fotos y fotos_privadas) del proyecto viejo al nuevo. Solo LEE del viejo. Uso: node scripts/migracion/02-copiar-fotos.mjs
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const aqui = dirname(fileURLToPath(import.meta.url))
for (const f of [join(aqui, '.env.migracion'), join(aqui, '../../.env.migracion')]) {
  if (existsSync(f)) { for (const l of readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') } break }
}
const { OLD_SUPABASE_URL: OV, OLD_SERVICE_KEY: OK, NEW_SUPABASE_URL: NV, NEW_SERVICE_KEY: NK } = process.env
if (!OV || !OK || !NV || !NK) { console.error('Faltan OLD_SUPABASE_URL, OLD_SERVICE_KEY, NEW_SUPABASE_URL o NEW_SERVICE_KEY en .env.migracion'); process.exit(1) }
if (OV === NV) { console.error('Las dos URL son iguales: se detiene.'); process.exit(1) }
// Las claves nuevas (sb_secret_...) van solo en apikey; las antiguas (JWT service_role) también como Bearer.
const h = (k) => (k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: `Bearer ${k}` })
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }

async function listar(base, key, bucket, prefijo = '') {
  const out = []
  for (let offset = 0; ; offset += 100) {
    const r = await fetch(`${base}/storage/v1/object/list/${bucket}`, { method: 'POST', headers: { ...h(key), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: prefijo, limit: 100, offset }) })
    const filas = await j(r); if (!Array.isArray(filas)) throw new Error(`No se pudo listar ${bucket}/${prefijo}: ${JSON.stringify(filas)}`)
    for (const f of filas) { if (f.id === null) out.push(...await listar(base, key, bucket, `${prefijo}${f.name}/`)); else out.push(`${prefijo}${f.name}`) }
    if (filas.length < 100) break
  }
  return out
}

const buckets = await j(await fetch(`${OV}/storage/v1/bucket`, { headers: h(OK) }))
if (!Array.isArray(buckets)) { console.error('No se pudo leer los buckets del proyecto viejo:', buckets); process.exit(1) }
let copiados = 0, fallidos = 0
for (const b of buckets) {
  const crear = await fetch(`${NV}/storage/v1/bucket`, { method: 'POST', headers: { ...h(NK), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, name: b.name, public: b.public, file_size_limit: b.file_size_limit ?? null, allowed_mime_types: b.allowed_mime_types ?? null }) })
  const rc = await j(crear); if (!crear.ok && !/already exists|Duplicate/i.test(JSON.stringify(rc))) { console.error(`No se pudo crear el bucket ${b.id}:`, rc); process.exit(1) }
  const rutas = await listar(OV, OK, b.id)
  console.log(`Bucket ${b.id} (${b.public ? 'público' : 'privado'}): ${rutas.length} archivos`)
  for (const ruta of rutas) {
    const bajar = await fetch(`${OV}/storage/v1/object/${b.id}/${ruta.split('/').map(encodeURIComponent).join('/')}`, { headers: h(OK) })
    if (!bajar.ok) { console.error(`  FALLO al bajar ${ruta}: ${bajar.status}`); fallidos++; continue }
    const tipo = bajar.headers.get('content-type') ?? 'application/octet-stream'
    const subir = await fetch(`${NV}/storage/v1/object/${b.id}/${ruta.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: { ...h(NK), 'Content-Type': tipo, 'x-upsert': 'true' }, body: Buffer.from(await bajar.arrayBuffer()) })
    if (subir.ok) copiados++; else { console.error(`  FALLO al subir ${ruta}: ${subir.status} ${await subir.text()}`); fallidos++ }
  }
}
console.log(`\nCopiados: ${copiados}. Fallidos: ${fallidos}.`)
process.exit(fallidos ? 1 : 0)
