/**
 * ApiPanel.gs — API de LECTURA del CMC para el panel de micompaz.com (fase 2A).
 *
 * Vive en un proyecto de Apps Script INDEPENDIENTE («CMC · API de lectura del panel»), no en el proyecto del CMC:
 *   · El proyecto del CMC tiene un doGet que sirve la V2 y más de cien funciones públicas (también de escritura).
 *     Una implementación anónima que se ejecuta como el propietario no puede contener ese código.
 *   · Este proyecto solo tiene: ApiPanel.gs (este archivo, sin doGet), HojaSoloLectura.gs (la hoja vista con la API de
 *     Sheets, sin ningún método de escritura) y ReglasCMC.gs (copia literal de las funciones de LECTURA del CMC que
 *     calculan los requisitos y leen las pestañas).
 *   · appsscript.json declara SOLO el permiso https://www.googleapis.com/auth/spreadsheets.readonly: aunque el código
 *     intentara escribir en la hoja, Google lo rechazaría.
 *
 * Este archivo está en el repositorio público: no contiene datos, tokens ni direcciones.
 *
 * Seguridad de cada petición (POST, cuerpo JSON en texto):
 *   1. Interruptor CMC_API_ACTIVA = «si» (si no, responde «inactiva» sin leer nada).
 *   2. CMC_API_TOKEN de 48 o más caracteres; firma HMAC-SHA256 de «v.op.id.ts.nonce», comparada en tiempo constante.
 *   3. Hora dentro de ±5 minutos; nonce de un solo uso (CacheService); tope de 120 peticiones por minuto.
 *   4. Solo operaciones de lectura: ping, lista, ficha, version.
 *   5. Antes de responder: se quitan claves de contacto, preguntas con datos personales (referencias, dónde vive)
 *      y se tachan correos, teléfonos, cédulas y enlaces que aparezcan dentro de cualquier texto.
 * Los errores salen como códigos cortos; el detalle se queda en el registro privado del proyecto.
 */

var CMC_API_VERSION_ = 1;
var CMC_API_VENTANA_SEG_ = 300;
var CMC_API_TOPE_MIN_ = 120;
/** Claves que nunca salen (en cualquier nivel de la respuesta). */
var CMC_API_CLAVES_PRIVADAS_ = /tel[eé]fono|whats|email|e-mail|correo|c[eé]dula|documento|direcci[oó]n|enlace|link|url|ip$|^t$|^e$|^wa$/i;
/** Preguntas o campos que se omiten aunque su clave sea genérica («campo», «pregunta»). */
var CMC_API_ETIQUETAS_PRIVADAS_ = /referencia|zona (o sector )?espec[ií]fic[oa]|sector espec[ií]fico|d[oó]nde vives|en qu[eé] zona.*vives|whatsapp|tel[eé]fono|correo|e-?mail|c[eé]dula|documento|direcci[oó]n|evidencia|enlace|link/i;
/** Columnas de la hoja 03 que pueden salir (lista blanca). */
var CMC_API_COLUMNAS_03_ = ['ID Compita', 'Fecha registro', 'Nombre', 'Ubicación declarada', 'Profesión / Perfil', 'Estado preentrevista',
  'Fecha respuesta preentrevista', 'Estado selección', 'Entrevistador', 'Último contacto', 'Estado operativo', 'Acepta nuevos servicios',
  'Motivo estado operativo', 'Etapa de selección', 'Duplicado de (ID)', 'Clasificación duplicado'];

/* ── La hoja: siempre la del CMC, SOLO PARA LEER (HojaSoloLectura.gs, con la API de Sheets y el permiso de solo lectura) ── */
function cmcApi_libro_() { return CMC_SL_LIBRO_; }
// Las funciones copiadas del CMC piden la hoja con SpreadsheetApp.getActive(), getActiveSpreadsheet() u openById(V2_SS_ID).
// Las tres devuelven aquí el libro de solo lectura (el propio CMC reasigna getActive del mismo modo en su capa de caché).
// openById con cualquier otro ID falla: este proyecto no lee otras hojas.
SpreadsheetApp.getActive = cmcApi_libro_;
SpreadsheetApp.getActiveSpreadsheet = cmcApi_libro_;
SpreadsheetApp.openById = function (id) { if (id !== V2_SS_ID) throw new Error('solo_hoja_cmc'); return CMC_SL_LIBRO_; };

