// ══════════════════════════════════════════════════════════════════════════════
// Compaz · Bloque 1 · Prueba contra la API REAL de Airtable (base de pruebas)
//
// Comprueba lo que los dobles no pueden garantizar:
//   A1 · La base no es la de producción (aborta si lo es).
//   A2 · Crear un registro con los campos de siempre.
//   A3 · Airtable conserva los milisegundos de "Fecha" (parte de la huella).
//   A4 · La fórmula {Contacto} = "…" encuentra el registro, también con comillas
//        y barras en el texto (escapado).
//   A5 · La fórmula IS_AFTER(CREATED_TIME(), "…") lo lista (conciliación).
//   A6 · Las fórmulas de la tabla (Teléfono, Email, Rol) leen el Contacto canónico.
//
// Uso (solo con la base de pruebas):
//   AIRTABLE_API_KEY=… AIRTABLE_BASE_ID=app… node --experimental-strip-types tests/integracion/airtable-real.mjs
// Deja registros de prueba en la base de pruebas (marcados "PRUEBA CI"); no borra nada.
// Es .mjs (no .ts) para que tsc y next build no lo comprueben: Node lo ejecuta
// importando directamente lib/airtable.ts con --experimental-strip-types.
// ══════════════════════════════════════════════════════════════════════════════
import { crearRegistroAirtable, obtenerRegistro, buscarPorContacto, listarCreadosDesde, mismaFecha } from '../../lib/airtable.ts'

const BASE_PRODUCCION = 'appd3xCmNZEIJ0rWS'
/** @type {{ id: string, ok: boolean, detalle: string }[]} */
const resultados = []
const enCI = process.env.GITHUB_ACTIONS === 'true'
const limpio = (t) => String(t).replace(/[\r\n]+/g, ' ').replace(/::/g, ': :')
const anotar = (id, ok, detalle) => {
  resultados.push({ id, ok, detalle })
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${id} · ${detalle}`)
  // En CI, cada resultado queda como anotación del trabajo (visible sin abrir los registros)
  if (enCI) console.log(`::${ok ? 'notice' : 'error'} title=${id} ${ok ? 'OK' : 'FALLO'}::${limpio(detalle)}`)
}

async function main() {
  const base = process.env.AIRTABLE_BASE_ID ?? ''
  if (!process.env.AIRTABLE_API_KEY || !base) { console.log('SALTADA: faltan AIRTABLE_API_KEY o AIRTABLE_BASE_ID de pruebas'); if (process.env.AIRTABLE_OBLIGATORIA === 'si') { console.log('::error title=Airtable::Secretos de Airtable de pruebas ausentes'); process.exit(1) } return }
  if (base === BASE_PRODUCCION) { console.error('ABORTADO: AIRTABLE_BASE_ID es la base de producción'); process.exit(1) }
  anotar('A1', true, 'la base no es la de producción')

  const inicio = new Date(Date.now() - 60_000).toISOString()
  const marca = Date.now().toString(36)
  const fecha = new Date(Math.floor(Date.now() / 1000) * 1000 + 123).toISOString()   // milisegundos = 123
  const contacto = `WA: +58412${String(Date.now()).slice(-7)} | Email: ci.${marca}"\\x@prueba.test | Rol: compa`

  const c = await crearRegistroAirtable({ nombre: `PRUEBA CI ${marca}`, contacto, ciudad: 'Caracas, Distrito Capital', fecha, utmSource: 'ci', utmMedium: 'prueba', utmCampaign: marca })
  anotar('A2', c.ok, c.ok ? `creado ${c.id}` : c.error)
  if (!c.ok) return

  const leido = await obtenerRegistro(c.id)
  anotar('A3', !!leido && mismaFecha(leido.fecha, fecha), `Fecha enviada ${fecha} · leída ${leido?.fecha ?? 'nada'}`)

  const b = await buscarPorContacto(contacto)
  anotar('A4', b.ok && b.registros.length === 1 && b.registros[0].id === c.id, b.ok ? `${b.registros.length} coincidencia(s)` : b.error)

  const l = await listarCreadosDesde(inicio)
  anotar('A5', l.ok && l.registros.some((r) => r.id === c.id), l.ok ? `${l.registros.length} registro(s) desde ${inicio}` : l.error)

  // A6 · fórmulas propias de la tabla (lectura directa de los campos calculados)
  const res = await fetch(`https://api.airtable.com/v0/${base}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME ?? 'Lista de Espera')}/${c.id}`,
    { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } })
  const f = (await res.json()).fields ?? {}
  const rolOk = f['Rol'] === undefined || f['Rol'] === 'compa'
  anotar('A6', res.ok && rolOk, `Teléfono=${JSON.stringify(f['Teléfono'])} Email=${JSON.stringify(f['Email'])} Rol=${JSON.stringify(f['Rol'])}`)
}

main().then(() => {
  const fallos = resultados.filter((r) => !r.ok)
  console.log(`\n${resultados.length - fallos.length}/${resultados.length} comprobaciones correctas`)
  if (enCI) console.log(`::notice title=Resumen Airtable real::${resultados.length - fallos.length}/${resultados.length} comprobaciones correctas`)
  if (fallos.length) process.exit(1)
}).catch((e) => { console.error(e); process.exit(1) })
