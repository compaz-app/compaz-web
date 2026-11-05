// Copia literal (5-nov-2026) de las funciones del Apps Script del CMC que intervienen en
// la sincronización de altas (proyecto ligado a Centro_de_Mando_Compaz_V4, archivo
// «Código»). Solo para pruebas: se ejecuta en una VM de Node con dobles de
// SpreadsheetApp, PropertiesService y UrlFetchApp. NO se despliega.
// Líneas de origen: 1-9 (CFG), 479-500, 705-718, 1671-2140 (sin actualizarFamilia_, que la
// sincronización no usa) y 7144-7152.
const CFG = {
  REGISTRAR: '00 · Registrar',
  DASHBOARD: '01 · Dashboard',
  LEADS: '02 · Leads & Clientes',
  COMPITAS: '03 · Compitas',
  SERVICIOS: '04 · Servicios',
  FINANZAS: '05 · Finanzas',
  CONFIG: '06 · Configuración'
};

function generarSiguienteId_(sheet, prefijo) {
  const lastRow = Math.max(sheet.getLastRow(), 2);

  const valores = sheet
    .getRange(2, 1, Math.max(lastRow - 1, 1), 1)
    .getDisplayValues()
    .flat();

  let max = 0;

  valores.forEach(valor => {
    const match = String(valor).match(
      new RegExp('^' + prefijo + '-(\\d+)$')
    );

    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  });

  return `${prefijo}-${String(max + 1).padStart(4, '0')}`;
}

function siguienteFila_(sheet) {
  const ids = sheet
    .getRange(2, 1, sheet.getMaxRows() - 1, 1)
    .getDisplayValues()
    .flat();

  const primeraVacia = ids.findIndex(v => !v);

  if (primeraVacia === -1) {
    return sheet.getMaxRows() + 1;
  }

  return primeraVacia + 2;
}

const AIRTABLE_BASE_ID = 'appd3xCmNZEIJ0rWS';
const AIRTABLE_TABLE = 'Lista de Espera';

function heredarFormatoYValidacionV_(sheet, filaInicio, filaFin) {
  try {
    const filaModeloV = sheet.getRange(2, 22);
    const rangoNuevoV = sheet.getRange(filaInicio, 22, filaFin - filaInicio + 1, 1);
    filaModeloV.copyTo(rangoNuevoV, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    filaModeloV.copyTo(rangoNuevoV, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  } catch (errFormatoV) {
    console.log('No se pudo heredar formato/validacion de columna V: ' + String(errFormatoV));
  }
}

function sincronizarAirtable() {
  // Candado: evita ejecuciones solapadas (causa de duplicados e IDs repetidos).
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    SpreadsheetApp.getUi().alert('Ya hay una sincronización con Airtable en curso. Inténtalo de nuevo en unos minutos.');
    return;
  }
  try {
    sincronizarAirtableInterno_(); // índices y creación se calculan dentro del candado
  } finally {
    lock.releaseLock();
  }
}

/* ===== Sincronizacion Airtable: helpers de comparacion en bloque ===== */
function sincFechaClave_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v === null || v === undefined ? '' : v).trim();
}

function sincDiferente_(tipo, actual, deseado) {
  if (tipo === 'fecha') return sincFechaClave_(actual) !== sincFechaClave_(deseado);
  const a = String(actual === null || actual === undefined ? '' : actual);
  const b = String(deseado === null || deseado === undefined ? '' : deseado);
  if (tipo === 'tel') return a.replace(/\D/g, '').slice(-10) !== b.replace(/\D/g, '').slice(-10);
  return a.trim() !== b.trim();
}

/** Devuelve solo las celdas de contacto/UTM que realmente difieren (nunca toca progreso ni estado). */
function sincPlanificarCambios_(fila, fields, esFamilia) {
  const m = esFamilia
    ? { ciudad: 8, utmS: 17, utmM: 18, utmC: 19 }
    : { ciudad: 5, utmS: 18, utmM: 19, utmC: 20 };
  const d = [];
  const fechaObj = normalizarFechaAirtable_(fields['Fecha']);
  if (fechaObj) d.push({ idx: 1, tipo: 'fecha', valor: fechaObj });
  if (fields['Nombre']) d.push({ idx: 2, tipo: 'texto', valor: fields['Nombre'] });
  const telefono = obtenerTelefonoAirtable_(fields);
  if (telefono) d.push({ idx: 3, tipo: 'tel', valor: telefono });
  const email = obtenerEmailAirtable_(fields);
  if (email) d.push({ idx: 4, tipo: 'texto', valor: email });
  if (fields['Ciudad']) d.push({ idx: m.ciudad, tipo: 'texto', valor: fields['Ciudad'] });
  if (fields['UTM Source']) d.push({ idx: m.utmS, tipo: 'texto', valor: fields['UTM Source'] });
  if (fields['UTM Medium']) d.push({ idx: m.utmM, tipo: 'texto', valor: fields['UTM Medium'] });
  if (fields['UTM Campaign']) d.push({ idx: m.utmC, tipo: 'texto', valor: fields['UTM Campaign'] });
  return d.filter(function (x) { return sincDiferente_(x.tipo, fila[x.idx], x.valor); });
}

