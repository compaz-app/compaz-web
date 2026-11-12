// ══════════════════════════════════════════════════════════════════════════════
// CMC · Publicar Compitas habilitadas en la web (CMC → micompaz.com)
//
// Archivo NUEVO del proyecto Apps Script del CMC. No modifica ninguna función existente
// y NO escribe en la hoja: solo lee «03 · Compitas» y envía una foto a la web.
// Diseño completo: docs/cmc/compitas-desde-cmc.md (repositorio de la web).
//
// Qué envía: una FOTO COMPLETA de las filas con «Etapa de selección» = Habilitado
// (excepto las marcadas «Duplicado confirmado» por el control de duplicados) con solo
// 7 campos: ID Compita, Nombre, Email, Ubicación declarada, Etapa de selección,
// Estado operativo y Acepta nuevos servicios. Nada más sale del CMC.
//
// Propiedades del script:
//   CMC_COMPITAS_URL                      https://micompaz.com/api/cmc/compitas
//   CMC_ESCRITURA_TOKEN                   token de escritura (lo introduce Luis; nunca en el código)
//   CMC_PUBLICAR_COMPITAS                 interruptor: «si» publica; cualquier otro valor = apagado
//   CMC_AUTORIZAR_DESACTIVACION_MASIVA    «si» SOLO para una ejecución en la que Luis quiera retirar
//                                         a varias Compitas a la vez; se borra sola tras usarse
// Funciones:
//   simularPublicacionCompitas()          envía con ?dryRun=1: la web solo lee y devuelve el plan
//   publicarCompitasWeb()                 la que ejecuta el disparador horario
//   instalarDisparadorPublicarCompitas()  crea el disparador (solo con autorización)
// Falla cerrado: sin URL, sin token, sin hoja, con columnas que faltan o con una lectura
// sospechosamente corta, no envía nada y la ejecución termina en error.
// ══════════════════════════════════════════════════════════════════════════════

var PUB_COMPITAS_CFG = {
  HOJA: '03 · Compitas',
  MIN_FILAS_CON_ID: 50,
  COLUMNAS: {
    codigo: 'ID Compita',
    nombre: 'Nombre',
    email: 'Email',
    ubicacion: 'Ubicación declarada',
    etapa: 'Etapa de selección',
    estado_operativo: 'Estado operativo',
    acepta_nuevos: 'Acepta nuevos servicios',
    duplicado: 'Clasificación duplicado'
  }
};

function simularPublicacionCompitas() {
  var r = publicarCompitasInterno_({ dryRun: true });
  console.log('SIMULACION_PUBLICAR_COMPITAS ' + JSON.stringify(r));
  return r;
}

function publicarCompitasWeb() {
  var props = PropertiesService.getScriptProperties();
  if (String(props.getProperty('CMC_PUBLICAR_COMPITAS') || '').trim().toLowerCase() !== 'si') {
    console.log('PUBLICAR_COMPITAS apagado (CMC_PUBLICAR_COMPITAS distinto de «si»): no se envía nada.');
    return { omitido: 'apagado' };
  }
  return publicarCompitasInterno_({ dryRun: false });
}