/* ── Punto de entrada único. No hay doGet: abrir la URL en un navegador no muestra nada. ── */
function doPost(e) {
  var r;
  try {
    r = cmcApi_atender_(e);
  } catch (err) {
    console.error('[cmcApi] error', String((err && err.stack) || err));
    r = { ok: false, error: 'error_interno' };
  }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

function cmcApi_atender_(e) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('CMC_API_ACTIVA') !== 'si') return { ok: false, error: 'inactiva' };
  var token = props.getProperty('CMC_API_TOKEN') || '';
  if (token.length < 48) return { ok: false, error: 'sin_configurar' };

  var cuerpo = (e && e.postData && e.postData.contents) || '';
  if (cuerpo.length > 4000) return { ok: false, error: 'peticion_invalida' };
  var p;
  try { p = JSON.parse(cuerpo); } catch (x) { return { ok: false, error: 'peticion_invalida' }; }
  if (!p || p.v !== CMC_API_VERSION_ || typeof p.op !== 'string' || typeof p.nonce !== 'string' || typeof p.firma !== 'string') return { ok: false, error: 'peticion_invalida' };
  var id = typeof p.id === 'string' ? p.id : '';
  var ts = Number(p.ts);
  if (!isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > CMC_API_VENTANA_SEG_) return { ok: false, error: 'fuera_de_tiempo' };
  if (!/^[A-Za-z0-9-]{16,64}$/.test(p.nonce)) return { ok: false, error: 'peticion_invalida' };

  var mensaje = [p.v, p.op, id, ts, p.nonce].join('.');
  var esperada = cmcApi_hex_(Utilities.computeHmacSha256Signature(mensaje, token));
  if (!cmcApi_igual_(esperada, String(p.firma))) return { ok: false, error: 'firma_invalida' };

  var cache = CacheService.getScriptCache();
  var claveNonce = 'cmcapi_n_' + p.nonce;
  if (cache.get(claveNonce)) return { ok: false, error: 'repetida' };
  cache.put(claveNonce, '1', CMC_API_VENTANA_SEG_ * 2);
  var claveMin = 'cmcapi_m_' + Math.floor(Date.now() / 60000);
  var usadas = Number(cache.get(claveMin) || 0) + 1;
  cache.put(claveMin, String(usadas), 120);
  if (usadas > CMC_API_TOPE_MIN_) return { ok: false, error: 'limite' };

  var t0 = Date.now();
  var datos;
  if (p.op === 'ping') datos = { listo: true };
  else if (p.op === 'lista') datos = cmcApi_lista_();
  else if (p.op === 'version') datos = cmcApi_version_();
  else if (p.op === 'ficha') {
    if (!/^COM-\d{4,6}$/.test(id)) return { ok: false, error: 'id_invalido' };
    datos = cmcApi_ficha_(id);
    if (!datos) return { ok: false, error: 'no_existe' };
  } else return { ok: false, error: 'operacion_no_permitida' };

  console.log('[cmcApi] ' + p.op + (id ? ' ' + id : '') + ' ' + (Date.now() - t0) + ' ms');
  return { ok: true, v: CMC_API_VERSION_, op: p.op, generado: new Date().toISOString(), ms: Date.now() - t0, datos: cmcApi_limpiar_(datos, 0) };
}

/* ── Lista: hoja 03 (lista blanca de columnas) + alertas abiertas por Compita (hoja 11) ── */
function cmcApi_leer03_() {
  var v = cmcApi_libro_().getSheetByName('03 · Compitas').getDataRange().getValues();
  var enc = v[0].map(function (x) { return String(x).trim(); });
  var col = function (n) { var i = enc.indexOf(n); if (i < 0) throw new Error('Falta la columna «' + n + '» en 03'); return i; };
  ['ID Compita', 'Nombre', 'Etapa de selección'].forEach(col);
  return { v: v, enc: enc };
}
function cmcApi_valor_(x) { return x instanceof Date ? x.toISOString() : String(x == null ? '' : x).trim(); }

function cmcApi_lista_() {
  var t = cmcApi_leer03_(), v = t.v, enc = t.enc;
  var c = function (n) { return enc.indexOf(n); };
  var alertas = cmcApi_alertasAbiertas_();
  var val = function (fila, i) { return i < 0 ? '' : cmcApi_valor_(fila[i]); };
  var filas = [];
  for (var r = 1; r < v.length; r++) {
    var id = val(v[r], c('ID Compita'));
    if (!id) continue;
    var a = alertas[id] || { abiertas: 0, bloquean: 0 };
    filas.push({
      id: id, nombre: val(v[r], c('Nombre')), zona: val(v[r], c('Ubicación declarada')), registro: val(v[r], c('Fecha registro')),
      etapa: val(v[r], c('Etapa de selección')), estadoOperativo: val(v[r], c('Estado operativo')), aceptaNuevos: val(v[r], c('Acepta nuevos servicios')),
      preentrevista: val(v[r], c('Estado preentrevista')), duplicadoDe: val(v[r], c('Duplicado de (ID)')), clasificacionDuplicado: val(v[r], c('Clasificación duplicado')),
      alertasAbiertas: a.abiertas, alertasBloquean: a.bloquean
    });
  }
  return { filas: filas, filasLeidas: v.length - 1 };
}

function cmcApi_alertasAbiertas_() {
  var h = cmcApi_libro_().getSheetByName('11 · Alertas Compitas');
  var out = {};
  if (!h || h.getLastRow() < 2) return out;
  var v = h.getDataRange().getValues();
  var enc = v[0].map(function (x) { return String(x).trim(); });
  var cId = enc.indexOf('ID Compita'), cEst = enc.indexOf('Estado'), cBl = enc.indexOf('Bloquea matching');
  if (cId < 0 || cEst < 0) return out;
  for (var r = 1; r < v.length; r++) {
    var id = String(v[r][cId] || '').trim();
    var est = String(v[r][cEst] || '').trim().toLowerCase();
    if (!id || /cerrad|resuel|anulad/.test(est)) continue;
    var o = out[id] || (out[id] = { abiertas: 0, bloquean: 0 });
    o.abiertas++;
    if (cBl >= 0 && /^s[ií]/i.test(String(v[r][cBl] || ''))) o.bloquean++;
  }
  return out;
}