/**
 * Sincroniza Airtable -> 02/03.
 * Orden: (1) altas nuevas primero, (2) solo celdas que cambiaron en registros existentes.
 * Limite de tiempo preventivo; es reanudable porque cada alta se decide por ID Airtable
 * (indice reconstruido en cada ejecucion + validacion fail-closed en crearCompita_).
 * opciones.dryRun = true -> solo lectura, devuelve el plan sin escribir.
 */
function sincronizarAirtableInterno_(opciones) {
  const dryRun = !!(opciones && opciones.dryRun);
  const LIMITE_MS = 240000;
  const t0 = Date.now();
  const excedido = function () { return (Date.now() - t0) > LIMITE_MS; };
  const silencioso = !!(opciones && opciones.silencioso);
  const ui = (dryRun || silencioso) ? null : SpreadsheetApp.getUi();
  const avisar = function (titulo, msg) {
    if (ui) ui.alert(titulo, msg, ui.ButtonSet.OK);
    else console.log(titulo + ' | ' + msg);
  };

  const token = PropertiesService.getScriptProperties().getProperty('AIRTABLE_TOKEN');
  if (!token) {
    avisar('Sincronizacion Airtable', 'No se encontro AIRTABLE_TOKEN en Script Properties.');
    return null;
  }

  let registros;
  try {
    registros = obtenerRegistrosAirtable_(token);
  } catch (err) {
    avisar('Sincronizacion Airtable', 'No se pudo completar la sincronizacion con Airtable.\n' + String((err && err.message) || err));
    return null;
  }

  const ss = SpreadsheetApp.getActive();
  const leads = ss.getSheetByName(CFG.LEADS);
  const compitas = ss.getSheetByName(CFG.COMPITAS);
  if (!leads || !compitas) {
    avisar('Sincronizacion Airtable', 'No se encontraron las hojas de Leads o Compitas.');
    return null;
  }

  const resumen = {
    familiasNuevas: 0, familiasActualizadas: 0,
    compitasNuevos: 0, compitasActualizados: 0,
    sinCambios: 0, omitidos: 0, repetidos: 0, erroresEscritura: 0,
    pendientesCreacion: 0, pendientesActualizacion: 0,
    planificadas: [], simulacionFallos: []
  };

  // Lectura en bloque (una sola vez) + indices por ID Airtable (primera fila = canonica)
  const idxLeads = construirIndiceIdAirtable_(leads, 22);
  const idxCompitas = construirIndiceIdAirtable_(compitas, 18);
  const nL = leads.getLastRow() - 1;
  const nC = compitas.getLastRow() - 1;
  const datosL = nL > 0 ? leads.getRange(2, 1, nL, 22).getValues() : [];
  const datosC = nC > 0 ? compitas.getRange(2, 1, nC, 21).getValues() : [];

  const nuevasFamilias = [];
  const nuevasCompitas = [];
  const cambiosL = [];
  const cambiosC = [];
  let revisadasL = 0;
  let revisadasC = 0;
  const vistos = {};

  registros.forEach(function (rec) {
    try {
      const fields = rec.fields || {};
      const idAirtable = String(fields['ID Airtable'] || '').trim();
      const rol = String(fields['Rol'] || '').trim().toLowerCase();
      if (!idAirtable) { resumen.omitidos++; return; }
      const clave = rol + '|' + idAirtable;
      if (vistos[clave]) { resumen.repetidos++; return; }
      vistos[clave] = true;

      if (rol === 'familia') {
        const fila = idxLeads[idAirtable];
        if (fila && datosL[fila - 2]) {
          revisadasL++;
          const cs = sincPlanificarCambios_(datosL[fila - 2], fields, true);
          if (cs.length) cambiosL.push({ fila: fila, id: idAirtable, cs: cs });
        } else if (!fila) {
          nuevasFamilias.push({ fields: fields, idAirtable: idAirtable });
        }
      } else if (rol === 'compa') {
        const fila = idxCompitas[idAirtable];
        if (fila && datosC[fila - 2]) {
          revisadasC++;
          const cs = sincPlanificarCambios_(datosC[fila - 2], fields, false);
          if (cs.length) cambiosC.push({ fila: fila, id: idAirtable, cs: cs });
        } else if (!fila) {
          nuevasCompitas.push({ fields: fields, idAirtable: idAirtable });
        }
      } else {
        resumen.omitidos++;
      }
    } catch (errRegistro) {
      resumen.omitidos++;
      console.log('Omitido ID Airtable=' + (rec.fields && rec.fields['ID Airtable']) + ' motivo=' + String(errRegistro));
    }
  });

  ordenarPorFechaAscendente_(nuevasFamilias);
  ordenarPorFechaAscendente_(nuevasCompitas);

  let primeraFilaNuevaV = null;
  let ultimaFilaNuevaV = null;

  if (dryRun) {
    // Simulacion: ningun write. Valida que los IDs previstos pasarian los guardas fail-closed.
    const base = parseInt(String(generarSiguienteId_(compitas, 'COM')).replace(/\D/g, ''), 10);
    nuevasCompitas.forEach(function (item, i) {
      const idPlan = 'COM-' + String(base + i).padStart(4, '0');
      try {
        validarCreacionCompitaSegura_(compitas, idPlan, item.idAirtable);
        resumen.compitasNuevos++;
        resumen.planificadas.push('ALTA ' + idPlan + ' ' + item.idAirtable + ' ' + String(item.fields['Nombre'] || ''));
      } catch (e) {
        resumen.omitidos++;
        resumen.simulacionFallos.push(String(e));
      }
    });
    resumen.familiasNuevas = nuevasFamilias.length;
    cambiosC.forEach(function (c) {
      resumen.planificadas.push('UPD-C fila ' + c.fila + ' cols ' + c.cs.map(function (x) { return x.idx + 1; }).join(','));
    });
    cambiosL.forEach(function (c) {
      resumen.planificadas.push('UPD-L fila ' + c.fila + ' cols ' + c.cs.map(function (x) { return x.idx + 1; }).join(','));
    });
    resumen.compitasActualizados = cambiosC.length;
    resumen.familiasActualizadas = cambiosL.length;
    resumen.sinCambios = (revisadasC - cambiosC.length) + (revisadasL - cambiosL.length);
    resumen.revisadasC = revisadasC;
    resumen.revisadasL = revisadasL;
    resumen.ms = Date.now() - t0;
    return resumen;
  }

  // (1) ALTAS PRIMERO
  nuevasFamilias.forEach(function (item) {
    if (excedido()) { resumen.pendientesCreacion++; return; }
    try {
      if (idxLeads[item.idAirtable]) { resumen.repetidos++; return; }
      const nuevaFila = crearFamilia_(leads, item.fields, item.idAirtable);
      idxLeads[item.idAirtable] = nuevaFila;
      resumen.familiasNuevas++;
    } catch (errRegistro) {
      resumen.omitidos++;
      console.log('Omitido ID Airtable=' + item.idAirtable + ' Rol=familia motivo=' + String(errRegistro));
    }
  });

  nuevasCompitas.forEach(function (item) {
    if (excedido()) { resumen.pendientesCreacion++; return; }
    try {
      if (idxCompitas[item.idAirtable]) { resumen.repetidos++; return; }
      const nuevaFila = crearCompita_(compitas, item.fields, item.idAirtable);
      idxCompitas[item.idAirtable] = nuevaFila;
      resumen.compitasNuevos++;
      if (primeraFilaNuevaV === null) primeraFilaNuevaV = nuevaFila;
      ultimaFilaNuevaV = nuevaFila;
    } catch (errRegistro) {
      resumen.omitidos++;
      console.log('Omitido ID Airtable=' + item.idAirtable + ' Rol=compa motivo=' + String(errRegistro));
    }
  });

  if (primeraFilaNuevaV !== null) {
    heredarFormatoYValidacionV_(compitas, primeraFilaNuevaV, ultimaFilaNuevaV);
  }

  // (2) ACTUALIZACIONES: solo celdas que cambiaron
  const aplicar = function (hoja, lista, claveResumen) {
    lista.forEach(function (item) {
      if (excedido()) { resumen.pendientesActualizacion++; return; }
      let ok = true;
      item.cs.forEach(function (c) {
        try {
          const cel = hoja.getRange(item.fila, c.idx + 1);
          cel.setValue(c.valor);
          if (c.tipo === 'fecha') cel.setNumberFormat('dd/MM/yyyy');
        } catch (e) {
          ok = false;
          resumen.erroresEscritura++;
          console.log('Error escritura fila ' + item.fila + ' col ' + (c.idx + 1) + ': ' + String(e));
        }
      });
      if (ok) resumen[claveResumen]++;
    });
  };
  aplicar(compitas, cambiosC, 'compitasActualizados');
  aplicar(leads, cambiosL, 'familiasActualizadas');
  resumen.sinCambios = (revisadasC - cambiosC.length) + (revisadasL - cambiosL.length);

  const completa = resumen.pendientesCreacion === 0 && resumen.pendientesActualizacion === 0;
  const seg = Math.round((Date.now() - t0) / 1000);
  try {
    PropertiesService.getScriptProperties().setProperty('SYNC_AT_ULTIMO', JSON.stringify({
      fecha: new Date().toISOString(), completa: completa, segundos: seg,
      compitasNuevos: resumen.compitasNuevos, compitasActualizados: resumen.compitasActualizados,
      pendientesCreacion: resumen.pendientesCreacion, pendientesActualizacion: resumen.pendientesActualizacion,
      omitidos: resumen.omitidos
    }));
  } catch (ePropiedad) { console.log('No se pudo guardar estado: ' + String(ePropiedad)); }

  avisar(
    completa ? 'Sincronizacion Airtable completada' : 'Sincronizacion Airtable INCOMPLETA (limite de tiempo)',
    'Familias nuevas: ' + resumen.familiasNuevas + '\n' +
    'Familias actualizadas: ' + resumen.familiasActualizadas + '\n' +
    'Compitas nuevos: ' + resumen.compitasNuevos + '\n' +
    'Compitas actualizados: ' + resumen.compitasActualizados + '\n' +
    'Sin cambios: ' + resumen.sinCambios + '\n' +
    'Omitidos: ' + resumen.omitidos + ' | Repetidos: ' + resumen.repetidos + ' | Errores de escritura: ' + resumen.erroresEscritura + '\n' +
    (completa ? '' : 'Pendientes: ' + resumen.pendientesCreacion + ' altas, ' + resumen.pendientesActualizacion + ' actualizaciones. Vuelve a ejecutar para continuar (no duplica).\n') +
    'Tiempo: ' + seg + ' s'
  );
  return resumen;
}
function obtenerRegistrosAirtable_(token) {
  const base =
    'https://api.airtable.com/v0/' +
    AIRTABLE_BASE_ID + '/' +
    encodeURIComponent(AIRTABLE_TABLE);

  let registros = [];
  let offset = '';

  do {
    let url = base + '?pageSize=100';

    if (offset) {
      url += '&offset=' + encodeURIComponent(offset);
    }

    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });

    const code = resp.getResponseCode();

    if (code !== 200) {
      throw new Error('Airtable devolvio el codigo HTTP ' + code + '.');
    }

    const json = JSON.parse(resp.getContentText());
    registros = registros.concat(json.records || []);
    offset = json.offset || '';
  } while (offset);

  return registros;
}