function publicarCompitasInterno_(opciones) {
  var dryRun = !!(opciones && opciones.dryRun);
  var props = PropertiesService.getScriptProperties();
  var url = String(props.getProperty('CMC_COMPITAS_URL') || '').trim();
  var token = String(props.getProperty('CMC_ESCRITURA_TOKEN') || '').trim();
  if (!/^https:\/\//.test(url)) throw new Error('FAIL-CLOSED: falta CMC_COMPITAS_URL (https) en las propiedades del script.');
  if (token.length < 32) throw new Error('FAIL-CLOSED: falta CMC_ESCRITURA_TOKEN en las propiedades del script.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Otra publicación está en curso; se reintentará en la próxima hora.');
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PUB_COMPITAS_CFG.HOJA);
    if (!sh) throw new Error('FAIL-CLOSED: no existe la hoja ' + PUB_COMPITAS_CFG.HOJA);
    var foto = construirFotoCompitas_(sh.getDataRange().getDisplayValues(), new Date());

    var masiva = String(props.getProperty('CMC_AUTORIZAR_DESACTIVACION_MASIVA') || '').trim().toLowerCase() === 'si';
    foto.desactivacion_masiva_autorizada = masiva && !dryRun;

    var resp = UrlFetchApp.fetch(url + (dryRun ? '?dryRun=1' : ''), {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(foto),
      muteHttpExceptions: true,
      followRedirects: false
    });
    var codigo = resp.getResponseCode();
    var cuerpo = String(resp.getContentText() || '').slice(0, 4000);
    var resultado = { modo: dryRun ? 'simular' : 'aplicar', http: codigo, enviados: foto.compitas.length, filas_leidas: foto.filas_leidas, respuesta: cuerpo };

    if (!dryRun) {
      props.setProperty('CMC_PUBLICAR_ULTIMO', JSON.stringify({ cuando: new Date().toISOString(), http: codigo, enviados: foto.compitas.length }));
      if (codigo === 200 && masiva) props.deleteProperty('CMC_AUTORIZAR_DESACTIVACION_MASIVA');
    }
    if (codigo !== 200) throw new Error('La web respondió ' + codigo + ': ' + cuerpo.slice(0, 500));
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

/** Foto completa a partir de los valores visibles de la hoja (fila 1 = cabeceras). Función pura. */
function construirFotoCompitas_(valores, ahora) {
  if (!valores || valores.length < 2) throw new Error('FAIL-CLOSED: la hoja 03 está vacía.');
  var cab = valores[0].map(function (h) { return String(h || '').trim(); });
  var idx = {};
  Object.keys(PUB_COMPITAS_CFG.COLUMNAS).forEach(function (k) {
    var i = cab.indexOf(PUB_COMPITAS_CFG.COLUMNAS[k]);
    if (i < 0) throw new Error('FAIL-CLOSED: falta la columna «' + PUB_COMPITAS_CFG.COLUMNAS[k] + '» en la hoja 03.');
    idx[k] = i;
  });
  var t = function (fila, k) { return String(fila[idx[k]] == null ? '' : fila[idx[k]]).trim(); };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); };

  var filas = valores.slice(1).filter(function (f) { return t(f, 'codigo') !== ''; });
  if (filas.length < PUB_COMPITAS_CFG.MIN_FILAS_CON_ID) {
    throw new Error('FAIL-CLOSED: solo ' + filas.length + ' filas con ID Compita; lectura sospechosa, no se envía nada.');
  }
  var compitas = [];
  filas.forEach(function (f) {
    if (norm(t(f, 'etapa')) !== 'habilitado') return;
    if (/^duplicado confirmado/.test(norm(t(f, 'duplicado')))) return;
    compitas.push({
      codigo: t(f, 'codigo'),
      nombre: t(f, 'nombre'),
      email: t(f, 'email'),
      ubicacion: t(f, 'ubicacion'),
      etapa: t(f, 'etapa'),
      estado_operativo: t(f, 'estado_operativo'),
      acepta_nuevos: t(f, 'acepta_nuevos')
    });
  });
  return {
    version: 1,
    generado_en: ahora.toISOString(),
    filas_leidas: filas.length,
    completo: true,
    desactivacion_masiva_autorizada: false,
    compitas: compitas
  };
}

/** Crea el disparador horario (minuto ~40). Ejecutar SOLO con autorización. No duplica. */
function instalarDisparadorPublicarCompitas() {
  var existe = ScriptApp.getProjectTriggers().some(function (tr) { return tr.getHandlerFunction() === 'publicarCompitasWeb'; });
  if (existe) return 'Ya existe el disparador de publicarCompitasWeb.';
  ScriptApp.newTrigger('publicarCompitasWeb').timeBased().everyHours(1).nearMinute(40).create();
  return 'Disparador creado: publicarCompitasWeb cada hora (minuto ~40).';
}