/* ── Ficha: hoja 03 (lista blanca) + requisitos, alertas, onboarding y pestañas con las funciones copiadas del CMC ── */
function cmcApi_ficha_(id) {
  var t = cmcApi_leer03_(), v = t.v, enc = t.enc, cId = enc.indexOf('ID Compita'), fila = null;
  for (var r = 1; r < v.length; r++) if (String(v[r][cId] || '').trim() === id) { fila = v[r]; break; }
  if (!fila) return null;
  var ficha = {};
  CMC_API_COLUMNAS_03_.forEach(function (n) { var i = enc.indexOf(n); if (i >= 0) ficha[n] = cmcApi_valor_(fila[i]); });
  var seguro = function (fn) { try { return fn(); } catch (x) { console.error('[cmcApi] ficha ' + id, String(x)); return { ok: false, error: 'no_disponible' }; } };
  var pestanas = {};
  ['preentrevista', 'entrevista', 'verificaciones', 'historial'].forEach(function (tab) { pestanas[tab] = seguro(function () { return v2_obtenerTabRaw_(id, tab); }); });
  return {
    ficha: {
      ficha: ficha,
      ops: { estadoOperativo: ficha['Estado operativo'] || '', aceptaNuevos: ficha['Acepta nuevos servicios'] || '', motivo: ficha['Motivo estado operativo'] || '' },
      elegibilidad: seguro(function () { return panel_obtenerPanelElegibilidad_core_(id); }),
      alertas: seguro(function () { return panel_obtenerAlertas(id); }),
      onboarding: seguro(function () { return panel_obtenerOnboarding(id); })
    },
    pestanas: pestanas
  };
}

/* ── Versión de las reglas copiadas: huella de cada función, para compararla con el proyecto original ── */
var CMC_API_FUNCIONES_COPIADAS_ = ['panel_obtenerPanelElegibilidad_core_', 'panel_evaluarHabilitacion_', 'panel_calcularElegibilidad_', 'panel_obtenerElegibilidad',
  'panel_obtenerEtapaSeleccion_', 'entrevista_masReciente_', 'panel_obtenerAlertas', 'panel_obtenerVerificaciones', 'panel_obtenerOnboarding', 'panel_leerFull03_',
  'v2_obtenerTabRaw_', 'v2_obtenerPreentrevista', 'obtenerEvaluacionCompita', 'v2_timeline_', 'panel_obtenerEventos'];
function cmcApi_version_() {
  var huellas = {};
  CMC_API_FUNCIONES_COPIADAS_.forEach(function (n) {
    var f = globalThis[n];
    huellas[n] = typeof f === 'function' ? cmcApi_hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, f.toString(), Utilities.Charset.UTF_8)).slice(0, 16) : 'falta';
  });
  return { api: CMC_API_VERSION_, reglas: huellas };
}

/* ── Minimización antes de responder ── */
function cmcApi_tachar_(s) {
  return s
    .replace(/https?:\/\/\S+/gi, '[enlace]')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[correo]')
    .replace(/(\+\d{1,3}[\s.-]?)?\(?\b0?4\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, '[teléfono]')
    .replace(/\+\d[\d\s().-]{8,}\d/g, '[teléfono]')
    .replace(/\b[VEJvej][\s.-]?\d{1,2}\.?\d{3}\.?\d{3}\b/g, '[documento]');
}
function cmcApi_limpiar_(x, nivel) {
  if (nivel > 8 || x == null) return x;
  if (x instanceof Date) return x.toISOString();
  if (Array.isArray(x)) {
    return x.slice(0, 2000).filter(function (y) {
      if (!y || typeof y !== 'object') return true;
      var etiqueta = String(y.campo || y.pregunta || y.label || y.etiqueta || '');
      return !CMC_API_ETIQUETAS_PRIVADAS_.test(etiqueta);
    }).map(function (y) { return cmcApi_limpiar_(y, nivel + 1); });
  }
  if (typeof x === 'object') {
    var o = {};
    Object.keys(x).forEach(function (k) {
      if (CMC_API_CLAVES_PRIVADAS_.test(k) || CMC_API_ETIQUETAS_PRIVADAS_.test(k)) return;
      o[k] = cmcApi_limpiar_(x[k], nivel + 1);
    });
    return o;
  }
  if (typeof x === 'string') { var s = cmcApi_tachar_(x); return s.length > 2000 ? s.slice(0, 2000) + '…' : s; }
  return x;
}

function cmcApi_hex_(bytes) {
  return bytes.map(function (b) { var h = (b < 0 ? b + 256 : b).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}
function cmcApi_igual_(a, b) {
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