function construirIndiceIdAirtable_(sheet, columna) {
  const idx = {};
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return idx;

  const valores = sheet
    .getRange(2, columna, lastRow - 1, 1)
    .getDisplayValues();

  valores.forEach(function (r, i) {
    const v = String(r[0] || '').trim();
    if (v && !idx[v]) idx[v] = i + 2; // la primera fila (canónica) gana
  });

  return idx;
}

function ordenarPorFechaAscendente_(items) {
  items.sort(function (a, b) {
    const fa = normalizarFechaAirtable_(a.fields['Fecha']);
    const fb = normalizarFechaAirtable_(b.fields['Fecha']);
    if (fa && fb) return fa.getTime() - fb.getTime();
    if (fa && !fb) return -1;
    if (!fa && fb) return 1;
    return 0;
  });
}

function normalizarFechaAirtable_(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  return d;
}

function obtenerTelefonoAirtable_(fields) {
  if (fields['Telefono'] || fields['Teléfono']) {
    return fields['Telefono'] || fields['Teléfono'];
  }

  const contacto = String(fields['Contacto'] || '');
  const m = contacto.match(/(\+?\d[\d\s\-()]{6,}\d)/);

  return m ? m[1].trim() : '';
}

function obtenerEmailAirtable_(fields) {
  if (fields['Email']) return fields['Email'];

  const contacto = String(fields['Contacto'] || '');
  const m = contacto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);

  return m ? m[0] : '';
}

