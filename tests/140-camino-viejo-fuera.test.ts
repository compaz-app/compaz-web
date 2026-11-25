/* eslint-disable */
// Entrega 2: del camino viejo («el compita escribe horas en texto libre y el cliente las vuelve a proponer a mano») no queda nada vivo.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const leer = (f: string) => readFileSync(f, 'utf8')

describe('lo que ya no existe', () => {
  test('la ruta que recibía los horarios propuestos a mano', () => {
    assert.equal(existsSync('app/api/solicitud/proponer-reagendado/route.ts'), false)
  })
  test('la página /reagendar solo confirma el cambio de hora: sin formulario de horarios', () => {
    const p = leer('app/reagendar/[token]/page.tsx')
    assert.doesNotMatch(p, /proponer-reagendado|slotsElegidos|generarSlots|toggleSlot/)
    assert.match(p, /reagendar-cliente/); assert.match(p, /\/solicitar\/hora\?solicitud=/); assert.match(p, /Este enlace ya no sirve/)
  })
  test('el marketplace ya no tiene el formulario de horarios: solo los botones de pedir entrevista, contratar o mandado', () => {
    const m = leer('app/compitas/CompitasMarketplace.tsx')
    assert.doesNotMatch(m, /slots_propuestos|slotsElegidos|enviarSolicitud|mostrarFormulario|reagendarId|generarSlots/)
    assert.match(m, /\/solicitar\?compita=\$\{seleccionada\.id\}&modo=entrevista/)
  })
  test('el proceso nocturno ya no cierra «sugerencias de horarios» y Telegram ya no las captura', () => {
    assert.doesNotMatch(leer('app/api/cron/cierre-rechazo/route.ts'), /sugerir_horarios|sugerir_r/)
    const w = leer('app/api/telegram-webhook/route.ts')
    assert.doesNotMatch(w, /sugerir_horarios|sugerir_r|capturaSugerencia|mensaje_compita_reagendar/)
  })
  test('las funciones de reagendar por texto salieron de la capa de negocio y de las rutas', () => {
    assert.doesNotMatch(leer('lib/solicitudes.ts'), /iniciarReagendadoPorCompita|guardarSlotsReagendado/)
    for (const f of ['app/api/solicitud/resultado-llamada/route.ts', 'app/api/solicitud/reagendar-compita/route.ts']) assert.doesNotMatch(leer(f), /iniciarReagendadoPorCompita|sugerir_r:/, f)
  })
  test('la tarjeta del portal «horarios sugeridos» (texto libre del compita) ya no existe', () => {
    for (const f of ['lib/estado-cliente.ts', 'lib/portal-estados.ts', 'lib/panel-caso-tipos.ts']) assert.doesNotMatch(leer(f), /horarios_sugeridos/, f)
  })
})

describe('lo que sí queda', () => {
  test('cambiar la hora de una entrevista con horas libres sigue siendo estructurado', () => {
    assert.match(leer('app/api/solicitud/reagendar-compita/route.ts'), /reagendarEntrevista\(actual\.id, 'compita'\)/)
    assert.match(leer('app/api/solicitud/resultado-llamada/route.ts'), /reagendarEntrevista\(solicitud\.id, 'compita'\)/)
    assert.match(leer('app/api/solicitud/resultado-llamada/route.ts'), /\/reagendar\/\$\{encodeURIComponent\(token\)\}/)
  })
})
