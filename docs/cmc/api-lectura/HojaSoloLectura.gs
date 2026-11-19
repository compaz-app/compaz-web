/**
 * HojaSoloLectura.gs — la hoja del CMC vista SOLO PARA LEER.
 *
 * SpreadsheetApp.openById exige el permiso completo de hojas de cálculo (lectura y escritura). Este proyecto no lo tiene:
 * solo tiene https://www.googleapis.com/auth/spreadsheets.readonly. Por eso la hoja se lee con la API de Sheets (servicio
 * avanzado «Sheets», que acepta ese permiso) y se entrega a las funciones copiadas del CMC un objeto con la MISMA forma
 * que SpreadsheetApp para las llamadas que usan (getSheetByName, getRange…getValues/getValue, getDataRange, getLastRow,
 * getLastColumn, getName, createTextFinder…findNext/getRow) y NINGÚN método de escritura: no existen setValue, appendRow…
 *
 * Fidelidad con getValues(): celdas vacías = '', números y booleanos tal cual, fechas como objetos Date (en la zona horaria
 * de la hoja), texto tal cual. Se lee cada pestaña una sola vez por petición (memoria de la ejecución).
 */

var CMC_SL_MEMO_ = {};
var CMC_SL_TZ_ = null;

function cmcSl_zona_() {
  if (!CMC_SL_TZ_) CMC_SL_TZ_ = Sheets.Spreadsheets.get(V2_SS_ID, { fields: 'properties.timeZone' }).properties.timeZone;
  return CMC_SL_TZ_;
}

/** Número de serie de Sheets (días desde 1899-12-30, hora local de la hoja) → Date. */
function cmcSl_fecha_(serie) {
  var localComoUtc = Math.round((serie - 25569) * 86400000);
  var z = Utilities.formatDate(new Date(localComoUtc), cmcSl_zona_(), 'Z'); // p. ej. -0400
  var signo = z.charAt(0) === '-' ? -1 : 1;
  var minutos = signo * (Number(z.substr(1, 2)) * 60 + Number(z.substr(3, 2)));
  return new Date(localComoUtc - minutos * 60000);
}

var CMC_SL_PARECE_FECHA_ = /^\s*(\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}|\d{1,2}:\d{2})/;

/** Valores de una pestaña como los daría getDataRange().getValues(); null si la pestaña no existe. */
function cmcSl_valores_(nombre) {
  if (Object.prototype.hasOwnProperty.call(CMC_SL_MEMO_, nombre)) return CMC_SL_MEMO_[nombre];
  var rango = "'" + String(nombre).replace(/'/g, "''") + "'";
  var crudo, texto;
  try {
    crudo = Sheets.Spreadsheets.Values.get(V2_SS_ID, rango, { valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER' }).values || [];
    texto = Sheets.Spreadsheets.Values.get(V2_SS_ID, rango, { valueRenderOption: 'FORMATTED_VALUE' }).values || [];
  } catch (e) {
    if (/Unable to parse range|no se puede analizar/i.test(String(e))) { CMC_SL_MEMO_[nombre] = null; return null; }
    throw e;
  }
  var ancho = 0;
  crudo.forEach(function (f) { if (f.length > ancho) ancho = f.length; });
  var v = crudo.map(function (fila, i) {
    var out = [];
    for (var j = 0; j < ancho; j++) {
      var x = j < fila.length ? fila[j] : '';
      if (x === null || x === undefined) x = '';
      if (typeof x === 'number') {
        var t = texto[i] && texto[i][j];
        if (typeof t === 'string' && CMC_SL_PARECE_FECHA_.test(t)) x = cmcSl_fecha_(x);
      }
      out.push(x);
    }
    return out;
  });
  CMC_SL_MEMO_[nombre] = v;
  return v;
}

function cmcSl_rango_(v, fila, col, nf, nc) {
  nf = nf || 1; nc = nc || 1;
  var filas = [];
  for (var i = 0; i < nf; i++) {
    var src = v[fila - 1 + i] || [];
    var r = [];
    for (var j = 0; j < nc; j++) { var x = src[col - 1 + j]; r.push(x === undefined ? '' : x); }
    filas.push(r);
  }
  return {
    getValues: function () { return filas.map(function (r) { return r.slice(); }); },
    getValue: function () { return filas[0][0]; },
    getRow: function () { return fila; },
    getColumn: function () { return col; },
    getNumRows: function () { return nf; },
    getNumColumns: function () { return nc; }
  };
}

function cmcSl_hoja_(nombre) {
  var v = cmcSl_valores_(nombre);
  if (!v) return null;
  var ultimaFila = v.length, ultimaCol = v.reduce(function (m, f) { return Math.max(m, f.length); }, 0);
  return {
    getName: function () { return nombre; },
    getLastRow: function () { return ultimaFila; },
    getLastColumn: function () { return ultimaCol; },
    getMaxRows: function () { return ultimaFila; },
    getMaxColumns: function () { return ultimaCol; },
    getDataRange: function () { return cmcSl_rango_(v, 1, 1, Math.max(ultimaFila, 1), Math.max(ultimaCol, 1)); },
    getRange: function (fila, col, nf, nc) {
      if (typeof fila !== 'number') throw new Error('solo_lectura: getRange con notación A1 no está soportado');
      return cmcSl_rango_(v, fila, col, nf, nc);
    },
    createTextFinder: function (texto) {
      var exacta = false;
      var buscador = {
        matchEntireCell: function (b) { exacta = !!b; return buscador; },
        matchCase: function () { return buscador; },
        findNext: function () {
          var objetivo = String(texto);
          for (var i = 0; i < v.length; i++) for (var j = 0; j < v[i].length; j++) {
            var c = v[i][j] instanceof Date ? '' : String(v[i][j]);
            if (exacta ? c === objetivo : c.indexOf(objetivo) >= 0) return cmcSl_rango_(v, i + 1, j + 1, 1, 1);
          }
          return null;
        }
      };
      return buscador;
    }
  };
}

/** El «libro»: solo sabe devolver pestañas para leer. */
var CMC_SL_LIBRO_ = {
  getSheetByName: function (n) { return cmcSl_hoja_(n); },
  getId: function () { return V2_SS_ID; },
  getSpreadsheetTimeZone: function () { return cmcSl_zona_(); }
};