function crearFamilia_(sheet, fields, idAirtable) {
  const row = siguienteFila_(sheet);
  const idCliente = generarSiguienteId_(sheet, 'CLI');
  const numCols = 22;
  const rowValues = new Array(numCols).fill('');
  rowValues[0] = idCliente;
  rowValues[12] = 'Nuevo';
  rowValues[21] = idAirtable;
  const fechaObj = normalizarFechaAirtable_(fields['Fecha']);
  if (fechaObj) rowValues[1] = fechaObj;
  rowValues[2] = fields['Nombre'] || '';
  rowValues[3] = obtenerTelefonoAirtable_(fields);
  rowValues[4] = obtenerEmailAirtable_(fields);
  rowValues[8] = fields['Ciudad'] || '';
  rowValues[17] = fields['UTM Source'] || '';
  rowValues[18] = fields['UTM Medium'] || '';
  rowValues[19] = fields['UTM Campaign'] || '';
  sheet.getRange(row, 1, 1, numCols).setValues([rowValues]);
  if (fechaObj) {
    try { sheet.getRange(row, 2).setNumberFormat('dd/MM/yyyy'); }
    catch (e) { console.log('No se pudo formatear Fecha para ' + idAirtable + ': ' + String(e)); }
  }
  return row;
}

function validarCreacionCompitaSegura_(sheet, idCompita, idAirtable) {
  // Fail-closed: nunca crear una fila si el ID Compita o el ID Airtable ya existen.
  const n = sheet.getLastRow() - 1;
  if (n < 1) return;
  const ids = sheet.getRange(2, 1, n, 1).getDisplayValues();
  const ats = sheet.getRange(2, 18, n, 1).getDisplayValues();
  const at = String(idAirtable || '').trim();
  for (let i = 0; i < n; i++) {
    if (String(ids[i][0]).trim() === idCompita) {
      throw new Error('FAIL-CLOSED: el ID Compita ' + idCompita + ' ya existe en la fila ' + (i + 2) + '; no se crea la fila.');
    }
    if (at && String(ats[i][0]).trim() === at) {
      throw new Error('FAIL-CLOSED: el ID Airtable ' + at + ' ya existe en la fila ' + (i + 2) + '; se debe actualizar, no crear.');
    }
  }
}

