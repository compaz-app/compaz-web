// Ensayo de Luis · resumen final: qué guardó Supabase local, qué recibió "Compaz Pruebas"
// y qué respondió la web a cada envío. Solo publica nombre, tipo y estado (sin teléfonos ni
// correos: los registros de GitHub de este repositorio son públicos).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import { listarCreadosDesde } from '../../lib/airtable.ts'

const DB = process.env.E2E_DB_URL
const DESDE = process.env.CAPTACION_DESDE
const ENLACE = 'ENLACE DEL ENSAYO'
const sql = (q) => JSON.parse(execFileSync('psql', [DB, '-At', '-c', `select coalesce(json_agg(t), '[]') from (${q}) t`], { encoding: 'utf8' }).trim() || '[]')

const filas = sql(`select nombre_declarado as nombre, tipo, clasificacion, airtable_estado as estado, airtable_id from public.postulaciones order by recibida_en`)
const at = await listarCreadosDesde(DESDE)
const enAirtable = (at.ok ? at.registros : []).filter((r) => r.nombre !== ENLACE)
const vinculadas = new Set(filas.map((f) => f.airtable_id).filter(Boolean))
const sinVincular = enAirtable.filter((r) => !vinculadas.has(r.id))
const duplicados = enAirtable.length - new Set(enAirtable.map((r) => `${r.contacto}|${r.fecha}`)).size
const log = existsSync('/tmp/ensayo-solicitudes.log') ? readFileSync('/tmp/ensayo-solicitudes.log', 'utf8').trim().split('\n').filter(Boolean) : []
const codigos = log.map((l) => l.split(' ').pop())
const aceptadas = codigos.filter((c) => c === '200').length
const rechazadas = codigos.filter((c) => c === '429').length
const otras = codigos.filter((c) => c !== '200' && c !== '429')

const n = (t) => String(t ?? '').replace(/[\r\n|:]+/g, ' ').slice(0, 60)
const tipos = new Set(filas.map((f) => f.tipo))
const comprobaciones = [
  ['Dos postulaciones guardadas en Supabase (una de Compita y otra de familia)', filas.length === 2 && tipos.size === 2],
  ['Las dos copiadas a Airtable', filas.length > 0 && filas.every((f) => f.estado === 'enviada')],
  ['Compaz Pruebas tiene exactamente 2 registros nuevos', enAirtable.length === 2],
  ['Ningún registro de Airtable sin su postulación', at.ok && sinVincular.length === 0],
  ['Ningún duplicado en Airtable', duplicados === 0],
  ['La solicitud repetida fue rechazada (HTTP 429)', rechazadas >= 1],
  ['Ninguna respuesta de error inesperada', otras.length === 0],
]
const lineas = [
  '## Ensayo de Luis · resultado', '',
  '| # | Nombre | Tipo | Clasificación | Copia a Airtable | ID en Airtable |', '| --- | --- | --- | --- | --- | --- |',
  ...filas.map((f, i) => `| ${i + 1} | ${n(f.nombre)} | ${f.tipo} | ${f.clasificacion} | ${f.estado} | ${f.airtable_id ?? '—'} |`), '',
  `- Envíos del formulario: ${codigos.length} (aceptados ${aceptadas}, rechazados por repetición ${rechazadas}, otros ${otras.length}${otras.length ? ': ' + otras.join(', ') : ''})`,
  `- Registros nuevos en Compaz Pruebas (sin contar el del enlace): ${enAirtable.length}${at.ok ? '' : ' — no se pudo leer Airtable'}`, '',
  ...comprobaciones.map(([t, ok]) => `- ${ok ? '✅' : '❌'} ${t}`),
]
const resumen = lineas.join('\n')
console.log(resumen)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumen + '\n')
filas.forEach((f, i) => console.log(`::notice title=Postulación ${i + 1}::${n(f.nombre)} · ${f.tipo} · ${f.clasificacion} · Airtable ${f.estado} ${f.airtable_id ?? ''}`))
console.log(`::notice title=Envíos del formulario::aceptados ${aceptadas} · rechazados por repetición ${rechazadas} · otros ${otras.length}`)
for (const [t, ok] of comprobaciones) console.log(`::${ok ? 'notice' : 'error'} title=${ok ? 'OK' : 'FALLO'}::${t}`)
if (!comprobaciones.every(([, ok]) => ok)) process.exit(1)
