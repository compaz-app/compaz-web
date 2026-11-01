// ══════════════════════════════════════════════════════════════════════════════
// Compaz · Vigilancia de crons contra la estructura REAL de producción (CI)
//
// Usa el Supabase local del job e2e (PostgREST real), con telegram_estados creada
// exactamente como en producción (sin updated_at). Comprueba:
//   V1  la estructura de partida es la de producción
//   V2  sin la columna, latido() devuelve false y lo avisa (no falla en silencio)
//   V3  sin la columna, vigilarLatidos() no lanza y avisa una vez al día
//   V4  los crons de captación terminan su trabajo aunque el latido falle (HTTP 200)
//   V5  la migración añade la columna, es idempotente y no toca filas existentes
//   V6  con la columna, latido() guarda la fila del cron
//   V7  un cron con latido viejo se detecta como detenido
//   V8  un cron que nunca corrió se detecta (desde vigilancia:inicio)
//   V9  los crons de Juan sin historial no dan falsas alarmas en su periodo de gracia
//   V10 con la captación apagada, sus crons no se vigilan
// ══════════════════════════════════════════════════════════════════════════════
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DB = process.env.E2E_DB_URL ?? ''
const SITE = process.env.E2E_SITE_URL ?? 'http://localhost:3000'
if (!/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):/.test(DB)) { console.error('ABORTADO: la base de datos no es local'); process.exit(1) }

