/**
 * ApiPanelWeb.gs — API de LECTURA del CMC para el panel de micompaz.com (fase 2A).
 *
 * NO ESTÁ INSTALADO. Este archivo vive en el repositorio (público): no contiene datos, tokens ni direcciones.
 * Para instalarlo (requiere autorización de Luis, ver docs/cmc/api-panel.md):
 *   1. Pegar este archivo como «ApiPanelWeb.gs» en el proyecto de Apps Script del CMC.
 *   2. Propiedades del script: CMC_API_TOKEN (≥ 48 caracteres aleatorios, distinto de CMC_ESCRITURA_TOKEN) y CMC_API_ACTIVA = si.
 *   3. Implementar → Nueva implementación → Aplicación web · Ejecutar como: yo · Acceso: cualquier usuario.
 *      Es una implementación NUEVA: la de la V2 sigue fijada en su versión y no cambia.
 *
 * Principios:
 *   · Solo lectura. Reutiliza los lectores de la V2 (v2_obtenerFichaRaw_, v2_obtenerTabRaw_) y la elegibilidad que calcula el CMC.
 *     No escribe en ninguna hoja (solo usa CacheService para el anti-repetición).
 *   · Cada petición va firmada (HMAC-SHA256 con CMC_API_TOKEN), con hora (±5 min) y un número de un solo uso (nonce).
 *   · Minimización: nunca devuelve teléfonos, correos, documentos, direcciones ni enlaces personales.
 *   · Interruptor: CMC_API_ACTIVA ≠ «si» → responde «inactiva» y no lee nada.
 *   · Los errores salen como códigos cortos; el detalle se queda en el registro privado del script.
 */

var CMC_API_VERSION_ = 1;
var CMC_API_VENTANA_SEG_ = 300;
var CMC_API_TOPE_MIN_ = 120;
/** Claves que nunca salen del CMC (se borran en cualquier nivel de la respuesta). */
var CMC_API_CLAVES_PRIVADAS_ = /tel[eé]fono|whats|email|e-mail|correo|c[eé]dula|documento|direcci[oó]n|enlace|link|url|ip$|^t$|^e$|^wa$/i;

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
  else if (p.op === 'ficha') {
    if (!/^COM-\d{4,6}$/.test(id)) return { ok: false, error: 'id_invalido' };
    datos = cmcApi_ficha_(id);
    if (!datos) return { ok: false, error: 'no_existe' };
  } else return { ok: false, error: 'operacion_no_permitida' };

  console.log('[cmcApi] ' + p.op + (id ? ' ' + id : '') + ' ' + (Date.now() - t0) + ' ms');
  return { ok: true, v: CMC_API_VERSION_, op: p.op, generado: new Date().toISOString(), ms: Date.now() - t0, datos: cmcApi_limpiar_(datos, 0) };
}

/** Lista mínima de la hoja 03 (sin contactos) + alertas abiertas por Compita (hoja 11). */
function cmcApi_lista_() {
  var ss = SpreadsheetApp.getActive();
  var h03 = ss.getSheetByName('03 · Compitas');
  var v = h03.getDataRange().getValues();
  var enc = v[0].map(function (x) { return String(x).trim(); });
  var col = function (n) { var i = enc.indexOf(n); if (i < 0) throw new Error('Falta la columna «' + n + '» en 03'); return i; };
  var opc = function (n) { return enc.indexOf(n); };
  var c = {
    id: col('ID Compita'), registro: opc('Fecha registro'), nombre: col('Nombre'), zona: opc('Ubicación declarada'),
    etapa: col('Etapa de selección'), operativo: opc('Estado operativo'), acepta: opc('Acepta nuevos servicios'),
    pre: opc('Estado preentrevista'), dupDe: opc('Duplicado de (ID)'), dup: opc('Clasificación duplicado')
  };
  var alertas = cmcApi_alertasAbiertas_(ss);
  var val = function (fila, i) { if (i < 0) return ''; var x = fila[i]; return x instanceof Date ? x.toISOString() : String(x == null ? '' : x).trim(); };
  var filas = [];
  for (var r = 1; r < v.length; r++) {
    var id = val(v[r], c.id);
    if (!id) continue;
    var a = alertas[id] || { abiertas: 0, bloquean: 0 };
    filas.push({
      id: id, nombre: val(v[r], c.nombre), zona: val(v[r], c.zona), registro: val(v[r], c.registro),
      etapa: val(v[r], c.etapa), estadoOperativo: val(v[r], c.operativo), aceptaNuevos: val(v[r], c.acepta),
      preentrevista: val(v[r], c.pre), duplicadoDe: val(v[r], c.dupDe), clasificacionDuplicado: val(v[r], c.dup),
      alertasAbiertas: a.abiertas, alertasBloquean: a.bloquean
    });
  }
  return { filas: filas, filasLeidas: v.length - 1 };
}

function cmcApi_alertasAbiertas_(ss) {
  var h = ss.getSheetByName('11 · Alertas Compitas');
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

/** Ficha completa: lo mismo que ve la V2 (ficha + elegibilidad + alertas + onboarding + disponibilidad + cobertura) y sus pestañas. */
function cmcApi_ficha_(id) {
  var base = v2_obtenerFichaRaw_(id);
  if (!base || base.ok === false) return null;
  var pestanas = {};
  ['preentrevista', 'entrevista', 'verificaciones', 'historial'].forEach(function (t) {
    try { pestanas[t] = v2_obtenerTabRaw_(id, t); } catch (x) { pestanas[t] = { ok: false, error: 'no_disponible' }; }
  });
  return { ficha: base, pestanas: pestanas };
}

/** Quita claves privadas y valores muy largos en cualquier nivel. */
function cmcApi_limpiar_(x, nivel) {
  if (nivel > 8 || x == null) return x;
  if (x instanceof Date) return x.toISOString();
  if (Array.isArray(x)) return x.slice(0, 2000).map(function (y) { return cmcApi_limpiar_(y, nivel + 1); });
  if (typeof x === 'object') {
    var o = {};
    Object.keys(x).forEach(function (k) { if (!CMC_API_CLAVES_PRIVADAS_.test(k)) o[k] = cmcApi_limpiar_(x[k], nivel + 1); });
    return o;
  }
  if (typeof x === 'string' && x.length > 2000) return x.slice(0, 2000) + '…';
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
