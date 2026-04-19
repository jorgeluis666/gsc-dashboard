// ── CSV PARSER ───────────────────────────────────────────
// Parses GSC comparison exports.
// Format: Label | DD/M/YY-DD/M/YY Clics | ... (8 cols)
// Odd-index cols (1,3,5,7) = period A | Even-index cols (2,4,6,8) = period B

var DATE_RE = /\d{1,2}\/\d{1,2}\/\d{2,4}/;

function parseCSV(raw) {
  var text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  var lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  var headers = lines[0].split(',').map(function(h){ return h.trim().replace(/^"|"$/g,''); });
  return lines.slice(1).filter(function(l){ return l.trim(); }).map(function(line){
    var cols=[],cur='',inQ=false;
    for(var i=0;i<line.length;i++){var c=line[i];if(c==='"'){inQ=!inQ;}else if(c===','&&!inQ){cols.push(cur.trim());cur='';}else cur+=c;}
    cols.push(cur.trim());
    var obj={};headers.forEach(function(h,i){obj[h]=(cols[i]||'').replace(/^"|"$/g,'');});return obj;
  });
}

function detectType(row) {
  var keys = Object.keys(row||{});
  var k0 = (keys[0]||'').toLowerCase();
  var allKeys = keys.map(function(k){ return k.toLowerCase(); }).join(' ');

  if(k0.includes('periodo')||k0.includes('período')||allKeys.includes('periodo')||allKeys.includes('período')) return 'grafico';
  if(k0.includes('consulta')||allKeys.includes('consulta')) return 'consultas';
  if(k0.includes('ginas')||k0.includes('página')||k0.includes('pagina')||k0==='páginas principales'||k0==='paginas principales'||allKeys.includes('ginas')) return 'paginas';
  if(k0.includes('dispositivo')||allKeys.includes('dispositivo')) return 'dispositivos';
  if(k0==='país'||k0==='pais'||k0.includes('país')||allKeys.includes('país')||allKeys.includes('pais')) return 'paises';

  // Fallback: detect by first VALUE in first data row
  var v0 = String(row[keys[0]]||'').toLowerCase();

  if(v0.startsWith('http')||v0.startsWith('https')||v0.includes('limaretail.com')||v0.startsWith('/')) return 'paginas';
  if(v0.match(/\d{4}-\d{2}-\d{2}/)) return 'grafico';
  if(v0.length > 2 && !v0.startsWith('http') && isNaN(v0)) return 'consultas';

  return 'unknown';
}

function isComparisonCSV(rows) {
  if (!rows || !rows.length) return false;
  var keys = Object.keys(rows[0]);
  return keys.length >= 5 && DATE_RE.test(keys[1] || '');
}

// Returns {a: "16/3/26 - 22/3/26", b: "23/3/26 - 29/3/26"}
function extractPeriodLabels(rows) {
  if (!rows || !rows.length) return {a:'Período A', b:'Período B'};
  var keys = Object.keys(rows[0]);
  function extractDate(str) {
    var m = str.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}\s*-\s*\d{1,2}\/\d{1,2}\/\d{2,4})/);
    return m ? m[1].trim() : str.split(' ')[0];
  }
  return {
    a: keys[1] ? extractDate(keys[1]) : 'Período A',
    b: keys[2] ? extractDate(keys[2]) : 'Período B'
  };
}

// Build a standard row from a comparison row for one period (a=odd cols, b=even cols)
function extractPeriodRow(row, type, period) {
  var keys = Object.keys(row);
  var label = row[keys[0]];
  var labelKey = type === 'paginas'      ? 'Páginas principales'  :
                 type === 'consultas'    ? 'Consultas principales' :
                 type === 'dispositivos' ? 'Dispositivo'           :
                 type === 'paises'       ? 'País'                  : keys[0];

  if (!isComparisonCSV([row])) {
    var out = {};
    out[labelKey] = label;
    keys.forEach(function(k){
      var kl = k.toLowerCase();
      if (kl === 'clics' || kl === 'clicks')            out['Clics']       = row[k];
      else if (kl === 'impresiones')                     out['Impresiones'] = row[k];
      else if (kl === 'ctr')                             out['CTR']         = row[k];
      else if (kl.includes('posici') || kl === 'pos')   out['Posición']    = row[k];
    });
    if (!out['Clics'] && keys.length >= 5) {
      out['Clics'] = row[keys[1]]; out['Impresiones'] = row[keys[2]];
      out['CTR']   = row[keys[3]]; out['Posición']    = row[keys[4]];
    }
    return out;
  }

  // Comparison CSV: odd indices = period A, even indices = period B
  // keys: [0]=label, [1]=A-Clics, [2]=B-Clics, [3]=A-Impr, [4]=B-Impr,
  //       [5]=A-CTR, [6]=B-CTR, [7]=A-Pos, [8]=B-Pos
  var offset = (period === 'a') ? 0 : 1;
  var out = {};
  out[labelKey]      = label;
  out['Clics']       = row[keys[1 + offset]] || '0';
  out['Impresiones'] = row[keys[3 + offset]] || '0';
  out['CTR']         = row[keys[5 + offset]] || '0%';
  out['Posición']    = row[keys[7 + offset]] || '0';
  return out;
}

function normalizeRow(row, type)     { return extractPeriodRow(row, type, 'a'); }
function normalizePrevRow(row, type) { return extractPeriodRow(row, type, 'b'); }

// Split a comparison dataset into {current(A), prev(B), labels}
function splitComparisonData(data) {
  var cur = {}, prv = {}, labels = {a:'Período actual', b:'Período anterior'};
  Object.keys(data).forEach(function(type) {
    var rows = data[type];
    if (!rows.length) return;
    if (isComparisonCSV(rows)) {
      var l = extractPeriodLabels(rows);
      labels.a = l.a; labels.b = l.b;
      cur[type] = rows.map(function(r){ return extractPeriodRow(r, type, 'a'); });
      prv[type] = rows.map(function(r){ return extractPeriodRow(r, type, 'b'); });
    } else {
      cur[type] = rows.map(function(r){ return extractPeriodRow(r, type, 'a'); });
    }
  });
  return { current: cur, prev: prv, labels: labels };
}