const enCI = process.env.GITHUB_ACTIONS === 'true'
const resultados = []
const anotar = (id, ok, detalle) => {
  resultados.push({ id, ok })
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${id} · ${detalle}`)
  if (enCI) console.log(`::${ok ? 'notice' : 'error'} title=${id} ${ok ? 'OK' : 'FALLO'}::${String(detalle).replace(/[\r\n]+/g, ' ').replace(/::/g, ': :')}`)
}
const sql = (q) => execFileSync('psql', [DB, '-At', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim()

// Empaqueta lib/cron.ts con el cliente de Supabase real (sin next/headers) y un Telegram espía
const tmp = mkdtempSync(path.join(tmpdir(), 'vigilancia-'))
writeFileSync(path.join(tmp, 'supabase-shim.ts'),
  `import { createClient } from '@supabase/supabase-js'\nexport function createAdminSupabase() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) }\n`)
writeFileSync(path.join(tmp, 'telegram-shim.ts'),
  `export const avisos: string[] = []\nexport async function avisarAdmin(t: string) { avisos.push(t); return true }\n`)
writeFileSync(path.join(tmp, 'entrada.ts'),
  `export * from '@/lib/cron'\nexport { avisos } from '@/lib/telegram'\n`)
await build({
  entryPoints: [path.join(tmp, 'entrada.ts')], outfile: path.join(tmp, 'cron.cjs'),
  bundle: true, platform: 'node', format: 'cjs', logLevel: 'error', nodePaths: [path.join(root, 'node_modules')],
  external: ['next', 'next/*'],
  plugins: [{ name: 'alias', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase-server$/ }, () => ({ path: path.join(tmp, 'supabase-shim.ts') }))
    b.onResolve({ filter: /^@\/lib\/telegram$/ }, () => ({ path: path.join(tmp, 'telegram-shim.ts') }))
    b.onResolve({ filter: /^@\// }, (a) => ({ path: path.join(root, a.path.slice(2)) + '.ts' }))
  } }],
})
const cron = createRequire(import.meta.url)(path.join(tmp, 'cron.cjs'))
const hoy = new Date().toISOString().slice(0, 10)

async function main() {
  // V1 · estructura de producción
  const cols = sql(`select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'telegram_estados'`)
  anotar('V1', cols === 'chat_id,registro_pendiente,pendiente_accion,pendiente_expira', `columnas: ${cols}`)

  // V2 · latido sin columna
  sql(`delete from public.telegram_estados where chat_id like 'cron:%' or chat_id like 'alerta_%' or chat_id = 'vigilancia:inicio'`)
  cron.avisos.length = 0
  const ok2 = await cron.latido('recordatorios')
  const alertaFila = sql(`select count(*) from public.telegram_estados where chat_id = 'alerta_vigilancia:${hoy}'`)
  anotar('V2', ok2 === false && cron.avisos.length === 1 && cron.avisos[0].includes('Vigilancia de crons sin funcionar') && alertaFila === '1',
    `latido=${ok2}, avisos=${cron.avisos.length}, fila de aviso diario=${alertaFila}`)

  // V3 · vigilancia sin columna: no lanza y no repite el aviso del día
  let lanzo = false, r3 = null
  try { r3 = await cron.vigilarLatidos() } catch { lanzo = true }
  anotar('V3', !lanzo && Array.isArray(r3) && cron.avisos.length === 1, `lanzó=${lanzo}, resultado=${JSON.stringify(r3)}, avisos totales=${cron.avisos.length}`)

  // V4 · los crons terminan su trabajo aunque el latido falle
  const secreto = process.env.CRON_SECRET ?? ''
  const llamar = async (n) => (await fetch(`${SITE}/api/cron/${n}`, { method: 'POST', headers: { 'x-cron-secret': secreto } })).status
  const s4a = await llamar('reintentar-airtable'), s4b = await llamar('conciliar-airtable')
  const filas4 = sql(`select count(*) from public.telegram_estados where chat_id like 'cron:%'`)
  anotar('V4', s4a === 200 && s4b === 200 && filas4 === '0', `reintentar=${s4a}, conciliar=${s4b}, latidos guardados=${filas4} (esperado 0 sin la columna)`)

  // V5 · migración: añade la columna, idempotente, sin tocar filas
  const antes = sql(`select count(*) from public.telegram_estados`)
  execFileSync('psql', [DB, '-v', 'ON_ERROR_STOP=1', '-q', '-f', path.join(root, 'supabase/migrations/20261101_telegram_estados_updated_at.sql')])
  execFileSync('psql', [DB, '-v', 'ON_ERROR_STOP=1', '-q', '-f', path.join(root, 'supabase/migrations/20261101_telegram_estados_updated_at.sql')])
  sql(`notify pgrst, 'reload schema'`)
  await new Promise((r) => setTimeout(r, 2000))
  const despues = sql(`select count(*) from public.telegram_estados`)
  const nulos = sql(`select count(*) from public.telegram_estados where updated_at is null`)
  const cols5 = sql(`select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'telegram_estados'`)
  anotar('V5', cols5.endsWith(',updated_at') && antes === despues && nulos === '0', `columnas: ${cols5}; filas antes=${antes}, después=${despues}, sin fecha=${nulos}`)

  // V6 · latido con la columna
  sql(`delete from public.telegram_estados where chat_id like 'cron:%' or chat_id like 'alerta_%' or chat_id = 'vigilancia:inicio'`)
  cron.avisos.length = 0
  const ok6 = await cron.latido('reintentar-airtable')
  const fila6 = sql(`select count(*) from public.telegram_estados where chat_id = 'cron:reintentar-airtable' and updated_at > now() - interval '1 minute'`)
  anotar('V6', ok6 === true && fila6 === '1' && cron.avisos.length === 0, `latido=${ok6}, fila=${fila6}, avisos=${cron.avisos.length}`)

  // V9 · crons de Juan sin historial: sin alarmas en el periodo de gracia (vigilancia recién iniciada)
  const antesDesde = process.env.CAPTACION_DESDE
  delete process.env.CAPTACION_DESDE
  const r9 = await cron.vigilarLatidos()
  const inicio = sql(`select count(*) from public.telegram_estados where chat_id = 'vigilancia:inicio'`)
  anotar('V9', r9.length === 0 && inicio === '1', `alertas=${JSON.stringify(r9)}, vigilancia:inicio creada=${inicio}`)

  // V10 · captación apagada: sus crons no se vigilan aunque el latido sea viejo
  sql(`update public.telegram_estados set updated_at = now() - interval '5 hours' where chat_id in ('cron:reintentar-airtable', 'vigilancia:inicio')`)
  for (const n of ['recordatorios', 'seguimiento', 'recordatorio-cuestionario', 'cierre-rechazo', 'recordatorio-visita']) await cron.latido(n)
  const r10 = await cron.vigilarLatidos()
  anotar('V10', r10.length === 0, `alertas con captación apagada=${JSON.stringify(r10)}`)

  // V7 y V8 · captación activa desde hace 4 h: reintentar con latido viejo y conciliar sin ninguno
  process.env.CAPTACION_DESDE = new Date(Date.now() - 4 * 3600_000).toISOString()
  cron.avisos.length = 0
  const r78 = await cron.vigilarLatidos()
  anotar('V7', r78.includes('reintentar-airtable') && cron.avisos.some((a) => a.includes('reintentar-airtable') && a.includes('no corre')), `alertas=${JSON.stringify(r78)}`)
  anotar('V8', r78.includes('conciliar-airtable') && cron.avisos.some((a) => a.includes('conciliar-airtable') && a.includes('ninguna ejecución')), `avisos=${cron.avisos.length}`)
  const otras = r78.filter((n) => !['reintentar-airtable', 'conciliar-airtable'].includes(n))
  if (otras.length) anotar('V9b', false, `alarmas inesperadas en crons de Juan: ${otras.join(', ')}`)
  const repetida = await cron.vigilarLatidos()
  anotar('V7b', repetida.length === 0, `una segunda vigilancia dentro de la hora no repite avisos: ${JSON.stringify(repetida)}`)
  if (antesDesde === undefined) delete process.env.CAPTACION_DESDE; else process.env.CAPTACION_DESDE = antesDesde
}

main().then(() => {
  const fallos = resultados.filter((r) => !r.ok)
  console.log(`\n${resultados.length - fallos.length}/${resultados.length} comprobaciones de vigilancia correctas`)
  if (enCI) console.log(`::notice title=Resumen vigilancia::${resultados.length - fallos.length}/${resultados.length} comprobaciones correctas`)
  if (fallos.length) process.exit(1)
}).catch((e) => { console.error(e); if (enCI) console.log(`::error title=Excepción::${String(e?.message ?? e).replace(/[\r\n]+/g, ' ').slice(0, 300)}`); process.exit(1) })
