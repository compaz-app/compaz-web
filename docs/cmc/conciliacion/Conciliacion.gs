/**
 * Conciliacion.gs — conciliación INDEPENDIENTE de la hoja 03 con el panel (CMC 2A).
 *
 * Uso: se pega como archivo temporal en el proyecto «CMC · API de lectura del panel» (permiso
 * spreadsheets.readonly), se ejecuta `conciliarHoja03` desde el editor y se borra el archivo.
 * La implementación publicada no cambia (queda fijada a su versión).
 *
 * No usa nada del panel ni de ApiPanel.gs/HojaSoloLectura.gs: lee las hojas 03 y 11 con la API
 * de Sheets y aplica las reglas por su cuenta, para que un error en la ruta del panel no se
 * repita aquí. Solo escribe en el registro de ejecución: cifras, códigos COM (no son datos de
 * contacto) y huellas SHA-256 de las listas ordenadas, que se comparan con las del panel.
 * No registra nombres, teléfonos, correos ni respuestas.
 */
function conciliarHoja03() {
  var LIBRO = '1-ZOER7VHAlVdesChGIVMFKQC-1ZDCpzrdmiUNdeoLas';
  var leer = function (rango) { return Sheets.Spreadsheets.Values.get(LIBRO, rango).values || []; };
  var v = leer("'03 · Compitas'!A1:AJ");
  var enc = v[0].map(function (x) { return String(x).trim(); });
  var col = function (n) { var i = enc.indexOf(n); if (i < 0) throw new Error('falta columna ' + n); return i; };
  var cId = col('ID Compita'), cNom = col('Nombre'), cEt = col('Etapa de selección'), cCla = col('Clasificación duplicado'),
    cPre = col('Estado preentrevista'), cSel = col('Estado selección'), cOp = col('Estado operativo');
  var txt = function (f, i) { return String(f[i] == null ? '' : f[i]).trim(); };

  // Alertas abiertas y bloqueantes (hoja 11).
  var a = leer("'11 · Alertas Compitas'!A1:Z");
  var ea = (a[0] || []).map(function (x) { return String(x).trim(); });
  var aId = ea.indexOf('ID Compita'), aEst = ea.indexOf('Estado'), aBl = ea.indexOf('Bloquea matching');
  var bloquea = {}, abiertas = {};
  for (var k = 1; k < a.length; k++) {
    var idA = txt(a[k], aId), est = txt(a[k], aEst).toLowerCase();
    if (!idA || /cerrad|resuel|anulad/.test(est)) continue;
    abiertas[idA] = (abiertas[idA] || 0) + 1;
    if (aBl >= 0 && /^s[ií]/i.test(txt(a[k], aBl))) bloquea[idA] = (bloquea[idA] || 0) + 1;
  }

  // Entrevistas registradas (hoja 08): cualquier código COM en sus primeras columnas.
  var e8 = leer("'08 · Entrevistas Compitas'!A2:J"), entrevistados = {};
  e8.forEach(function (f) { f.forEach(function (x) { (String(x).match(/COM-\d{4,6}/g) || []).forEach(function (c) { entrevistados[c] = 1; }); }); });

  var sinTilde = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var ETAPAS = ['Registrado', 'Preseleccionado', 'Entrevistado', 'En verificación', 'Habilitado', 'Descartado'];
  var PRUEBA_COD = { 'COM-1057': 1, 'COM-1062': 1, 'COM-1064': 1 };
  var PRUEBA_TXT = /\b(test|prueba|ejemplo|asdf|demo)\b/i;

  var L = { filas: [], descartadas: [], duplicados: [], pruebas: [], aspirantes: [], atencion: [], bloqueados: [], preseleccionadosConEntrevista: [], excluidosSeleccion: [] };
  ETAPAS.concat(['Sin etapa']).forEach(function (e) { L['etapa:' + e] = []; });
  var cruce = {}, vistos = {}, filasConDatos = 0;

  for (var r = 1; r < v.length; r++) {
    var f = v[r];
    if (!f.some(function (x) { return String(x).trim() !== ''; })) continue;
    filasConDatos++;
    var id = txt(f, cId);
    if (!/^COM-\d{4,6}$/.test(id) || vistos[id]) { L.descartadas.push((id || '(vacío)') + '@fila' + (r + 1)); continue; }
    vistos[id] = 1; L.filas.push(id);
    if (/duplicado confirmado/i.test(txt(f, cCla))) { L.duplicados.push(id); continue; }
    if (PRUEBA_COD[id] || PRUEBA_TXT.test(txt(f, cNom))) { L.pruebas.push(id); continue; }
    L.aspirantes.push(id);
    var crudo = txt(f, cEt), et = 'Sin etapa';
    ETAPAS.forEach(function (e) { if (sinTilde(e) === sinTilde(crudo)) et = e; });
    L['etapa:' + et].push(id);
    var pre = txt(f, cPre), sel = txt(f, cSel), bl = bloquea[id] || 0;
    // Lo que debe pedir acción según el CMC (la cola de entrevistas del CMC usa «Formulario completado»).
    var aten = bl > 0 ? 'bloqueado'
      : et === 'Sin etapa' ? 'accion'
      : et === 'Registrado' ? (pre === 'Formulario completado' ? 'accion' : 'espera')
      : et === 'Preseleccionado' || et === 'Entrevistado' || et === 'En verificación' ? 'accion'
      : et === 'Habilitado' ? 'accion-si-no-esta-en-catalogo'
      : 'cerrado';
    if (aten === 'bloqueado') L.bloqueados.push(id);
    if (et === 'Preseleccionado' && entrevistados[id]) L.preseleccionadosConEntrevista.push(id);
    if (sel === 'Excluido') L.excluidosSeleccion.push(id);
    if (aten !== 'espera' && aten !== 'cerrado') L.atencion.push(id);
    var clave = et + ' | pre: ' + (pre || '—') + ' | sel: ' + (sel || '—') + (et === 'Habilitado' ? ' | op: ' + (txt(f, cOp) || '—') : '') + ' | alertas: ' + (abiertas[id] || 0) + '/' + bl + ' | panel: ' + aten;
    cruce[clave] = (cruce[clave] || 0) + 1;
  }

  var huella = function (lista) {
    var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, lista.slice().sort().join(','), Utilities.Charset.UTF_8);
    return b.map(function (x) { return ((x + 256) % 256).toString(16); }).map(function (h) { return h.length < 2 ? '0' + h : h; }).join('').slice(0, 16);
  };
  var res = { filasConDatos: filasConDatos, cifras: {}, huellas: {}, listas: {} };
  Object.keys(L).forEach(function (k) { res.cifras[k] = L[k].length; if (k !== 'descartadas') res.huellas[k] = huella(L[k]); });
  ['descartadas', 'pruebas', 'etapa:Sin etapa', 'etapa:En verificación', 'etapa:Habilitado', 'etapa:Descartado', 'bloqueados', 'preseleccionadosConEntrevista', 'excluidosSeleccion'].forEach(function (k) { res.listas[k] = L[k]; });
  console.log('CONCILIACION ' + JSON.stringify(res));
  Object.keys(cruce).sort().forEach(function (k) { console.log('CRUCE ' + cruce[k] + ' × ' + k); });
}