function crearCompita_(sheet, fields, idAirtable) {
  const row = siguienteFila_(sheet);
  const idCompita = generarSiguienteId_(sheet, 'COM');
  validarCreacionCompitaSegura_(sheet, idCompita, idAirtable);
  const numCols = 21;
  const rowValues = new Array(numCols).fill('');
  rowValues[0] = idCompita;
  rowValues[7] = 'Registrado';
  rowValues[13] = 'No';
  rowValues[14] = 'No';
  rowValues[17] = idAirtable;
  const fechaObj = normalizarFechaAirtable_(fields['Fecha']);
  if (fechaObj) rowValues[1] = fechaObj;
  rowValues[2] = fields['Nombre'] || '';
  rowValues[3] = obtenerTelefonoAirtable_(fields);
  rowValues[4] = obtenerEmailAirtable_(fields);
  rowValues[5] = fields['Ciudad'] || '';
  rowValues[18] = fields['UTM Source'] || '';
  rowValues[19] = fields['UTM Medium'] || '';
  rowValues[20] = fields['UTM Campaign'] || '';
  sheet.getRange(row, 1, 1, numCols).setValues([rowValues]);
  if (fechaObj) {
    try { sheet.getRange(row, 2).setNumberFormat('dd/MM/yyyy'); }
    catch (e) { console.log('No se pudo formatear Fecha para ' + idAirtable + ': ' + String(e)); }
  }
  // Control preventivo de altas duplicadas: solo anota la fila nueva; nunca bloquea ni toca otras filas.
  ejecutarControlDuplicadoAltaSeguro_(sheet, row);
  return row;
}

function ejecutarControlDuplicadoAltaSeguro_(sheet, row) {
  if (!CONTROL_DUPLICADOS_ALTA_CFG.ACTIVO) return '';
  try {
    return aplicarControlDuplicadoAlta_(sheet, row);
  } catch (err) {
    console.log('CONTROL_DUPLICADO_ERROR fila ' + row + ': ' + String(err));
    return '';
  }
}
