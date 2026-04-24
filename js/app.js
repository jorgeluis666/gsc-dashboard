// ── STATE ────────────────────────────────────────────────
var S = {
  snapshots: [],
  trackedURLs: [],
  curIdx: null,
  tab: 'overview',
  qFilter: '',
  // drive
  clientId: '976153544066-8l99fptg5oo4m7tssi9pnadav5nicf5m.apps.googleusercontent.com',
  folderId: '',
  folderName: '',
  accessToken: null,
  driveStatus: 'disconnected', // disconnected | connected | loading
  driveMsg: '',
  // gsc
  gscStatus: 'disconnected',  // disconnected | loading | connected
  gscSiteUrl: '',
  gscSites: [],
  gscWeeks: 8,
  gscImporting: false,
  gscPendingConnect: false,
  // pending manual upload
  pending: null,
  pendingLabel: '',
  // direct api data (not persisted)
  gscData: null,
  gscCompareData: null,
  gscLoading: false,
  overviewFocusData: null,
  // ui
  refreshing: false,
  overviewSection: 'top',  // top | gained | lost
  overviewFocusUrl: null,  // URL whose trend is shown in the chart, or null = site total
  overviewRange: '3m',     // 7d | 28d | 3m | 6m | 12m | 16m | custom
  overviewDateFrom: '',    // YYYY-MM-DD for custom range
  overviewDateTo: '',
  compareEnabled: false,
  compareRange: 'previous', // previous | year | custom
  compareDateFrom: '',
  compareDateTo: '',
  // modal temp state (not persisted)
  showDateModal: false,
  modalTab: 'filtrar',      // filtrar | comparar
  pendingRange: '3m',
  pendingDateFrom: '',
  pendingDateTo: '',
  pendingCompareRange: 'previous',
  pendingCompareDateFrom: '',
  pendingCompareDateTo: ''
};

// ── PERSIST ──────────────────────────────────────────────
function loadState() {
  try {
    var v = localStorage.getItem('gsc_v2');
    if (v) {
      var d = JSON.parse(v);
      S.snapshots   = d.snapshots   || [];
      S.trackedURLs = d.trackedURLs || [];
      // Client ID is hardcoded — never override it from localStorage
      S.folderId    = d.folderId    || '';
      S.folderName  = d.folderName  || '';
      S.gscSiteUrl  = d.gscSiteUrl  || '';
      S.gscWeeks    = d.gscWeeks    || 8;
      S.overviewRange   = d.overviewRange   || '3m';
      S.overviewDateFrom  = d.overviewDateFrom  || '';
      S.overviewDateTo    = d.overviewDateTo    || '';
      S.compareEnabled    = d.compareEnabled    || false;
      S.compareRange      = d.compareRange      || 'previous';
      S.compareDateFrom   = d.compareDateFrom   || '';
      S.compareDateTo     = d.compareDateTo     || '';
      if (S.snapshots.length) S.curIdx = S.snapshots.length - 1;
    }
  } catch(e) {}
}

function saveState() {
  try {
    localStorage.setItem('gsc_v2', JSON.stringify({
      snapshots:   S.snapshots,
      trackedURLs: S.trackedURLs,
      clientId:    S.clientId,
      folderId:    S.folderId,
      folderName:  S.folderName,
      gscSiteUrl:  S.gscSiteUrl,
      gscWeeks:    S.gscWeeks,
      overviewRange:    S.overviewRange,
      overviewDateFrom: S.overviewDateFrom,
      overviewDateTo:   S.overviewDateTo,
      compareEnabled:   S.compareEnabled,
      compareRange:     S.compareRange,
      compareDateFrom:  S.compareDateFrom,
      compareDateTo:    S.compareDateTo
    }));
  } catch(e) {}
}

// ── TOAST ────────────────────────────────────────────────
function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 3000);
}

// ── CONSTANTS ────────────────────────────────────────────
var PAID = ["meta ads","facebook ads","google ads","tiktok ads","tik tok ads","agencia meta","agencia google","agencia facebook","agencia tiktok","publicidad en google","publicidad en facebook","publicidad en tiktok","servicio de google ads","consultoría google ads","consultoria google ads","agencia de publicidad","campañas google","campañas meta","campañas facebook","campañas tiktok","agencia ads"];
var SVCS = ["/agencia-facebook-ads","/agencia-google-ads","/agencia-tik-tok-ads","/agencia-meta-ads","/asesoria-marketing-digital","/campanas-publicitarias-digitales","/agencia-seo","/facebook/meta","/facebook/facebook-ads"];
var RANGE_WEEKS  = { '7d':1, '28d':4, '3m':13, '6m':26, '12m':52, '16m':70 };
var RANGE_LABELS = { '7d':'Últimos 7 días', '28d':'Últimos 28 días', '3m':'Últimos 3 meses', '6m':'Últimos 6 meses', '12m':'Últimos 12 meses', '16m':'Últimos 16 meses', 'custom':'Personalizado' };

// ── HELPERS ──────────────────────────────────────────────
function pN(v){return parseFloat(String(v||'0').replace(/[%\s]/g,'').replace(',','.'))||0;}
function pP(v){return parseFloat(String(v||'0').replace(',','.'))||0;}
function isPaid(q){var ql=(q||'').toLowerCase();return PAID.some(function(p){return ql.includes(p);});}
function isSvc(url){var ul=(url||'').toLowerCase();return SVCS.some(function(s){return ul.includes(s);});}
function isBlogArticle(url){
  if(isSvc(url)) return false;
  var path=(url||'').replace(/^https?:\/\/[^/]+/,'').replace(/\/$/,'');
  var parts=path.split('/').filter(function(p){return p.length>0;});
  return parts.length>=2;
}
function shortURL(u){return(u||'').replace('https://limaretail.com','').split('#')[0]||'/';}
function fmtK(v){return v>=1000?(v/1000).toFixed(1)+'k':Math.round(v)+'';}
function calcM(snap){
  if(!snap||!snap.data)return null;
  var g=snap.data.grafico||[];
  if(!g.length)return null;
  var tc=g.reduce(function(s,r){return s+pN(r.Clics);},0);
  var ti=g.reduce(function(s,r){return s+pN(r.Impresiones);},0);
  var posRows=g.filter(function(r){return pP(r['Posición'])>0;});
  var avgPos=posRows.length?posRows.reduce(function(s,r){return s+pP(r['Posición']);},0)/posRows.length:0;
  return{clics:tc,impr:ti,ctr:ti>0?(tc/ti*100):0,pos:avgPos};
}

function calcMRange(snaps) {
  if (!snaps || !snaps.length) return null;
  var tc = 0, ti = 0, posSum = 0, posCnt = 0;
  snaps.forEach(function(snap) {
    var g = snap && snap.data ? snap.data.grafico || [] : [];
    g.forEach(function(r) {
      tc += pN(r.Clics); ti += pN(r.Impresiones);
      var pos = pP(r['Posición']); if (pos > 0) { posSum += pos; posCnt++; }
    });
  });
  if (!tc && !ti) return null;
  return { clics: tc, impr: ti, ctr: ti > 0 ? (tc/ti*100) : 0, pos: posCnt ? posSum/posCnt : 0 };
}

function aggregateByWeek(rows) {
  if (!rows || !rows.length) return [];
  var buckets = {};
  rows.forEach(function(r) {
    var fecha = r['Fecha'] || '';
    if (!fecha) return;
    var wk = typeof isoWeekLabel === 'function' ? isoWeekLabel(fecha) : fecha.slice(0, 7);
    if (!buckets[wk]) buckets[wk] = { label: wk, clics: 0, impr: 0, posSum: 0, cnt: 0 };
    buckets[wk].clics += pN(r.Clics);
    buckets[wk].impr  += pN(r.Impresiones);
    var pos = pP(r['Posición']);
    if (pos > 0) { buckets[wk].posSum += pos; buckets[wk].cnt++; }
  });
  return Object.keys(buckets).sort().map(function(wk) {
    var b = buckets[wk];
    return { label: wk, clics: b.clics, impr: b.impr, pos: b.cnt ? b.posSum / b.cnt : 0 };
  });
}
function posClass(p){return p<=10?'green':p<=20?'amber':'red';}
function posLbl(p){return p<=10?'Pág. 1':p<=20?'Pág. 2':'Pág. '+Math.ceil(p/10);}
function posColor(p){return p<=10?'up':p<=20?'am':'dn';}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function deltaHTML(pos,pp){
  if(pp===null)return'<span class="gray">—</span>';
  var d=pos-pp;if(Math.abs(d)<0.05)return'<span class="gray">=</span>';
  return d<0?'<span class="up">↑'+Math.abs(d).toFixed(1)+'</span>':'<span class="dn">↓'+d.toFixed(1)+'</span>';
}

// ── TRACKING ─────────────────────────────────────────────
function addTrackedURL(url, label) {
  if (!url) return;
  url = url.trim().replace(/\s+/g,'');
  if (!url.startsWith('http')) url = 'https://limaretail.com' + url;
  var exists = S.trackedURLs.find(function(t){ return t.url === url; });
  if (exists) { toast('Esa URL ya está en seguimiento'); return; }
  S.trackedURLs.push({ url:url, label:label||url, dateAdded:new Date().toISOString(), notes:[] });
  saveState(); render();
  toast('✓ URL agregada al seguimiento');
}

function optimizarPagina(url) {
  var exists = S.trackedURLs.some(function(t){ return t.url === url; });
  if (!exists) {
    var slug = url.replace('https://limaretail.com','') || url;
    S.trackedURLs.push({ url:url, label:slug, dateAdded:new Date().toISOString().slice(0,10), notes:[] });
    saveState();
  }
  S.tab = 'seguimiento';
  render();
  toast(exists ? 'URL ya en Seguimiento — revisa y optimiza' : '✓ URL agregada a Seguimiento para optimización');
}

function promoverPagina(url) {
  toast('✓ Artículo en crecimiento — compártelo en redes o inclúyelo en el newsletter');
}

function removeTrackedURL(idx) {
  if (!confirm('¿Quitar esta URL del seguimiento?')) return;
  S.trackedURLs.splice(idx,1);
  saveState(); render();
}

function addNote(urlIdx, noteText, noteDate) {
  if (!noteText) return;
  S.trackedURLs[urlIdx].notes.push({ date: noteDate||new Date().toISOString().slice(0,10), text: noteText });
  saveState(); render();
}

// Cross all snapshots for a URL
function getURLHistory(url, snaps) {
  return (snaps || S.snapshots).map(function(snap) {
    var pages = snap.data.paginas || [];
    var row = pages.find(function(r){
      return (r['Páginas principales']||'').split('#')[0].replace(/\/$/,'') === url.split('#')[0].replace(/\/$/,'');
    });
    return {
      label: snap.label,
      date:  snap.date,
      clics: row ? pN(row.Clics) : null,
      impr:  row ? pN(row.Impresiones) : null,
      ctr:   row ? row.CTR : null,
      pos:   row ? pP(row['Posición']) : null,
      found: !!row
    };
  });
}

// ── MANUAL UPLOAD ────────────────────────────────────────
function processFiles(files) {
  var readers = Array.from(files).map(function(f){
    return new Promise(function(res){var r=new FileReader();r.onload=function(e){res(e.target.result);};r.readAsText(f,'utf-8');});
  });
  Promise.all(readers).then(function(texts){
    var data={};
    texts.forEach(function(text){var rows=parseCSV(text);if(!rows.length)return;var type=detectType(rows[0]);if(type!=='unknown')data[type]=rows;});
    if(Object.keys(data).length>0){
      var split = splitComparisonData(data);
      S.pendingCurrent = split.current;
      S.pendingPrev    = Object.keys(split.prev).length > 0 ? split.prev : null;
      S.pendingLabels  = split.labels;
      S.pending = split.current;
      S.pendingLabel     = split.labels.a || new Date().toLocaleDateString('es-PE',{month:'short',year:'numeric'});
      S.pendingLabelPrev = split.labels.b || '';
      render();
    } else toast('No se detectaron CSVs válidos');
  });
}

function confirmManual(){
  var lblInput    = document.getElementById('snap-label');
  var lblPrevInput= document.getElementById('snap-label-prev');
  var lbl     = (lblInput     && lblInput.value.trim())     || S.pendingLabel     || 'Sin etiqueta';
  var prevLbl = (lblPrevInput && lblPrevInput.value.trim()) || S.pendingLabelPrev || (lbl + ' (anterior)');

  var isComp = S.pendingPrev && Object.keys(S.pendingPrev).length > 0;

  if (isComp) {
    var prevExists = S.snapshots.find(function(s){ return s.label === prevLbl; });
    if (!prevExists) {
      S.snapshots.push({id: Date.now()-1, label: prevLbl, date: new Date().toISOString(), data: S.pendingPrev});
    }
  }

  S.snapshots.push({id: Date.now(), label: lbl, date: new Date().toISOString(), data: S.pendingCurrent || S.pending});
  S.snapshots.sort(function(a,b){ return a.label.localeCompare(b.label); });
  S.curIdx = S.snapshots.length - 1;
  S.pending = null; S.pendingCurrent = null; S.pendingPrev = null; S.pendingLabels = null;
  saveState(); render();
  toast(isComp ? '✓ 2 snapshots guardados: "'+prevLbl+'" y "'+lbl+'"' : '✓ Snapshot "'+lbl+'" guardado');
}

function deleteSnap(idx){
  if(!confirm('¿Eliminar el snapshot "'+S.snapshots[idx].label+'"?'))return;
  S.snapshots.splice(idx,1);
  S.curIdx=S.snapshots.length>0?S.snapshots.length-1:null;
  saveState();render();
}

// ── PARETO ───────────────────────────────────────────────
// Returns { top, rest, count, total } — rows already sorted descending by getValue
function paretoSplit(rows, getValue) {
  var total = rows.reduce(function(s, r) { return s + getValue(r); }, 0);
  if (!total || !rows.length) return { top: rows, rest: [], count: rows.length, total: 0 };
  var cum = 0, idx = rows.length;
  for (var i = 0; i < rows.length; i++) {
    cum += getValue(rows[i]);
    if (cum / total >= 0.8) { idx = i + 1; break; }
  }
  return { top: rows.slice(0, idx), rest: rows.slice(idx), count: idx, total: total };
}

function paretoBadge(count, totalRows) {
  return '<div style="display:inline-flex;align-items:center;gap:6px;background:#F0FDF4;border:1px solid #BBF7D0;'+
    'border-radius:8px;padding:4px 12px;font-size:11px;color:#059669;font-weight:600;margin-bottom:8px">'+
    '<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round">'+
    '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'+
    '<b>'+count+'</b> página'+(count===1?'':'s')+' = 80% del tráfico'+
    '<span style="font-weight:400;color:#6EE7B7">· '+totalRows+' total</span></div>';
}

function paretoSepRow(colspan, restCount) {
  return '<tr><td colspan="'+colspan+'" style="background:#F0FDF4;border-top:2px dashed #6EE7B7;'+
    'border-bottom:1px solid #D1FAE5;padding:3px 12px;font-size:9px;color:#059669;font-weight:700;'+
    'text-align:center;letter-spacing:.04em">'+
    '▲ 80% DEL TRÁFICO &nbsp;·&nbsp; ▼ '+restCount+' página'+(restCount===1?'':' restante')+(restCount===1?'':'s')+'</td></tr>';
}

// ── ANALYSIS ─────────────────────────────────────────────
function analyzeOpp(cur){
  var Q=(cur&&cur.data?cur.data.consultas:[])||[],P=(cur&&cur.data?cur.data.paginas:[])||[];
  return{
    quickwins: Q.filter(function(r){var p=pP(r['Posición']);return p>=11&&p<=20&&pN(r.Impresiones)>=30&&pN(r.Clics)===0;}).sort(function(a,b){return pN(b.Impresiones)-pN(a.Impresiones);}).slice(0,8),
    ctrGap:    Q.filter(function(r){return pP(r['Posición'])<=15&&pN(r.Impresiones)>=20&&pN(r.Clics)===0;}).sort(function(a,b){return pN(b.Impresiones)-pN(a.Impresiones);}).slice(0,8),
    paidGap:   P.filter(function(r){return isSvc(r['Páginas principales']||'')&&pP(r['Posición'])>20;}),
    paidZero:  Q.filter(function(r){return isPaid(r['Consultas principales']||'')&&pN(r.Clics)===0&&pN(r.Impresiones)>=30;}).sort(function(a,b){return pN(b.Impresiones)-pN(a.Impresiones);}).slice(0,8)
  };
}

function analyzeVar(cur,prev){
  var res=[];
  var cQ=(cur&&cur.data?cur.data.consultas:[])||[],pQ=(prev&&prev.data?prev.data.consultas:[])||[];
  var cP=(cur&&cur.data?cur.data.paginas:[])||[],pP2=(prev&&prev.data?prev.data.paginas:[])||[];
  cQ.forEach(function(cr){
    var q=cr['Consultas principales']||'';
    var pr=pQ.find(function(r){return(r['Consultas principales']||'').toLowerCase()===q.toLowerCase();});
    if(!pr)return;
    var dPos=pP(cr['Posición'])-pP(pr['Posición']),dC=pN(cr.Clics)-pN(pr.Clics);
    if(Math.abs(dPos)>=1||Math.abs(dC)>=1)res.push({type:'query',label:q,posNow:pP(cr['Posición']),posPrev:pP(pr['Posición']),dPos:dPos,clicsNow:pN(cr.Clics),dClics:dC,isPaid:isPaid(q)});
  });
  cP.forEach(function(cp){
    var url=cp['Páginas principales']||'';
    var pp=pP2.find(function(r){return(r['Páginas principales']||'')===url;});
    if(!pp)return;
    var dPos=pP(cp['Posición'])-pP(pp['Posición']),dC=pN(cp.Clics)-pN(pp.Clics);
    if(Math.abs(dPos)>=1||Math.abs(dC)>=1)res.push({type:'page',label:shortURL(url),posNow:pP(cp['Posición']),posPrev:pP(pp['Posición']),dPos:dPos,clicsNow:pN(cp.Clics),dClics:dC,isSvc:isSvc(url)});
  });
  res.sort(function(a,b){return Math.abs(b.dPos)-Math.abs(a.dPos);});
  return res;
}

// ── CHARTS ───────────────────────────────────────────────

// Render a full SVG line chart with dual series, grid, axes and labels.
// series: [{label, values:[numbers], color, dashed, yRight}]
// labels: [string] — one per data point (x axis)
// opts: { height, yRightLabel, yLeftLabel, invertRight }
var MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function weekLabelToMonday(label) {
  var m = label.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  var year = parseInt(m[1]), week = parseInt(m[2]);
  var jan4 = new Date(year, 0, 4);
  var dow = jan4.getDay() || 7;
  var mon = new Date(jan4);
  mon.setDate(jan4.getDate() - (dow - 1) + (week - 1) * 7);
  return mon;
}

function weekLabelToShort(label) {
  var mon = weekLabelToMonday(label);
  if (!mon) return label;
  return mon.getDate() + ' ' + MONTHS_ES[mon.getMonth()];
}

function svgLineChart(labels, series, opts) {
  opts = opts || {};
  var W = 860, H = opts.height || 180;
  var padL = 52, padR = opts.yRightLabel ? 52 : 16, padT = 14, padB = 38;
  var cW = W - padL - padR, cH = H - padT - padB;
  var n = labels.length;
  if (n < 2) return '';

  // Separate left and right series
  var leftSeries  = series.filter(function(s){ return !s.yRight; });
  var rightSeries = series.filter(function(s){ return  s.yRight; });

  function seriesRange(ss) {
    var all = [];
    ss.forEach(function(s){ s.values.forEach(function(v){ if(v !== null) all.push(v); }); });
    if (!all.length) return { mn: 0, mx: 1 };
    return { mn: Math.min.apply(null,all), mx: Math.max.apply(null,all) };
  }

  var lR = seriesRange(leftSeries);
  var rR = seriesRange(rightSeries);
  // Add 10% padding top
  lR.mx = lR.mx + (lR.mx - lR.mn) * 0.1 || lR.mx * 1.1 || 1;
  rR.mx = rR.mx + (rR.mx - rR.mn) * 0.1 || rR.mx * 1.1 || 1;

  function toY(val, range, invert) {
    var norm = (val - range.mn) / (range.mx - range.mn || 1);
    if (invert) norm = 1 - norm;
    return padT + cH - norm * cH;
  }

  function xOf(i) { return padL + i / (n - 1) * cW; }

  var svg = '<svg class="chart-svg" viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">';

  // Grid lines (4 horizontal)
  for (var g = 0; g <= 4; g++) {
    var gy = padT + g * cH / 4;
    svg += '<line x1="'+padL+'" y1="'+gy.toFixed(1)+'" x2="'+(padL+cW)+'" y2="'+gy.toFixed(1)+'" stroke="#e8e8e6" stroke-width="1"/>';
    // Left axis labels
    var lv = lR.mx - g * (lR.mx - lR.mn) / 4;
    svg += '<text x="'+(padL-6)+'" y="'+(gy+4).toFixed(1)+'" text-anchor="end" font-size="9" fill="#aaa">'+fmtK(Math.round(lv))+'</text>';
    // Right axis labels
    if (rightSeries.length) {
      var rv = opts.invertRight
        ? rR.mn + g * (rR.mx - rR.mn) / 4
        : rR.mx - g * (rR.mx - rR.mn) / 4;
      svg += '<text x="'+(padL+cW+6)+'" y="'+(gy+4).toFixed(1)+'" text-anchor="start" font-size="9" fill="#aaa">'+rv.toFixed(1)+'</text>';
    }
  }

  // X axis labels — convert ISO week to "3 mar", skip every other when dense
  var skipEvery = n > 12 ? 2 : 1;
  labels.forEach(function(lbl, i) {
    if (i % skipEvery !== 0 && i !== n - 1) return;
    var x = xOf(i);
    var short = weekLabelToShort(lbl);
    svg += '<text x="'+x.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#aaa">'+esc(short)+'</text>';
  });

  // Draw series
  series.forEach(function(s) {
    var range = s.yRight ? rR : lR;
    var invert = s.yRight && opts.invertRight;
    var pts = [];
    s.values.forEach(function(v, i) {
      if (v === null) return;
      pts.push({ x: xOf(i), y: toY(v, range, invert), v: v, i: i });
    });
    if (pts.length < 1) return;

    // Area fill under line (subtle)
    if (pts.length > 1) {
      var areaD = 'M'+pts[0].x.toFixed(1)+','+(padT+cH)+' ';
      areaD += 'L'+pts[0].x.toFixed(1)+','+pts[0].y.toFixed(1)+' ';
      for (var pi = 1; pi < pts.length; pi++) {
        areaD += 'L'+pts[pi].x.toFixed(1)+','+pts[pi].y.toFixed(1)+' ';
      }
      areaD += 'L'+pts[pts.length-1].x.toFixed(1)+','+(padT+cH)+' Z';
      if (!s.dashed) svg += '<path d="'+areaD+'" fill="'+s.color+'" opacity="0.07"/>';
    }

    // Line
    if (pts.length > 1) {
      var lineD = pts.map(function(p,i){ return (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1); }).join(' ');
      svg += '<path d="'+lineD+'" fill="none" stroke="'+s.color+'" stroke-width="1.5"'+(s.dashed?' stroke-dasharray="5,3"':'')+' stroke-linejoin="round" stroke-linecap="round"/>';
    }

    // Dots + value labels
    pts.forEach(function(p) {
      svg += '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3" fill="'+s.color+'" stroke="#fff" stroke-width="1"/>';
      var valTxt = s.yRight ? p.v.toFixed(1) : fmtK(Math.round(p.v));
      var ty = p.y - 8;
      if (ty < padT + 10) ty = p.y + 16;
      svg += '<text x="'+p.x.toFixed(1)+'" y="'+ty.toFixed(1)+'" text-anchor="middle" font-size="9" font-weight="600" fill="'+s.color+'">'+valTxt+'</text>';
    });
  });

  // Axis lines
  svg += '<line x1="'+padL+'" y1="'+padT+'" x2="'+padL+'" y2="'+(padT+cH)+'" stroke="#ccc" stroke-width="1"/>';
  svg += '<line x1="'+padL+'" y1="'+(padT+cH)+'" x2="'+(padL+cW)+'" y2="'+(padT+cH)+'" stroke="#ccc" stroke-width="1"/>';

  // Legend
  var legX = padL;
  series.forEach(function(s) {
    svg += '<rect x="'+legX+'" y="'+(H-padB+20)+'" width="10" height="3" rx="1" fill="'+s.color+'"'+(s.dashed?' stroke="'+s.color+'" stroke-dasharray="3,2"':'')+'/>';
    svg += '<text x="'+(legX+14)+'" y="'+(H-padB+24)+'" font-size="9" fill="#888">'+esc(s.label)+'</text>';
    legX += s.label.length * 6 + 24;
  });

  svg += '</svg>';
  return svg;
}

// Build trend data across all snapshots
function buildTrendData(snaps) {
  return (snaps || S.snapshots).map(function(snap) {
    var m = calcM(snap);
    return { label: snap.label, clics: m ? m.clics : 0, impr: m ? m.impr : 0, pos: m ? m.pos : 0 };
  });
}

// Build trend data for a specific URL across all snapshots
function buildURLTrend(url, snaps) {
  return getURLHistory(url, snaps).map(function(h) {
    return {
      label: h.label,
      clics: h.found ? h.clics : null,
      impr:  h.found ? h.impr  : null,
      pos:   h.found ? h.pos   : null
    };
  });
}

function filteredSnaps() {
  var sorted = S.snapshots.slice().sort(function(a,b){ return a.label.localeCompare(b.label); });
  if (S.overviewRange === 'custom' && S.overviewDateFrom && S.overviewDateTo) {
    return sorted.filter(function(snap) {
      var mon = weekLabelToMonday(snap.label);
      if (!mon) return false;
      var d = mon.toISOString().slice(0, 10);
      return d >= S.overviewDateFrom && d <= S.overviewDateTo;
    });
  }
  var n = RANGE_WEEKS[S.overviewRange] || sorted.length;
  return sorted.slice(-n);
}

function compareSnaps() {
  if (!S.compareEnabled) return [];
  var mainSnaps = filteredSnaps();
  if (!mainSnaps.length) return [];
  var sorted = S.snapshots.slice().sort(function(a,b){ return a.label.localeCompare(b.label); });
  if (S.compareRange === 'previous') {
    var n = mainSnaps.length;
    var firstMainIdx = sorted.findIndex(function(s){ return s.label === mainSnaps[0].label; });
    return sorted.slice(Math.max(0, firstMainIdx - n), firstMainIdx);
  }
  if (S.compareRange === 'year') {
    return mainSnaps.map(function(snap) {
      var m = snap.label.match(/^(\d{4})-W(\d{2})$/);
      if (!m) return null;
      var prev = (parseInt(m[1]) - 1) + '-W' + m[2];
      return sorted.find(function(s){ return s.label === prev; }) || null;
    }).filter(Boolean);
  }
  if (S.compareRange === 'custom' && S.compareDateFrom && S.compareDateTo) {
    return sorted.filter(function(snap) {
      var mon = weekLabelToMonday(snap.label);
      if (!mon) return false;
      var d = mon.toISOString().slice(0, 10);
      return d >= S.compareDateFrom && d <= S.compareDateTo;
    });
  }
  return [];
}

function openDateModal() {
  S.pendingRange          = S.overviewRange || '3m';
  S.pendingDateFrom       = S.overviewDateFrom || '';
  S.pendingDateTo         = S.overviewDateTo   || '';
  S.pendingCompareRange   = S.compareRange || 'previous';
  S.pendingCompareDateFrom = S.compareDateFrom || '';
  S.pendingCompareDateTo  = S.compareDateTo   || '';
  S.modalTab              = 'filtrar';
  S.showDateModal         = true;
  render();
}

function setPendingRange(r) { S.pendingRange = r; render(); }

function setPendingModalTab(t) { S.modalTab = t; render(); }

function setPendingCompareRange(r) { S.pendingCompareRange = r; render(); }

function disableCompare() {
  S.compareEnabled = false;
  S.gscCompareData = null;
  saveState();
  render();
}

function applyDateFilter() {
  if (S.modalTab === 'comparar') {
    var cfrom = document.getElementById('dm-comp-from');
    var cto   = document.getElementById('dm-comp-to');
    S.compareRange = S.pendingCompareRange;
    if (S.compareRange === 'custom') {
      S.compareDateFrom = cfrom ? cfrom.value : S.pendingCompareDateFrom;
      S.compareDateTo   = cto   ? cto.value   : S.pendingCompareDateTo;
      if (!S.compareDateFrom || !S.compareDateTo) { toast('Ingresa las dos fechas de comparación'); return; }
    }
    S.compareEnabled = true;
    S.showDateModal  = false;
    saveState();
    if (S.accessToken && S.gscSiteUrl) fetchGSCCompareData();
    else render();
    return;
  }
  // ── Filtrar tab ──
  var fromEl = document.getElementById('dm-from');
  var toEl   = document.getElementById('dm-to');
  if (S.pendingRange === 'custom') {
    S.overviewDateFrom = fromEl ? fromEl.value : S.pendingDateFrom;
    S.overviewDateTo   = toEl   ? toEl.value   : S.pendingDateTo;
    if (!S.overviewDateFrom || !S.overviewDateTo) { toast('Ingresa las dos fechas'); return; }
  }
  S.overviewRange   = S.pendingRange;
  S.showDateModal   = false;
  S.gscCompareData  = null;
  saveState();
  if (S.accessToken && S.gscSiteUrl) fetchGSCData();
  else render();
}

function setOverviewRange(r) {
  S.overviewRange  = r;
  S.gscData        = null;
  S.gscCompareData = null;
  saveState();
  if (S.accessToken && S.gscSiteUrl) fetchGSCData();
  else render();
}

// ── IDEAS HELPERS ─────────────────────────────────────────
var SERVICE_MAP = [
  { keys:['google ads','adwords'],      url:'/agencia-google-ads/',       label:'Google Ads' },
  { keys:['facebook ads','meta ads'],   url:'/agencia-facebook-ads/',     label:'Facebook/Meta Ads' },
  { keys:['tiktok ads','tik tok'],      url:'/agencia-tik-tok-ads/',      label:'TikTok Ads' },
  { keys:['seo','posicionamiento web'], url:'/agencia-seo/',              label:'Agencia SEO' },
  { keys:['looker studio','dashboard'], url:'/performance/dashboards-y-reportes/', label:'Dashboards' },
  { keys:['landing page'],              url:'/servicio-de-landing-page/', label:'Landing Page' },
  { keys:['ecommerce','woocommerce','tienda online'], url:'/e-commerce/', label:'E-commerce' },
  { keys:['marketing digital','asesoria','consultoría'], url:'/asesoria-marketing-digital/', label:'Asesoría Marketing' },
  { keys:['redes sociales','community manager'], url:'/gestion-redes-sociales/', label:'Gestión Redes' }
];

function suggestTarget(query) {
  var ql = (query||'').toLowerCase();
  for (var i=0; i<SERVICE_MAP.length; i++) {
    if (SERVICE_MAP[i].keys.some(function(k){ return ql.includes(k); })) return SERVICE_MAP[i].url;
  }
  return '/asesoria-marketing-digital/';
}

function suggestTargetLabel(query) {
  var ql = (query||'').toLowerCase();
  for (var i=0; i<SERVICE_MAP.length; i++) {
    if (SERVICE_MAP[i].keys.some(function(k){ return ql.includes(k); })) return SERVICE_MAP[i].label;
  }
  return 'Asesoría Marketing';
}

function generateIdea(query, mode) {
  var q  = (query||'').toLowerCase();
  var qt = query || '';

  if (mode === 'rankboost') {
    if (q.includes('fecha') || q.includes('celebra') || q.includes('efemeride')) {
      return 'Actualizar con fechas 2026 + agregar sección de CTA hacia servicios';
    }
    if (q.includes('red social') || q.includes('estadistica')) {
      return 'Agregar datos actualizados 2026 + bloque interno hacia Gestión Redes';
    }
    return 'Mejorar H1 con keyword exacta + enriquecer con datos/ejemplos reales de Perú';
  }

  // Cluster mode
  if (q.includes('looker studio') || q.includes('dashboard') || q.includes('reporte')) {
    return 'Guía: cómo conectar ' + qt + ' paso a paso con capturas reales';
  }
  if (q.includes('google ads') || q.includes('adwords')) {
    return 'Cuánto invertir en Google Ads en Perú: presupuestos y resultados reales';
  }
  if (q.includes('facebook') || q.includes('meta ads')) {
    return 'Facebook Ads para negocios peruanos: ejemplos de campañas y presupuestos';
  }
  if (q.includes('tiktok')) {
    return 'TikTok Ads en Perú: presupuesto mínimo, formatos y casos de éxito';
  }
  if (q.includes('seo') || q.includes('posicionamiento')) {
    return 'SEO en Lima: cuánto tarda, cuánto cuesta y qué resultados esperar';
  }
  if (q.includes('fecha') || q.includes('celebra') || q.includes('efemeride')) {
    return 'Agregar sección "Publicita en ' + qt + '" con CTA hacia Meta Ads / Google Ads';
  }
  if (q.includes('red social') || q.includes('instagram') || q.includes('tiktok')) {
    return 'Estadísticas de ' + qt + ' en Perú 2026 + cuándo anunciarse';
  }
  if (q.includes('ecosistema digital') || q.includes('marketing digital')) {
    return 'Ecosistema digital para e-commerce peruano: herramientas y agencias';
  }
  if (q.includes('woocommerce') || q.includes('ecommerce') || q.includes('tienda')) {
    return 'Cómo lanzar una tienda online en Perú: checklist y costos reales 2026';
  }
  if (q.includes('dia de la madre') || q.includes('campaña')) {
    return 'Campañas de ' + qt + ': ejemplos reales con resultados de Meta Ads y Google Ads';
  }
  return 'Guía práctica de ' + qt + ' para negocios en Lima (con ejemplos y costos)';
}

function suggestSupportArticles(url) {
  var ul = (url||'').toLowerCase();
  if (ul.includes('google-ads') || ul.includes('adwords')) {
    return '① Cuánto cuesta Google Ads en Perú · ② Google Ads vs Facebook Ads · ③ Errores comunes en campañas de Google Ads';
  }
  if (ul.includes('facebook-ads') || ul.includes('meta')) {
    return '① Cómo escalar campañas de Meta Ads · ② Facebook Ads para e-commerce · ③ Guía de segmentación en Meta Ads Peru';
  }
  if (ul.includes('tiktok')) {
    return '① Presupuesto mínimo TikTok Ads Perú · ② Formatos de anuncios TikTok · ③ TikTok vs Meta Ads: cuál elegir';
  }
  if (ul.includes('seo')) {
    return '① SEO técnico para WooCommerce · ② Cuánto tarda el SEO en dar resultados · ③ Cómo elegir agencia SEO en Lima';
  }
  if (ul.includes('asesoria') || ul.includes('marketing')) {
    return '① Qué hace una agencia de marketing digital · ② Métricas que debe reportar tu agencia · ③ Cómo auditar tus campañas digitales';
  }
  if (ul.includes('landing')) {
    return '① Qué hace una buena landing page · ② Landing page vs sitio web · ③ Cuánto cuesta una landing page en Perú';
  }
  if (ul.includes('e-commerce') || ul.includes('ecommerce')) {
    return '① Costos de lanzar un e-commerce en Perú · ② WooCommerce vs Shopify · ③ Cómo aumentar conversiones en tienda online';
  }
  if (ul.includes('campanas') || ul.includes('publicitar')) {
    return '① Guía de campañas digitales para fechas especiales · ② Cómo planificar presupuesto de publicidad digital';
  }
  return '① Caso de éxito de cliente · ② Guía práctica del servicio · ③ Comparativa con otras opciones del mercado';
}

// ── SIDEBAR SVG ICONS ────────────────────────────────────
var ICONS = {
  overview:      '<svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  oportunidades: '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  consultas:     '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  transaccionales:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  seguimiento:   '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  paginas:       '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  'páginas':     '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  variacion:     '<svg viewBox="0 0 24 24"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  'variación':   '<svg viewBox="0 0 24 24"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  ideas:         '<svg viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="6"/><path d="M12 8a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V17a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-1.5C8.8 14.8 8 13.5 8 12a4 4 0 0 1 4-4z"/><line x1="12" y1="21" x2="12" y2="22"/></svg>',
  configuracion: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  'configuración':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  snapshots:     '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8L6 7h12z"/></svg>'
};

// ── RENDER ────────────────────────────────────────────────
function render(){ document.getElementById('app').innerHTML = buildHTML(); bindEvents(); }

function buildHTML(){

  // ── Confirm manual upload (full-screen modal) ──
  if(S.pending){
    var tl={grafico:'Gráfico',consultas:'Consultas',paginas:'Páginas',dispositivos:'Dispositivos',paises:'Países'};
    var isComp = S.pendingPrev && Object.keys(S.pendingPrev).length > 0;
    var fileList = '<div style="background:#f2f2f0;border-radius:8px;padding:10px 12px;margin-bottom:12px">'+
      Object.keys(S.pending).map(function(t){
        return'<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px">'+
          '<span style="color:var(--green);font-weight:700">✓</span>'+
          '<span>'+esc(tl[t]||t)+'</span>'+
          '<span style="color:#aaa;font-size:11px">('+S.pending[t].length+' filas)</span></div>';
      }).join('')+'</div>';

    var compBadge = isComp
      ? '<div style="background:#EAF3DE;border:1px solid #C0DD97;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#3B6D11">'+
        '✓ Archivo de comparación detectado — se crearán <b>2 snapshots</b> automáticamente'+
        '</div>'
      : '';

    var labelFields = isComp
      ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'+
          '<div>'+
            '<label style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">Período más reciente (A)</label>'+
            '<input id="snap-label" value="'+esc(S.pendingLabel||'')+'" placeholder="Ej: 23/3/26 - 29/3/26" style="width:100%">'+
          '</div>'+
          '<div>'+
            '<label style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">Período anterior (B)</label>'+
            '<input id="snap-label-prev" value="'+esc(S.pendingLabelPrev||'')+'" placeholder="Ej: 16/3/26 - 22/3/26" style="width:100%">'+
          '</div>'+
        '</div>'
      : '<label style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">Etiqueta del período</label>'+
        '<input id="snap-label" value="'+esc(S.pendingLabel||'')+'" placeholder="Ej: 2026-W15" style="width:100%;margin-bottom:12px">';

    // pending upload — centered card
    return'<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg)">'+
    '<div class="setup-card" style="max-width:500px;width:100%">'+
      '<h2 style="margin-bottom:12px">Confirmar carga</h2>'+
      compBadge + fileList + labelFields +
      '<div style="display:flex;gap:8px;margin-top:4px">'+
        '<button class="btn primary" onclick="confirmManual()">'+(isComp?'Guardar 2 snapshots':'Guardar snapshot')+'</button>'+
        '<button class="btn" onclick="S.pending=null;render()">Cancelar</button>'+
      '</div></div></div>';
  }

  var usingDirect = !!S.gscData;
  var hasSnaps = S.snapshots.length > 0;
  var hasData  = usingDirect || hasSnaps;
  var cur  = usingDirect ? { data: S.gscData }         : S.snapshots[S.curIdx];
  var prev = usingDirect ? (S.gscCompareData ? { data: S.gscCompareData } : null)
                         : (S.curIdx > 0 ? S.snapshots[S.curIdx - 1] : null);
  // Label shown in "vs ___" comparisons
  var prevLabel = usingDirect && S.gscCompareData
    ? ((S.gscCompareData.startDate||'') + ' – ' + (S.gscCompareData.endDate||''))
    : (prev && prev.label ? prev.label : 'período anterior');

  // ── URL FOCUS HELPERS (shared by Overview, Artículos blog, Páginas) ──
  var lupaSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  function lupaBtnHTML(url) {
    var safeUrl = (url||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var focused = S.overviewFocusUrl === url;
    var bg  = focused ? '#E85249' : 'transparent';
    var col = focused ? '#fff' : '#94a3b8';
    var bdr = focused ? '#E85249' : '#e2e8f0';
    var action = focused
      ? 'S.overviewFocusUrl=null;S.overviewFocusData=null;render()'
      : (usingDirect ? 'S.overviewFocusUrl=\''+safeUrl+'\';S.overviewFocusData=null;fetchURLFocus(\''+safeUrl+'\')'
                     : 'S.overviewFocusUrl=\''+safeUrl+'\';render()');
    return '<button onclick="'+action+'" title="Ver en gráfico" '+
      'style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;'+
      'border:1px solid '+bdr+';border-radius:4px;background:'+bg+';color:'+col+';cursor:pointer;padding:0;vertical-align:middle">'+
      lupaSvg+'</button>';
  }
  function urlFocusChartHTML() {
    if (!S.overviewFocusUrl) return '';
    if (usingDirect && !S.overviewFocusData) {
      fetchURLFocus(S.overviewFocusUrl);
      return '<div class="panel" style="padding:1rem 1.2rem 0.6rem;margin-bottom:12px"><p style="font-size:10px;color:#aaa;padding:4px 0 6px">Cargando tendencia de URL…</p></div>';
    }
    var focusRows = usingDirect ? aggregateByWeek(S.overviewFocusData || []) : [];
    var ut = usingDirect ? focusRows : buildURLTrend(S.overviewFocusUrl, filteredSnaps());
    if (!ut.length) return '';
    var labels = ut.map(function(d){ return d.label; });
    var series = [
      { label:'Clics', values: ut.map(function(d){ return d.clics; }), color:'#E85249' },
      { label:'Impr.', values: ut.map(function(d){ return d.impr;  }), color:'#059669', dashed:true }
    ];
    var html = '<div class="panel" style="padding:1rem 1.2rem 0.6rem;margin-bottom:12px">';
    if (labels.length >= 2) html += svgLineChart(labels, series, { height:200 });
    html += '<div style="display:flex;align-items:center;gap:10px;padding:4px 0 6px">'+
      '<span style="font-size:10px;color:#E85249;font-weight:600">'+esc(shortURL(S.overviewFocusUrl))+'</span>'+
      '<button onclick="S.overviewFocusUrl=null;S.overviewFocusData=null;render()" style="font-size:10px;padding:2px 8px;border:1px solid #ddd;border-radius:12px;background:transparent;cursor:pointer;color:#666">× Cerrar</button>'+
      '</div></div>';
    return html;
  }

  var TABS_DEF = [
    { id:'overview',       label:'Overview',         group:'Análisis' },
    { id:'seguimiento',    label:'Artículos blog',   group:'Análisis' },
    { id:'páginas',        label:'Páginas',          group:'Análisis' },
    { id:'oportunidades',  label:'Oportunidades',    group:'Análisis', hi:true },
    { id:'variación',      label:'Variación',        group:'Acciones', hi:true, req2:true },
    { id:'ideas',          label:'Ideas',            group:'Acciones' },
    { id:'configuración',  label:'Configuración',    group:'Configuración' }
  ].filter(function(t){ return !t.req2 || (usingDirect ? !!S.gscCompareData : S.snapshots.length > 1); });

  // ── SIDEBAR ──
  var prevGroup='';
  var sidebarItems = TABS_DEF.map(function(t){
    var groupHtml = '';
    if(t.group !== prevGroup){
      groupHtml = '<div class="s-group-lbl">'+t.group+'</div>';
      prevGroup = t.group;
    }
    var active = S.tab === t.id;
    var cls = 's-item'+(active?' active':'')+(t.hi?' hi':'');
    return groupHtml+'<button class="'+cls+'" onclick="S.tab=\''+t.id+'\';render()">'+
      (ICONS[t.id]||'')+'<span>'+t.label+'</span>'+
      (t.id==='snapshots'&&S.snapshots.length?'<span class="s-num has">'+S.snapshots.length+'</span>':'')+
      (t.id==='oportunidades'?'<span class="s-num has">!</span>':'')+
    '</button>';
  }).join('');

  var sidebar = '<aside class="sidebar">'+
    '<div class="s-brand">'+
      '<div class="s-title">Content <b>SEO</b> Booster</div>'+
    '</div>'+
    sidebarItems+
    '<div style="flex:1"></div>'+
    '<div style="padding:12px 12px 20px;display:flex;flex-direction:column;gap:6px">'+
      (S.gscStatus==='connected'
        ? '<div style="font-size:10px;color:#34D399;font-weight:600;padding:5px 8px;background:rgba(52,211,153,.1);border-radius:6px;display:flex;align-items:center;gap:5px">'+
            '<svg viewBox="0 0 24 24" style="width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2.5"><polyline points="20 6 9 17 4 12"/></svg>'+
            'GSC conectado</div>'
        : S.gscStatus==='loading'
          ? '<div style="font-size:10px;color:#94A3B8;padding:5px 8px">Cargando GSC…</div>'
          : '<button class="s-item" onclick="S.tab=\'configuración\';render()" style="width:100%;margin:0;color:#64748B">'+
              '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'+
              'Conectar GSC'+
            '</button>')+
      (S.driveStatus==='connected'
        ? '<div style="font-size:10px;color:#60A5FA;font-weight:600;padding:5px 8px;background:rgba(96,165,250,.1);border-radius:6px;display:flex;align-items:center;gap:5px">'+
            '<svg viewBox="0 0 24 24" style="width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2.5"><polyline points="20 6 9 17 4 12"/></svg>'+
            'Drive conectado</div>'
        : '')+
    '</div>'+
  '</aside>';

  // ── TOPBAR ──
  var tabLabel = (TABS_DEF.find(function(t){return t.id===S.tab;})||{label:S.tab}).label;

  // Period badge — non-interactive, shown in topbar as context
  var periodBadge = '';
  if(S.snapshots.length > 0 && S.curIdx !== null){
    var curLbl = S.snapshots[S.curIdx] ? S.snapshots[S.curIdx].label : '';
    periodBadge = '<span style="font-size:11px;font-weight:600;color:var(--brand);background:var(--brand-soft);padding:3px 10px;border-radius:20px">'+esc(curLbl)+'</span>';
  }

  var periodSelect = '';
  if(S.snapshots.length > 1){
    var opts=S.snapshots.map(function(s,i){return'<option value="'+i+'"'+(i===S.curIdx?' selected':'')+'>'+esc(s.label)+'</option>';}).join('');
    periodSelect='<select class="period-select" onchange="S.curIdx=parseInt(this.value);render()">'+opts+'</select>';
  }

  var refreshBtn = S.driveStatus==='connected'
    ? '<button class="btn success btn-sm" onclick="refreshFromDrive()" '+(S.refreshing?'disabled':'')+'>'+(S.refreshing?'<span class="spinning">↻</span> Actualizando':'↻ Drive')+'</button>'
    : '';
  var gscBtn = S.gscStatus==='connected' && S.gscSiteUrl
    ? '<button class="btn btn-sm" style="background:#059669;color:#fff;border-color:#059669" onclick="fetchGSCData()" '+(S.gscLoading?'disabled':'')+'>'+(S.gscLoading?'<span class="spinning">↻</span> Cargando':'↻ GSC')+'</button>'
    : '';

  // ── Date filter + compare badge (shown in topbar on data tabs) ──
  var activeRangeLbl = S.overviewRange === 'custom' && S.overviewDateFrom && S.overviewDateTo
    ? S.overviewDateFrom.slice(5).replace('-','/') + ' – ' + S.overviewDateTo.slice(5).replace('-','/')
    : (RANGE_LABELS[S.overviewRange] || 'Últimos 3 meses').replace('Últimos ','');
  var compareLblMap = { previous:'Período anterior', year:'Año anterior', custom:'Personalizado' };
  var compareBadge = S.compareEnabled
    ? '<span style="font-size:11px;background:#EFF6FF;color:#1A73E8;border:1px solid #BFDBFE;border-radius:20px;padding:2px 9px;display:inline-flex;align-items:center;gap:6px">'+
        'vs. '+(compareLblMap[S.compareRange]||'')+
        '<button onclick="disableCompare()" style="background:none;border:none;cursor:pointer;color:#1A73E8;font-size:13px;line-height:1;padding:0">×</button>'+
      '</span>'
    : '';
  var dateFilterBtn =
    '<button class="date-range-btn" onclick="openDateModal()">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'+
      activeRangeLbl+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>'+
    '</button>';
  var DATA_TABS = { overview:1, 'seguimiento':1, 'páginas':1, oportunidades:1, 'variación':1, ideas:1 };
  var topbarFilters = (DATA_TABS[S.tab] && hasData)
    ? dateFilterBtn + compareBadge
    : '';

  var topbar = '<div class="topbar">'+
    '<div class="topbar-left">'+
      '<span class="topbar-sep">|</span>'+
      '<span class="topbar-title">'+esc(tabLabel)+'</span>'+
      (S.refreshing?'<span style="font-size:11px;color:var(--muted)">Sincronizando...</span>':'')+
    '</div>'+
    '<div class="topbar-right">'+
      topbarFilters+
      gscBtn+
      refreshBtn+
      (S.driveStatus==='connected'?'<button class="btn btn-sm" onclick="disconnectDrive()">✕ Drive</button>':'')+
    '</div>'+
  '</div>';

  // ── CONTENT ──
  var content = '';

  // ── CARGANDO — spinner mientras llegan datos ──
  if (S.gscLoading && S.tab !== 'configuración') {
    content = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:320px;gap:14px">'+
      '<span class="spinning" style="font-size:36px;color:var(--brand)">↻</span>'+
      '<p style="color:#64748B;font-size:14px;font-weight:500">Cargando datos de Google Search Console…</p>'+
      '<p style="color:#94A3B8;font-size:12px">'+(S.gscData?'':'Conectando con la API…')+'</p>'+
      '</div>';
    return '<div class="shell">'+sidebar+'<main class="main">'+topbar+'<div class="content">'+content+'</div></main></div>';
  }

  // ── SIN DATOS — pantalla de bienvenida ──
  if(!hasData && S.tab !== 'configuración' && S.tab !== 'snapshots'){
    var connectBlock = S.gscStatus === 'connected'
      ? '<button onclick="fetchGSCData()" style="display:inline-flex;align-items:center;gap:10px;background:#E85249;color:#fff;border:none;border-radius:12px;padding:14px 32px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(232,82,73,.35)">'+
          '<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="3" x2="12" y2="21"/></svg>'+
          'Cargar datos de Search Console</button>'
      : '<button onclick="connectGSC()" style="display:inline-flex;align-items:center;gap:12px;background:#fff;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px 32px;font-size:15px;font-weight:700;color:#1E293B;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.08)" '+(S.gscStatus==='loading'?'disabled':'')+'>'+
          (S.gscStatus==='loading'
            ? '<span class="spinning" style="font-size:18px">↻</span> Conectando…'
            : '<svg viewBox="0 0 24 24" style="width:22px;height:22px"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>'+
              'Conectar con Google') +
        '</button>';

    content =
      '<div id="drop-zone" style="min-height:calc(100vh - 56px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:2rem;box-sizing:border-box"'+
        ' ondragover="event.preventDefault();this.style.background=\'#EFF6FF\'" ondragleave="this.style.background=\'\'" ondrop="event.preventDefault();this.style.background=\'\';processFiles(event.dataTransfer.files)">'+

        '<!-- icon -->'+
        '<div style="width:72px;height:72px;background:linear-gradient(135deg,#E85249,#C0342D);border-radius:20px;display:flex;align-items:center;justify-content:center;margin-bottom:1.5rem;box-shadow:0 8px 24px rgba(232,82,73,.3)">'+
          '<svg viewBox="0 0 24 24" style="width:36px;height:36px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>'+
        '</div>'+

        '<h1 style="font-size:28px;font-weight:800;color:#0F172A;margin:0 0 10px;text-align:center;letter-spacing:-.5px">Content <span style="color:#E85249">SEO</span> Booster</h1>'+
        '<p style="font-size:15px;color:#64748B;margin:0 0 2.5rem;text-align:center;max-width:400px;line-height:1.6">'+
          'Conecta tu cuenta de Google para importar<br>datos de Search Console automáticamente.'+
        '</p>'+

        connectBlock+

        '<div style="margin-top:2rem;display:flex;align-items:center;gap:12px;width:100%;max-width:340px">'+
          '<div style="flex:1;height:1px;background:#E2E8F0"></div>'+
          '<span style="font-size:11px;color:#94A3B8;font-weight:600">O sube CSVs manualmente</span>'+
          '<div style="flex:1;height:1px;background:#E2E8F0"></div>'+
        '</div>'+

        '<button onclick="document.getElementById(\'fi\').click()" style="margin-top:1rem;background:none;border:1.5px dashed #CBD5E1;border-radius:10px;padding:12px 28px;font-size:13px;color:#64748B;cursor:pointer;font-weight:500">'+
          '↑ Subir archivos CSV de GSC'+
        '</button>'+
        '<input type="file" id="fi" multiple accept=".csv" style="display:none">'+
      '</div>';

    return '<div class="shell">'+sidebar+'<main class="main" style="display:flex;flex-direction:column">'+topbar+content+'</main></div>';
  }

  // ── CONFIGURACIÓN ──
  if(S.tab==='configuración'){

    var weekOptions = [4,8,12,16].map(function(w){
      return '<option value="'+w+'"'+(w===S.gscWeeks?' selected':'')+'>Últimas '+w+' semanas</option>';
    }).join('');
    var gscSiteOptions = S.gscSites.map(function(s){
      return '<option value="'+esc(s)+'"'+(s===S.gscSiteUrl?' selected':'')+'>'+esc(s)+'</option>';
    }).join('');

    // ── ESTADO: CONECTADO ──
    if (S.gscStatus === 'connected') {
      content +=
      '<div class="setup-card">'+
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem">'+
          '<div style="width:36px;height:36px;background:#DCFCE7;border-radius:50%;display:flex;align-items:center;justify-content:center">'+
            '<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:#059669;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>'+
          '</div>'+
          '<div><div style="font-weight:700;font-size:15px">Conectado a Google Search Console</div>'+
          '<div style="font-size:12px;color:#64748B">Los datos se importan directamente — sin CSVs</div></div>'+
        '</div>'+

        (S.gscSites.length > 0
          ? '<div style="margin-bottom:1rem">'+
            '<label style="font-size:11px;font-weight:700;color:'+(S.gscSiteUrl?'#64748B':'#D97706')+';text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">'+
            (S.gscSiteUrl ? 'Propiedad activa' : '⚠ Elige la propiedad antes de importar')+'</label>'+
            '<select id="cfg-gscsite" onchange="switchGSCProperty(this.value)" style="width:100%;padding:9px 12px;border:2px solid '+(S.gscSiteUrl?'#E2E8F0':'#F59E0B')+';border-radius:8px;font-size:13px;background:'+(S.gscSiteUrl?'#fff':'#FFFBEB')+'">'+
            '<option value="">— Selecciona una propiedad —</option>'+
            gscSiteOptions+
            '</select></div>'
          : '') +

        '<div style="margin-top:0.5rem">'+
          '<button class="btn btn-sm" style="color:#94A3B8" onclick="disconnectDrive();S.gscStatus=\'disconnected\';S.gscSites=[];render()">Desconectar</button>'+
        '</div>'+
      '</div>';

    // ── ESTADO: SIN CLIENT ID — primera vez ──
    } else if (!S.clientId) {
      content +=
      '<div class="setup-card">'+
        '<h2 style="margin-bottom:6px">Conectar Google Search Console</h2>'+
        '<p class="desc" style="margin-bottom:1.4rem">Para importar datos directamente necesitas un <b>Client ID</b> de Google. Se crea una sola vez y tarda ~3 minutos.</p>'+

        '<details style="margin-bottom:1.2rem;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px">'+
          '<summary style="cursor:pointer;font-weight:600;font-size:13px;color:#334155;list-style:none">▶ ¿Cómo obtener el Client ID? (3 pasos)</summary>'+
          '<div style="margin-top:12px;display:flex;flex-direction:column;gap:10px">'+
            '<div class="step"><div class="step-num">1</div><div class="step-body">Ve a <a href="https://console.cloud.google.com" target="_blank" style="color:var(--brand)">console.cloud.google.com</a> → crea un proyecto → activa la <b>Search Console API</b> y la <b>Drive API</b>.</div></div>'+
            '<div class="step"><div class="step-num">2</div><div class="step-body">Credenciales → Crear → <b>ID de cliente OAuth 2.0</b> → tipo: <b>Aplicación web</b>.<br>En "Orígenes autorizados" agrega <code>https://jorgeluis666.github.io</code></div></div>'+
            '<div class="step"><div class="step-num">3</div><div class="step-body">Copia el Client ID y pégalo abajo.</div></div>'+
          '</div>'+
        '</details>'+

        '<label style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">Client ID de Google OAuth</label>'+
        '<input id="cfg-clientid" value="" placeholder="xxxx.apps.googleusercontent.com" style="width:100%;margin-bottom:12px">'+
        '<button class="btn primary" onclick="saveConfig()">Guardar y continuar →</button>'+
      '</div>';

    // ── ESTADO: TIENE CLIENT ID, NO CONECTADO ──
    } else {
      content +=
      '<div class="setup-card" style="text-align:center;padding:2.5rem 2rem">'+
        '<div style="width:56px;height:56px;background:#EFF6FF;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem">'+
          '<svg viewBox="0 0 24 24" style="width:26px;height:26px;fill:none;stroke:#E85249;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'+
        '</div>'+
        '<div style="font-weight:700;font-size:16px;margin-bottom:6px">Importar desde Search Console</div>'+
        '<div style="font-size:13px;color:#64748B;margin-bottom:1.8rem">Conecta tu cuenta de Google para importar<br>los datos de GSC directamente al dashboard</div>'+
        '<button onclick="connectGSC()" style="display:inline-flex;align-items:center;gap:10px;background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:12px 24px;font-size:14px;font-weight:600;color:#334155;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.08)" '+(S.gscStatus==='loading'?'disabled':'')+'>'+
          (S.gscStatus==='loading'
            ? '<span class="spinning" style="font-size:16px">↻</span> Cargando…'
            : '<svg viewBox="0 0 24 24" style="width:20px;height:20px"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>'+
              'Conectar con Google') +
        '</button>'+
        '<div style="margin-top:1.4rem">'+
          '<details style="display:inline-block;text-align:left">'+
            '<summary style="cursor:pointer;font-size:11px;color:#94A3B8;list-style:none">ℹ Semanas a importar</summary>'+
            '<div style="margin-top:8px;display:flex;gap:8px;align-items:center">'+
              '<select id="cfg-gscweeks" style="padding:6px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:12px">'+weekOptions+'</select>'+
              '<button class="btn btn-sm" onclick="saveConfig()">Guardar</button>'+
            '</div>'+
          '</details>'+
        '</div>'+
      '</div>';
    }

    // ── Drive (colapsado al final) ──
    content +=
    '<details style="margin-top:1rem" '+(S.folderId?'open':'')+'>'+
      '<summary style="cursor:pointer;padding:12px 16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;font-weight:600;color:#64748B;list-style:none">'+
        '📁 Alternativa: Google Drive (importar CSVs)'+
      '</summary>'+
      '<div class="setup-card" style="margin-top:6px;border-radius:8px">'+
        '<p class="desc">Sube los exports CSV de GSC a una carpeta de Drive y el dashboard los detecta automáticamente.</p>'+
        '<label style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">ID de la carpeta en Drive</label>'+
        '<div style="display:flex;gap:8px;margin-bottom:10px">'+
          '<input id="cfg-folderid" value="'+esc(S.folderId)+'" placeholder="Pega el ID de la carpeta…" style="flex:1">'+
          '<button class="btn primary" onclick="saveConfig()">Guardar</button>'+
          (S.clientId&&S.folderId ? '<button class="btn success" onclick="connectDrive()">'+(S.driveStatus==='connected'?'✓ Conectado':'Conectar Drive')+'</button>' : '')+
        '</div>'+
        '<div style="background:#F1F5F9;border-radius:6px;padding:.8rem;font-family:monospace;font-size:11px;color:#64748B;line-height:1.8">'+
          '📁 GSC-Lima-Retail/<br>'+
          '&nbsp;&nbsp;📄 2026-W14_Consultas.csv<br>'+
          '&nbsp;&nbsp;📄 2026-W14_Páginas.csv<br>'+
          '&nbsp;&nbsp;📄 2026-W14_Gráfico.csv  …'+
        '</div>'+
      '</div>'+
    '</details>';

    return '<div class="shell">'+sidebar+'<main class="main">'+topbar+'<div class="content">'+content+'</div></main></div>';
  }

  var curM = usingDirect
    ? (calcM(cur) || { clics: 0, impr: 0, ctr: 0, pos: 0 })
    : (calcMRange(filteredSnaps()) || { clics: 0, impr: 0, ctr: 0, pos: 0 });
  var prevM = usingDirect
    ? (prev ? calcM(prev) : null)
    : (S.compareEnabled && compareSnaps().length ? calcMRange(compareSnaps())
       : (S.curIdx > 0 ? calcM(S.snapshots[S.curIdx-1]) : null));

  // ── SHARED: date filter bar ───────────────────────────────
  // ── OVERVIEW ──
  if(S.tab==='overview'){
    function kpiCard(lbl,val,pv,fmt,sfx,inv,iconCls,iconSvg){
      var f=fmt||function(v){return Math.round(v).toLocaleString('es-PE');};
      var d=pv!=null?val-pv:null;
      var good=d===null?null:(inv?d<0:d>0);
      var deltaHtml='<div class="kpi-delta">';
      if(d!==null&&Math.abs(d)>0.001){
        deltaHtml+='<span class="'+(good?'up':'dn')+'">'+(good?'↑':'↓')+' '+f(Math.abs(d))+(sfx||'')+'</span> vs anterior';
      } else {
        deltaHtml+='<span class="neu">primer snapshot</span>';
      }
      deltaHtml+='</div>';
      return'<div class="kpi-card">'+
        '<div class="kpi-icon '+iconCls+'">'+iconSvg+'</div>'+
        '<div class="kpi-lbl">'+lbl+'</div>'+
        '<div class="kpi-val">'+f(val)+(sfx||'')+'</div>'+
        deltaHtml+'</div>';
    }
    content+='<div class="kpi-grid">'+
      kpiCard('Clics totales',curM.clics,prevM&&prevM.clics,null,'','','blue','<svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>')+
      kpiCard('Impresiones',curM.impr,prevM&&prevM.impr,fmtK,'','','green','<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>')+
      kpiCard('CTR promedio',curM.ctr,prevM&&prevM.ctr,function(v){return v.toFixed(2);},'%','','amber','<svg viewBox="0 0 24 24"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>')+
      kpiCard('Posición media',curM.pos,prevM&&prevM.pos,function(v){return v.toFixed(1);},'',true,'slate','<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.4 11.5 7.7 11.8a.5.5 0 0 0 .6 0C12.6 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/></svg>')+
    '</div>';

    var pages = (cur && cur.data ? cur.data.paginas : []) || [];
    var prevPages = prev && prev.data ? ((prev&&prev.data?prev.data.paginas:[]) || []) : [];
    function findPrev(url){ return prevPages.find(function(r){return(r['Páginas principales']||'')===url;})||null; }
    function enrichRow(r){
      var url = r['Páginas principales']||'';
      var pr  = findPrev(url);
      return {
        url: url,
        clics: pN(r.Clics),
        impr:  pN(r.Impresiones),
        ctr:   r.CTR,
        pos:   pP(r['Posición']),
        dClics: pr ? pN(r.Clics)-pN(pr.Clics) : null,
        dImpr:  pr ? pN(r.Impresiones)-pN(pr.Impresiones) : null,
        dPos:   pr ? pP(r['Posición'])-pP(pr['Posición']) : null
      };
    }
    var enriched = pages.map(enrichRow);
    var topClics = enriched.slice().sort(function(a,b){return b.clics-a.clics;}).slice(0,8);
    var withDelta = enriched.filter(function(r){ return r.dClics !== null; });
    var topGainClics = withDelta.filter(function(r){return r.dClics>0;}).sort(function(a,b){return b.dClics-a.dClics;}).slice(0,8);
    var topGainImpr  = withDelta.filter(function(r){return r.dImpr>0;}).sort(function(a,b){return b.dImpr-a.dImpr;}).slice(0,8);
    var topDropClics = withDelta.filter(function(r){return r.dClics<0;}).sort(function(a,b){return a.dClics-b.dClics;}).slice(0,8);
    var topDropImpr  = withDelta.filter(function(r){return r.dImpr<0;}).sort(function(a,b){return a.dImpr-b.dImpr;}).slice(0,8);

    function dCellHTML(val, fmt, inv){
      if (val === null || val === undefined) return '<td class="r gray">—</td>';
      if (Math.abs(val) < 0.05) return '<td class="r gray">=</td>';
      var good = inv ? val < 0 : val > 0;
      var magnitude = fmt ? fmt(Math.abs(val)) : Math.round(Math.abs(val)).toLocaleString();
      return '<td class="r"><span class="'+(good?'up':'dn')+'">'+(val>0?'↑':'↓')+magnitude+'</span></td>';
    }
    function pageRow(r, showDeltas, actionType){
      var url = r.url;
      var safeUrl = url.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      var focused = S.overviewFocusUrl === url;
      var deltas = showDeltas
        ? dCellHTML(r.dClics) + dCellHTML(r.dImpr, fmtK) + dCellHTML(r.dPos, function(v){return v.toFixed(1);}, true)
        : '';
      var actionHtml = '';
      if(actionType==='optimizar'){
        actionHtml='<td><button onclick="optimizarPagina(\''+safeUrl+'\')" style="font-size:10px;padding:3px 8px;background:#DC2626;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap">Optimizar</button></td>';
      } else if(actionType==='promocionar'){
        actionHtml='<td><button onclick="promoverPagina(\''+safeUrl+'\')" style="font-size:10px;padding:3px 8px;background:#059669;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap">Promocionar</button></td>';
      }
      return '<tr'+(focused?' style="background:#eff6ff"':'')+'>'+
        '<td style="width:28px;text-align:center;padding:4px">'+lupaBtnHTML(url)+'</td>'+
        '<td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(shortURL(url))+'</td>'+
        '<td class="r">'+Math.round(r.clics).toLocaleString()+'</td>'+
        '<td class="r">'+fmtK(r.impr)+'</td>'+
        '<td class="r">'+r.ctr+'</td>'+
        '<td class="r"><span class="'+posColor(r.pos)+'">'+r.pos.toFixed(1)+'</span><span class="pill '+posClass(r.pos)+'">'+posLbl(r.pos)+'</span></td>'+
        deltas+
        actionHtml+'</tr>';
    }
    function pageTable(rows, showDeltas, actionType, paretoIdx){
      if(!rows.length) return '<div class="insight info" style="margin-top:8px">No hay datos para este período.</div>';
      var deltaTh = showDeltas ? '<th class="r">Δ clics</th><th class="r">Δ impr.</th><th class="r">Δ pos</th>' : '';
      var actionTh = actionType ? '<th></th>' : '';
      var colCount = 6 + (showDeltas?3:0) + (actionType?1:0);
      var rowHtml = '';
      rows.forEach(function(r, i) {
        rowHtml += pageRow(r, showDeltas, actionType);
        if (paretoIdx && i === paretoIdx - 1 && paretoIdx < rows.length) {
          rowHtml += paretoSepRow(colCount, rows.length - paretoIdx);
        }
      });
      return '<div class="panel-table" style="margin-top:8px"><table>'+
        '<thead><tr><th style="width:28px"></th><th>Página</th><th class="r">Clics</th><th class="r">Impr.</th><th class="r">CTR</th><th class="r">Posición</th>'+deltaTh+actionTh+'</tr></thead>'+
        '<tbody>'+rowHtml+'</tbody></table></div>';
    }

    // Horizontal bar chart — per-URL Δ clicks (used for Crecimiento / Caídas)
    function deltaBarChart(rows, color, label, actionType){
      if (!rows.length) return '<p style="font-size:11px;color:#94A3B8;padding:20px 0;text-align:center">Sin páginas que '+label+' en este período.</p>';
      var maxAbs = Math.max.apply(null, rows.map(function(r){ return Math.abs(r.dClics); }));
      if (!maxAbs) maxAbs = 1;
      return '<div style="padding:6px 0">' + rows.map(function(r){
        var v = Math.abs(r.dClics);
        var w = (v / maxAbs * 100);
        var sign = r.dClics >= 0 ? '+' : '−';
        var safeUrl = esc(r.url).replace(/'/g, '&#39;');
        var actionBtn = '';
        if (actionType === 'promocionar') {
          actionBtn = '<button onclick="promoverPagina(\''+safeUrl+'\')" style="flex:0 0 auto;font-size:10px;font-weight:700;padding:4px 10px;border:none;border-radius:6px;background:#059669;color:#fff;cursor:pointer;letter-spacing:.2px">Promocionar</button>';
        } else if (actionType === 'optimizar') {
          actionBtn = '<button onclick="optimizarPagina(\''+safeUrl+'\')" style="flex:0 0 auto;font-size:10px;font-weight:700;padding:4px 10px;border:none;border-radius:6px;background:#DC2626;color:#fff;cursor:pointer;letter-spacing:.2px">Optimizar</button>';
        }
        return '<div style="display:flex;align-items:center;gap:10px;margin:5px 0">'+
          '<div style="flex:0 0 240px;font-size:11px;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.url)+'">'+esc(shortURL(r.url))+'</div>'+
          '<div style="flex:1;background:#F1F5F9;border-radius:3px;height:18px;position:relative;min-width:60px">'+
            '<div style="background:'+color+';height:100%;border-radius:3px;width:'+w.toFixed(1)+'%;transition:width .25s"></div>'+
          '</div>'+
          '<div style="flex:0 0 72px;font-size:11px;font-weight:700;color:'+color+';text-align:right">'+sign+Math.round(v).toLocaleString()+' clics</div>'+
          actionBtn+
        '</div>';
      }).join('') + '</div>';
    }

    var ovSec = S.overviewSection || 'top';

    // ── Chart data ──
    var td = usingDirect ? aggregateByWeek(S.gscData.grafico || []) : buildTrendData(filteredSnaps());
    var ctd = usingDirect
      ? (S.gscCompareData ? aggregateByWeek(S.gscCompareData.grafico || []) : [])
      : (compareSnaps().length ? buildTrendData(compareSnaps()) : []);

    // ── Large section cards ──
    function secCard(key, color, iconPath, label, statVal, desc) {
      var active = ovSec === key;
      var bg   = active ? color : '#fff';
      var bdr  = active ? color : '#E2E8F0';
      var txtC = active ? '#fff' : '#0F172A';
      var subC = active ? 'rgba(255,255,255,.8)' : '#64748B';
      var stC  = active ? '#fff' : color;
      return '<div onclick="S.overviewSection=\''+key+'\';render()" style="background:'+bg+';border:2px solid '+bdr+
        ';border-radius:14px;padding:20px 22px;cursor:pointer;box-shadow:'+(active?'0 6px 18px '+color+'40':'0 1px 3px rgba(0,0,0,.06)')+';transition:all .15s">'+
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+
          '<div style="width:34px;height:34px;background:'+(active?'rgba(255,255,255,.22)':color+'18')+
            ';border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
            '<svg viewBox="0 0 24 24" style="width:17px;height:17px;fill:none;stroke:'+(active?'#fff':color)+
            ';stroke-width:2;stroke-linecap:round;stroke-linejoin:round">'+iconPath+'</svg>'+
          '</div>'+
          '<span style="font-weight:700;font-size:14px;color:'+txtC+'">'+label+'</span>'+
        '</div>'+
        '<div style="font-size:28px;font-weight:800;color:'+stC+';letter-spacing:-.5px;line-height:1;margin-bottom:6px">'+statVal+'</div>'+
        '<p style="font-size:11px;color:'+subC+';margin:0;line-height:1.45">'+desc+'</p>'+
      '</div>';
    }

    content += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px">';
    content += secCard('top', '#E85249',
      '<line x1="18" y1="20" x2="18" y2="4"/><line x1="12" y1="20" x2="12" y2="10"/><line x1="6" y1="20" x2="6" y2="14"/>',
      'Top páginas', fmtK(curM.clics)+' clics',
      pages.length+' páginas · '+(usingDirect ? activeRangeLbl : 'período actual'));
    content += secCard('gained', '#059669',
      '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
      'Crecimiento', prev ? (topGainClics.length ? '+'+topGainClics.length : '—') : '—',
      prev ? topGainClics.length+' páginas ganaron clics vs '+prevLabel : 'Activa comparación de período para ver crecimiento');
    content += secCard('lost', '#DC2626',
      '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
      'Caídas', prev ? (topDropClics.length ? '-'+topDropClics.length : '—') : '—',
      prev ? topDropClics.length+' páginas perdieron clics vs '+prevLabel : 'Activa comparación de período para ver caídas');
    content += '</div>';

    // ── Chart (adapts to selected section) ──
    (function() {
      function padTo(arr, len) { var a=arr.slice(); while(a.length<len) a.unshift(null); return a; }
      var hasFocus = !!S.overviewFocusUrl;

      // URL-focus mode (lupa pressed) — applies to any section
      if (hasFocus) {
        if (usingDirect && !S.overviewFocusData) {
          fetchURLFocus(S.overviewFocusUrl);
          content += '<div class="panel" style="padding:1rem 1.2rem 0.6rem"><p style="font-size:10px;color:#aaa;padding:4px 0 6px">Cargando tendencia de URL…</p></div>';
          return;
        }
        var focusRows = usingDirect ? aggregateByWeek(S.overviewFocusData || []) : [];
        var ut = usingDirect ? focusRows : buildURLTrend(S.overviewFocusUrl, filteredSnaps());
        if (!ut.length) return;
        var fLabels = ut.map(function(d){ return d.label; });
        var fSeries = [
          { label:'Clics', values: ut.map(function(d){ return d.clics; }), color:'#E85249' },
          { label:'Impr.', values: ut.map(function(d){ return d.impr;  }), color:'#059669', dashed:true }
        ];
        content += '<div class="panel" style="padding:1rem 1.2rem 0.6rem">';
        if (fLabels.length >= 2) content += svgLineChart(fLabels, fSeries, { height:200 });
        content += '<div style="display:flex;align-items:center;gap:10px;padding:4px 0 6px">'+
          '<span style="font-size:10px;color:#E85249;font-weight:600">'+esc(shortURL(S.overviewFocusUrl))+'</span>'+
          '<button onclick="S.overviewFocusUrl=null;S.overviewFocusData=null;render()" style="font-size:10px;padding:2px 8px;border:1px solid #ddd;border-radius:12px;background:transparent;cursor:pointer;color:#666">× Total sitio</button>'+
          '</div></div>';
        return;
      }

      // ── Top páginas: site-wide trend ──
      if (ovSec === 'top') {
        if (td.length < 2) return;
        var tLabels = td.map(function(d){ return d.label; });
        var tSeries = [
          { label:'Clics',       values: td.map(function(d){ return d.clics; }), color:'#E85249' },
          { label:'Impresiones', values: td.map(function(d){ return d.impr;  }), color:'#059669', dashed:true },
          { label:'Posición',    values: td.map(function(d){ return d.pos;   }), color:'#94A3B8', yRight:true }
        ];
        if (ctd.length >= 1) {
          var maxLen = Math.max(tLabels.length, ctd.length);
          tLabels = padTo(td.map(function(d){ return d.label; }), maxLen);
          tSeries = [
            { label:'Clics',        values: padTo(td.map(function(d){return d.clics;}),  maxLen), color:'#E85249' },
            { label:'Impresiones',  values: padTo(td.map(function(d){return d.impr;}),   maxLen), color:'#059669', dashed:true },
            { label:'Clics (ant.)', values: padTo(ctd.map(function(d){return d.clics;}), maxLen), color:'rgba(232,82,73,0.35)' },
            { label:'Impr. (ant.)', values: padTo(ctd.map(function(d){return d.impr;}),  maxLen), color:'rgba(5,150,105,0.35)', dashed:true }
          ];
        }
        content += '<div class="panel" style="padding:1rem 1.2rem 0.6rem">';
        content += svgLineChart(tLabels, tSeries, { height:200, invertRight:true });
        content += '<p style="font-size:10px;color:#aaa;padding:4px 0 6px">Posición: eje derecho — valores más bajos = mejor ranking</p>';
        content += '</div>';
        return;
      }

      // ── Gained / Lost: horizontal bar chart por URL ──
      if (ovSec === 'gained' || ovSec === 'lost') {
        if (!prev) return;
        var rows = ovSec === 'gained' ? topGainClics : topDropClics;
        var color = ovSec === 'gained' ? '#059669' : '#DC2626';
        var title = ovSec === 'gained' ? 'Top páginas con más clics ganados' : 'Top páginas con más clics perdidos';
        var verb  = ovSec === 'gained' ? 'crecieron' : 'cayeron';
        var barAction = ovSec === 'gained' ? 'promocionar' : 'optimizar';
        content += '<div class="panel" style="padding:1rem 1.2rem 0.8rem">'+
          '<p style="font-size:11px;font-weight:700;color:'+color+';margin:0 0 10px;letter-spacing:.2px">'+title+'</p>'+
          deltaBarChart(rows, color, verb, barAction)+
          '<p style="font-size:10px;color:#94A3B8;padding:6px 0 2px;margin:0">vs '+esc(prevLabel)+'</p>'+
          '</div>';
      }
    })();

    // ── Per-section KPI row ──
    function miniStat(label, value, sub, color) {
      return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;flex:1;min-width:0">'+
        '<p style="font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:.4px;margin:0 0 4px;font-weight:600">'+label+'</p>'+
        '<p style="font-size:20px;font-weight:800;color:'+(color||'#0F172A')+';margin:0 0 2px;letter-spacing:-.5px;line-height:1.1">'+value+'</p>'+
        '<p style="font-size:10px;color:#94A3B8;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+sub+'</p>'+
        '</div>';
    }
    var statsRow = '';
    if (ovSec === 'top') {
      var topSum = topClics.reduce(function(a,r){ return a + r.clics; }, 0);
      var totalClics = enriched.reduce(function(a,r){ return a + r.clics; }, 0);
      var share = totalClics ? Math.round(topSum / totalClics * 100) : 0;
      var topImpr = topClics.reduce(function(a,r){ return a + r.impr; }, 0);
      var avgCTR = topImpr ? (topSum / topImpr * 100) : 0;
      var avgPos = topClics.length ? (topClics.reduce(function(a,r){ return a + r.pos; }, 0) / topClics.length) : 0;
      statsRow =
        miniStat('Clics del Top '+topClics.length, Math.round(topSum).toLocaleString(), share+'% del tráfico total', '#E85249') +
        miniStat('Impresiones del Top', fmtK(topImpr), 'Acumulado en '+topClics.length+' páginas', '#059669') +
        miniStat('CTR promedio Top', avgCTR.toFixed(2)+'%', 'Eficiencia al convertir impresiones', '#F59E0B') +
        miniStat('Posición media Top', avgPos.toFixed(1), avgPos <= 10 ? 'Página 1 de Google' : (avgPos <= 20 ? 'Página 2' : 'Más allá de pág. 2'), '#64748B');
    } else if (ovSec === 'gained' && prev) {
      var gainSumClics = topGainClics.reduce(function(a,r){ return a + r.dClics; }, 0);
      var gainSumImpr  = topGainImpr.reduce(function(a,r){ return a + r.dImpr; }, 0);
      var best = topGainClics[0];
      var gainPct = withDelta.length ? Math.round(withDelta.filter(function(r){return r.dClics>0;}).length / withDelta.length * 100) : 0;
      statsRow =
        miniStat('Δ clics ganados', '+'+Math.round(gainSumClics).toLocaleString(), 'Top '+topGainClics.length+' páginas que más crecieron', '#059669') +
        miniStat('Δ impresiones ganadas', '+'+fmtK(gainSumImpr), 'Top '+topGainImpr.length+' páginas en impresiones', '#059669') +
        miniStat('Mejor ganadora', best ? '+'+Math.round(best.dClics).toLocaleString()+' clics' : '—', best ? shortURL(best.url) : 'sin datos', '#059669') +
        miniStat('% páginas que crecieron', gainPct+'%', withDelta.length+' páginas con datos comparables', '#059669');
    } else if (ovSec === 'lost' && prev) {
      var lostSumClics = topDropClics.reduce(function(a,r){ return a + r.dClics; }, 0);
      var lostSumImpr  = topDropImpr.reduce(function(a,r){ return a + r.dImpr; }, 0);
      var worst = topDropClics[0];
      var lostPct = withDelta.length ? Math.round(withDelta.filter(function(r){return r.dClics<0;}).length / withDelta.length * 100) : 0;
      statsRow =
        miniStat('Δ clics perdidos', Math.round(lostSumClics).toLocaleString(), 'Top '+topDropClics.length+' páginas que más cayeron', '#DC2626') +
        miniStat('Δ impresiones perdidas', fmtK(lostSumImpr), 'Top '+topDropImpr.length+' páginas en impresiones', '#DC2626') +
        miniStat('Peor caída', worst ? Math.round(worst.dClics).toLocaleString()+' clics' : '—', worst ? shortURL(worst.url) : 'sin datos', '#DC2626') +
        miniStat('% páginas que cayeron', lostPct+'%', withDelta.length+' páginas con datos comparables', '#DC2626');
    }
    if (statsRow) {
      content += '<div style="display:flex;gap:10px;margin:14px 0">'+statsRow+'</div>';
    }

    // ── Table per selected section ──
    if(ovSec==='top'){
      var pTop = paretoSplit(topClics, function(r){ return r.clics; });
      if(pTop.count > 0 && pages.length > 0) content += paretoBadge(pTop.count, pages.length);
      content += pageTable(topClics, !!prev, null, pTop.count);
    } else if(ovSec==='gained'){
      if(!prev){
        content += '<div class="insight info" style="margin-top:8px">Activa la comparación de período (botón de calendario arriba) para ver qué páginas están creciendo.</div>';
      } else {
        var pGain = paretoSplit(topGainClics, function(r){ return r.dClics; });
        content += pageTable(topGainClics, true, 'promocionar', pGain.count);
      }
    } else if(ovSec==='lost'){
      if(!prev){
        content += '<div class="insight info" style="margin-top:8px">Activa la comparación de período (botón de calendario arriba) para ver qué páginas están cayendo.</div>';
      } else {
        content += pageTable(topDropClics, true, 'optimizar');
      }
    }
  }

  // ── TRANSACCIONALES ──
  if(S.tab==='transaccionales'){
    var svcP=((cur&&cur.data?cur.data.paginas:[])||[]).filter(function(r){return isSvc(r['Páginas principales']||'');});
    var paidQ=((cur&&cur.data?cur.data.consultas:[])||[]).filter(function(r){return isPaid(r['Consultas principales']||'');});
    var fPP=function(url){if(!prev)return null;var f=((prev&&prev.data?prev.data.paginas:[])||[]).find(function(r){return(r['Páginas principales']||'')===url;});return f?pP(f['Posición']):null;};
    var fPQ=function(q){if(!prev)return null;var f=((prev&&prev.data?prev.data.consultas:[])||[]).find(function(r){return(r['Consultas principales']||'').toLowerCase()===q.toLowerCase();});return f?pP(f['Posición']):null;};

    content+='<p class="sec-lbl">Páginas de servicio ('+svcP.length+')</p>';
    content+=!svcP.length?'<div class="insight info">Carga Páginas.csv.</div>':
      '<div class="panel-table"><table><thead><tr><th>Página</th><th class="r">Clics</th><th class="r">Impr.</th><th class="r">CTR</th><th class="r">Posición</th><th class="r">Δ</th></tr></thead><tbody>'+
      svcP.map(function(r){var url=r['Páginas principales']||'';var pos=pP(r['Posición']);return'<tr><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(shortURL(url))+'</td><td class="r">'+r.Clics+'</td><td class="r">'+r.Impresiones+'</td><td class="r">'+r.CTR+'</td><td class="r"><span class="'+posColor(pos)+'">'+pos.toFixed(1)+'</span><span class="pill '+posClass(pos)+'">'+posLbl(pos)+'</span></td><td class="r">'+deltaHTML(pos,fPP(url))+'</td></tr>';}).join('')+
      '</tbody></table></div>';

    content+='<p class="sec-lbl">Consultas transaccionales ('+paidQ.length+')</p>';
    content+=!paidQ.length?'<div class="insight info">Carga Consultas.csv.</div>':
      '<div class="panel-table"><table><thead><tr><th>Consulta</th><th class="r">Clics</th><th class="r">Impr.</th><th class="r">CTR</th><th class="r">Posición</th><th class="r">Δ</th></tr></thead><tbody>'+
      paidQ.map(function(r){var q=r['Consultas principales']||'';var pos=pP(r['Posición']);return'<tr><td>'+esc(q)+'</td><td class="r">'+r.Clics+'</td><td class="r">'+r.Impresiones+'</td><td class="r">'+r.CTR+'</td><td class="r"><span class="'+posColor(pos)+'">'+pos.toFixed(1)+'</span></td><td class="r">'+deltaHTML(pos,fPQ(q))+'</td></tr>';}).join('')+
      '</tbody></table></div>';
  }

  // ── OPORTUNIDADES ──
  if(S.tab==='oportunidades'){
    var opp=analyzeOpp(cur);
    content+='<div class="opp-grid">'+
      '<div class="opp-card"><h3>Quick wins</h3><div class="opp-num">'+opp.quickwins.length+'</div><div class="opp-desc">Pos 11–20 · impresiones pero 0 clics</div></div>'+
      '<div class="opp-card"><h3>Snippet roto</h3><div class="opp-num">'+opp.ctrGap.length+'</div><div class="opp-desc">Pág. 1–2 · CTR = 0%</div></div>'+
      '<div class="opp-card"><h3>Transaccionales invisibles</h3><div class="opp-num">'+opp.paidGap.length+'</div><div class="opp-desc">Páginas de servicio fuera de pág. 2</div></div>'+
    '</div>';

    var actions=[
      opp.paidGap.length&&{c:'red',t:'Reescribir snippets de páginas de servicio',d:'Las páginas de '+opp.paidGap.slice(0,2).map(function(r){return shortURL(r['Páginas principales']||'');}).join(', ')+' tienen impresiones pero CTR casi cero.',a:'Reescribir title: [Servicio] Lima · Lima Retail | meta desc: incluir resultado concreto o prueba social.'},
      opp.quickwins.length&&{c:'red',t:'Optimizar contenido para consultas en pág. 2 con volumen',d:'Consultas como '+opp.quickwins.slice(0,2).map(function(r){return'"'+r['Consultas principales']+'"';}).join(', ')+' tienen exposición pero no generan clics.',a:'Mejorar H1, enriquecer con datos actuales, revisar que la intención de búsqueda coincida con el contenido.'},
      {c:'amber',t:'Crear cluster de contenido para Meta/Google/TikTok Ads',d:'Las páginas de servicio están lejos porque no tienen artículos de soporte.',a:'Publicar 2–3 artículos por plataforma con casos reales. Enlazar internamente a la página de servicio.'},
      opp.ctrGap.length&&{c:'amber',t:'Corregir snippets en pág. 1 con 0 clics',d:opp.ctrGap.length+' consultas en primeras posiciones no generan ningún clic.',a:'Revisar títulos truncados en mobile, desalineación entre intención y snippet.'},
      {c:'blue',t:'Agregar CTAs de servicio en artículos de alto tráfico',d:'El 77% del tráfico viene de contenido editorial sin relación con servicios.',a:'Insertar bloque de CTA en artículos de fechas/redes sociales: "¿Quieres publicidad en estas fechas? → Meta Ads con Lima Retail".'}
    ].filter(Boolean);

    content+='<p class="sec-lbl">Acciones prioritarias</p><div class="panel">'+
      actions.map(function(a,i){return'<div class="priority-row"><div class="pnum '+a.c+'">'+(i+1)+'</div><div><div class="priority-title">'+esc(a.t)+'</div><div class="priority-detail">'+esc(a.d)+'</div><div class="priority-action">→ '+esc(a.a)+'</div></div></div>';}).join('')+'</div>';

    if(opp.quickwins.length){content+='<p class="sec-lbl">Quick wins</p><div class="panel-table"><table><thead><tr><th>Consulta</th><th class="r">Impr.</th><th class="r">Posición</th><th>Acción</th></tr></thead><tbody>'+opp.quickwins.map(function(r){var pos=pP(r['Posición']);return'<tr><td>'+esc(r['Consultas principales']||'')+'</td><td class="r">'+r.Impresiones+'</td><td class="r"><span class="am">'+pos.toFixed(1)+'</span></td><td style="font-size:11px;color:var(--brand)">Mejorar snippet + contenido</td></tr>';}).join('')+'</tbody></table></div>';}
    if(opp.paidZero.length){content+='<p class="sec-lbl">Transaccionales con impresiones pero 0 clics</p><div class="panel-table"><table><thead><tr><th>Consulta</th><th class="r">Impr.</th><th class="r">Posición</th></tr></thead><tbody>'+opp.paidZero.map(function(r){var pos=pP(r['Posición']);return'<tr><td>'+esc(r['Consultas principales']||'')+'</td><td class="r">'+r.Impresiones+'</td><td class="r"><span class="'+posColor(pos)+'">'+pos.toFixed(1)+'</span></td></tr>';}).join('')+'</tbody></table></div>';}
  }

  // ── VARIACIÓN ──
  if(S.tab==='variación'){
    if(!prev){content+='<div class="insight info" style="text-align:center;padding:2rem">Necesitas al menos 2 snapshots para ver variación.</div>';}
    else{
      var varD=analyzeVar(cur,prev);
      var gained=varD.filter(function(v){return v.dPos<-1;}).slice(0,15);
      var lost=varD.filter(function(v){return v.dPos>1;}).slice(0,15);
      var dM=calcM(cur),pM2=calcM(prev);
      var varIcons = [
        '<svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>',
        '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
        '<svg viewBox="0 0 24 24"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
        '<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.4 11.5 7.7 11.8a.5.5 0 0 0 .6 0C12.6 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/></svg>'
      ];
      var varIconCls = ['blue','green','amber','slate'];
      content+='<div class="kpi-grid">'+['Clics','Impresiones','CTR %','Posición'].map(function(lbl,i){
        var vals=[[dM.clics,pM2.clics],[dM.impr,pM2.impr],[dM.ctr,pM2.ctr],[dM.pos,pM2.pos]];
        var cv=vals[i][0],pv=vals[i][1];var d=cv-pv;var inv=(i===3);var good=inv?d<0:d>0;
        var fmt=[function(v){return Math.round(v).toLocaleString();},fmtK,function(v){return v.toFixed(2);},function(v){return v.toFixed(1);}];
        var sfx=['','','%',''];
        return'<div class="kpi-card">'+
          '<div class="kpi-icon '+varIconCls[i]+'">'+varIcons[i]+'</div>'+
          '<div class="kpi-lbl">'+lbl+'</div>'+
          '<div class="kpi-val">'+fmt[i](cv)+sfx[i]+'</div>'+
          '<div class="kpi-delta"><span class="'+(good?'up':'dn')+'">'+(good?'↑':'↓')+' '+fmt[i](Math.abs(d))+sfx[i]+'</span> vs '+esc(prevLabel)+'</div>'+
        '</div>';
      }).join('')+'</div>';

      // Trend chart in variación tab
      var vtd2 = usingDirect ? aggregateByWeek(S.gscData.grafico || []) : buildTrendData();
      var ctd2 = usingDirect ? (S.gscCompareData ? aggregateByWeek(S.gscCompareData.grafico || []) : []) : [];
      if(vtd2.length >= 2) {
        var vtLabels = vtd2.map(function(d){ return d.label; });
        var vtSeries = [
          { label:'Clics',       values: vtd2.map(function(d){ return d.clics; }), color:'#E85249' },
          { label:'Impresiones', values: vtd2.map(function(d){ return d.impr;  }), color:'#059669', dashed:true },
          { label:'Posición',    values: vtd2.map(function(d){ return d.pos;   }), color:'#DC2626', yRight:true }
        ];
        if (ctd2.length >= 1) {
          vtSeries.push({ label:'Clics (ant.)',  values: ctd2.map(function(d){return d.clics;}), color:'rgba(232,82,73,0.4)' });
          vtSeries.push({ label:'Impr. (ant.)',  values: ctd2.map(function(d){return d.impr;}),  color:'rgba(5,150,105,0.4)', dashed:true });
        }
        content += '<div class="panel" style="padding:1rem 1.2rem 0.6rem">';
        content += svgLineChart(vtLabels, vtSeries, { height:200, invertRight:true });
        content += '<p style="font-size:10px;color:var(--muted);padding:4px 0 6px">Posición: eje derecho — valores más bajos = mejor ranking</p>';
        content += '</div>';
      }

      function varTable(rows,title,up){
        if(!rows.length)return'<p class="sec-lbl">'+title+' (ninguno)</p><div class="insight info">Sin movimientos significativos.</div>';
        return'<p class="sec-lbl">'+title+' ('+rows.length+')</p><div class="panel-table"><table><thead><tr><th>URL / Consulta</th><th class="r">Ant.</th><th class="r">Act.</th><th class="r">Δ pos</th><th class="r">Clics</th><th class="r">Δ clics</th></tr></thead><tbody>'+rows.map(function(v){var badge=v.isPaid?'<span class="dot dot-blue"></span>':v.isSvc?'<span class="dot dot-amber"></span>':'';var dc=v.dClics>=0?'<span class="up">+'+Math.round(v.dClics)+'</span>':'<span class="dn">'+Math.round(v.dClics)+'</span>';return'<tr><td>'+badge+esc(v.label)+'</td><td class="r gray">'+v.posPrev.toFixed(1)+'</td><td class="r"><span class="'+posColor(v.posNow)+'">'+v.posNow.toFixed(1)+'</span></td><td class="r">'+(up?'<span class="up">↑'+Math.abs(v.dPos).toFixed(1)+'</span>':'<span class="dn">↓'+v.dPos.toFixed(1)+'</span>')+'</td><td class="r">'+Math.round(v.clicsNow)+'</td><td class="r">'+dc+'</td></tr>';}).join('')+'</tbody></table></div>';
      }
      content+=varTable(gained,'Mejoraron posición ↑',true)+varTable(lost,'Perdieron posición ↓',false);
      content+='<p style="font-size:10px;color:#aaa;margin-top:8px"><span class="dot dot-blue"></span>consultas transaccionales &nbsp;<span class="dot dot-amber"></span>página de servicio</p>';
    }
  }

  // ── ARTÍCULOS BLOG ──
  if(S.tab==='seguimiento'){
    content += urlFocusChartHTML();
    var allPages  = (cur&&cur.data?cur.data.paginas:[]) || [];
    var blogPages = allPages.filter(function(r){ return isBlogArticle(r['Páginas principales']||''); })
                            .sort(function(a,b){ return pN(b.Clics)-pN(a.Clics); });
    var prevPages2 = prev ? ((prev&&prev.data?prev.data.paginas:[]) || []) : [];

    if(!blogPages.length){
      content+='<div class="insight info">No hay artículos de blog en este período.</div>';
    } else {
      var pBlog = paretoSplit(blogPages, function(r){ return pN(r.Clics); });
      content += paretoBadge(pBlog.count, blogPages.length);
      var colsBlog = 6 + (prev ? 3 : 0); // +lupa +Δclics +Δimpr +Δpos
      var blogRowsHtml = '';
      blogPages.forEach(function(r, i){
        var url   = r['Páginas principales'] || '';
        var pos   = pP(r['Posición']);
        var clics = pN(r.Clics);
        var impr  = pN(r.Impresiones);
        var focused = S.overviewFocusUrl === url;
        var deltaHtml = '';
        if(prev){
          var pr = prevPages2.find(function(x){ return (x['Páginas principales']||'')===url; });
          function dCell(val, prev_val, fmt, inv) {
            if(!pr) return '<td class="r gray">—</td>';
            var d = val - prev_val;
            var good = inv ? d < 0 : d > 0;
            if(Math.abs(d) < 0.05) return '<td class="r gray">=</td>';
            return '<td class="r"><span class="'+(good?'up':'dn')+'">'+(d>0?'↑':'↓')+(fmt?fmt(Math.abs(d)):Math.round(Math.abs(d)).toLocaleString())+'</span></td>';
          }
          deltaHtml = dCell(clics, pr?pN(pr.Clics):0) +
                      dCell(impr,  pr?pN(pr.Impresiones):0, fmtK) +
                      dCell(pos,   pr?pP(pr['Posición']):0, function(v){return v.toFixed(1);}, true);
        }
        blogRowsHtml+='<tr'+(focused?' style="background:#eff6ff"':'')+'>'+
          '<td style="width:28px;text-align:center;padding:4px">'+lupaBtnHTML(url)+'</td>'+
          '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(shortURL(url))+'</td>'+
          '<td class="r">'+Math.round(clics).toLocaleString()+'</td>'+
          '<td class="r">'+fmtK(impr)+'</td>'+
          '<td class="r">'+r.CTR+'</td>'+
          '<td class="r"><span class="'+posColor(pos)+'">'+pos.toFixed(1)+'</span><span class="pill '+posClass(pos)+'">'+posLbl(pos)+'</span></td>'+
          deltaHtml+
        '</tr>';
        if(i===pBlog.count-1 && pBlog.count<blogPages.length) blogRowsHtml+=paretoSepRow(colsBlog, blogPages.length-pBlog.count);
      });

      content+='<div class="panel-table"><table><thead><tr>'+
        '<th style="width:28px"></th>'+
        '<th>Artículo</th>'+
        '<th class="r">Clics</th>'+
        '<th class="r">Impr.</th>'+
        '<th class="r">CTR</th>'+
        '<th class="r">Posición</th>'+
        (prev?'<th class="r">Δ clics</th><th class="r">Δ impr.</th><th class="r">Δ pos</th>':'')+
      '</tr></thead><tbody>'+blogRowsHtml+'</tbody></table></div>';
      content+='<p style="font-size:10px;color:#aaa;margin-top:6px">'+blogPages.length+' artículos detectados (URLs con 2+ segmentos de ruta)</p>';
    }
  }

  // ── IDEAS ──
  if(S.tab==='ideas'){
    var Q = (cur&&cur.data?cur.data.consultas:[]) || [];
    var P = (cur&&cur.data?cur.data.paginas:[])   || [];

    var clusterIdeas = Q.filter(function(r){
      return pN(r.Impresiones)>=100 && pP(r['Posición'])>20 && pN(r.Clics)===0 && !isPaid(r['Consultas principales']||'');
    }).sort(function(a,b){ return pN(b.Impresiones)-pN(a.Impresiones); }).slice(0,12);

    var rankBoost = Q.filter(function(r){
      var pos=pP(r['Posición']), impr=pN(r.Impresiones);
      return pos>=11 && pos<=30 && impr>=50 && !isPaid(r['Consultas principales']||'');
    }).sort(function(a,b){ return pN(b.Impresiones)-pN(a.Impresiones); }).slice(0,12);

    var trafficBridge = Q.filter(function(r){
      return pN(r.Clics)>=2 && !isPaid(r['Consultas principales']||'');
    }).sort(function(a,b){ return pN(b.Clics)-pN(a.Clics); }).slice(0,10);

    var serviceGaps = P.filter(function(r){
      return isSvc(r['Páginas principales']||'') && pN(r.Impresiones)<200;
    }).sort(function(a,b){ return pN(b.Impresiones)-pN(a.Impresiones); });

    content += '<div style="background:#E6F1FB;border:1px solid #B5D4F4;border-radius:10px;padding:1rem 1.2rem;margin-bottom:1rem">' +
      '<p style="font-size:12px;color:var(--brand);font-weight:500;margin-bottom:4px">Cómo usar este tab</p>' +
      '<p style="font-size:11px;color:#374f6b;line-height:1.6">Cada sección identifica una brecha diferente entre lo que Google ya asocia a Lima Retail y lo que las páginas de servicio necesitan para posicionarse. Los temas sugeridos son artículos de <b>cluster</b>: contenido editorial que apunta internamente a la página de servicio y le transfiere autoridad.</p>' +
    '</div>';

    content += '<p class="sec-lbl">A · Temas con demanda que el sitio aún no cubre bien' +
      '<span style="font-size:10px;font-weight:400;color:#aaa"> — impresiones altas, posición > 20, 0 clics</span></p>';
    if(!clusterIdeas.length){
      content += '<div class="insight info">Sin datos suficientes. Carga más snapshots.</div>';
    } else {
      content += '<div class="panel-table"><table>' +
        '<thead><tr><th>Consulta detectada</th><th class="r">Impr.</th><th class="r">Pos.</th><th>Idea de artículo</th><th>Apunta a</th></tr></thead><tbody>';
      clusterIdeas.forEach(function(r){
        var q = r['Consultas principales'] || '';
        var pos = pP(r['Posición']);
        content += '<tr><td>'+esc(q)+'</td><td class="r">'+r.Impresiones+'</td>'+
          '<td class="r"><span class="dn">'+pos.toFixed(1)+'</span></td>'+
          '<td style="font-size:11px;color:var(--brand);font-style:italic">'+esc(generateIdea(q,'cluster'))+'</td>'+
          '<td style="font-size:11px;color:#888">'+esc(suggestTarget(q))+'</td></tr>';
      });
      content += '</tbody></table></div>';
    }

    content += '<p class="sec-lbl">B · Temas en pág. 2–3 que un artículo enfocado puede llevar a pág. 1' +
      '<span style="font-size:10px;font-weight:400;color:#aaa"> — pos 11–30, impresiones ≥ 50</span></p>';
    if(!rankBoost.length){
      content += '<div class="insight info">Sin datos.</div>';
    } else {
      content += '<div class="panel-table"><table>' +
        '<thead><tr><th>Consulta</th><th class="r">Impr.</th><th class="r">Pos.</th><th>Acción recomendada</th></tr></thead><tbody>';
      rankBoost.forEach(function(r){
        var q = r['Consultas principales'] || '';
        var pos = pP(r['Posición']);
        content += '<tr><td>'+esc(q)+'</td><td class="r">'+r.Impresiones+'</td>'+
          '<td class="r"><span class="am">'+pos.toFixed(1)+'</span></td>'+
          '<td style="font-size:11px;color:var(--brand);font-style:italic">'+esc(generateIdea(q,'rankboost'))+'</td></tr>';
      });
      content += '</tbody></table></div>';
    }

    content += '<p class="sec-lbl">C · Consultas que ya convierten clicks — crear puente hacia servicios' +
      '<span style="font-size:10px;font-weight:400;color:#aaa"> — tráfico real que no llega a páginas transaccionales</span></p>';
    if(!trafficBridge.length){
      content += '<div class="insight info">Sin datos.</div>';
    } else {
      content += '<div class="panel-table"><table>' +
        '<thead><tr><th>Consulta</th><th class="r">Clics</th><th class="r">Impr.</th><th>Qué hacer</th></tr></thead><tbody>';
      trafficBridge.forEach(function(r){
        var q = r['Consultas principales'] || '';
        content += '<tr><td>'+esc(q)+'</td><td class="r up">'+r.Clics+'</td><td class="r">'+r.Impresiones+'</td>'+
          '<td style="font-size:11px;color:var(--brand);font-style:italic">Agregar CTA interno hacia la página de servicio más relevante</td></tr>';
      });
      content += '</tbody></table></div>';
    }

    content += '<p class="sec-lbl">D · Páginas de servicio con pocas impresiones — necesitan artículos de soporte</p>';
    if(!serviceGaps.length){
      content += '<div class="insight info">Todas las páginas de servicio tienen impresiones suficientes.</div>';
    } else {
      content += '<div class="panel-table"><table>' +
        '<thead><tr><th>Página de servicio</th><th class="r">Impr.</th><th class="r">Pos.</th><th>Artículos de soporte sugeridos</th></tr></thead><tbody>';
      serviceGaps.forEach(function(r){
        var url = r['Páginas principales'] || '';
        var pos = pP(r['Posición']);
        content += '<tr><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(shortURL(url))+'</td>'+
          '<td class="r dn">'+r.Impresiones+'</td>'+
          '<td class="r"><span class="'+posColor(pos)+'">'+pos.toFixed(1)+'</span></td>'+
          '<td style="font-size:11px;color:var(--brand);font-style:italic">'+esc(suggestSupportArticles(url))+'</td></tr>';
      });
      content += '</tbody></table></div>';
    }
  }

  // ── CONSULTAS ──
  if(S.tab==='consultas'){
    var allQ=((cur&&cur.data?cur.data.consultas:[])||[]).filter(function(r){return!S.qFilter||(r['Consultas principales']||'').toLowerCase().includes(S.qFilter.toLowerCase());}).slice(0,30);
    content+='<input id="q-filter" value="'+esc(S.qFilter)+'" placeholder="Filtrar consultas..." style="width:100%;margin-bottom:10px;padding:6px 10px">';
    content+='<div class="panel-table"><table><thead><tr><th>Consulta</th><th class="r">Clics</th><th class="r">Impr.</th><th class="r">CTR</th><th class="r">Posición</th></tr></thead><tbody>'+
      allQ.map(function(r){var q=r['Consultas principales']||'';var pos=pP(r['Posición']);var paid=isPaid(q);return'<tr style="background:'+(paid?'rgba(24,95,165,0.04)':'transparent')+'"><td>'+(paid?'<span class="dot dot-blue"></span>':'')+esc(q)+'</td><td class="r">'+r.Clics+'</td><td class="r">'+r.Impresiones+'</td><td class="r">'+r.CTR+'</td><td class="r"><span class="'+posColor(pos)+'">'+pos.toFixed(1)+'</span></td></tr>';}).join('')+
      '</tbody></table>';
    if(((cur&&cur.data?cur.data.consultas:[])||[]).length>30)content+='<div style="padding:6px 10px;font-size:10px;color:#aaa;border-top:1px solid #eee">30 de '+((cur&&cur.data?cur.data.consultas:[])||[]).length+' · usa el filtro</div>';
    content+='</div><p style="font-size:10px;color:#aaa;margin-top:6px"><span class="dot dot-blue"></span>consultas transaccionales</p>';
  }

  // ── PÁGINAS ──
  if(S.tab==='páginas'){
    content += urlFocusChartHTML();
    var nonArticlePages=((cur&&cur.data?cur.data.paginas:[])||[]).filter(function(r){return!isBlogArticle(r['Páginas principales']||'');}).sort(function(a,b){return pN(b.Clics)-pN(a.Clics);});
    var prevPagesNAP = prev ? ((prev&&prev.data?prev.data.paginas:[])||[]) : [];
    var pNAP = paretoSplit(nonArticlePages, function(r){ return pN(r.Clics); });
    if(pNAP.count>0 && nonArticlePages.length>0) content += paretoBadge(pNAP.count, nonArticlePages.length);
    var colsNAP = 6 + (prev ? 3 : 0);
    var napRows = '';
    nonArticlePages.forEach(function(r,i){
      var url=r['Páginas principales']||''; var svc=isSvc(url); var pos=pP(r['Posición']);
      var clics=pN(r.Clics); var impr=pN(r.Impresiones);
      var focused = S.overviewFocusUrl === url;
      var rowBg = focused ? '#eff6ff' : (svc ? 'rgba(216,90,48,0.04)' : 'transparent');
      var napDelta = '';
      if(prev){
        var pr2 = prevPagesNAP.find(function(x){ return (x['Páginas principales']||'')===url; });
        function dCellNAP(val, pval, fmt, inv) {
          if(!pr2) return '<td class="r gray">—</td>';
          var d=val-pval; var good=inv?d<0:d>0;
          if(Math.abs(d)<0.05) return '<td class="r gray">=</td>';
          return '<td class="r"><span class="'+(good?'up':'dn')+'">'+(d>0?'↑':'↓')+(fmt?fmt(Math.abs(d)):Math.round(Math.abs(d)).toLocaleString())+'</span></td>';
        }
        napDelta = dCellNAP(clics, pr2?pN(pr2.Clics):0) +
                   dCellNAP(impr,  pr2?pN(pr2.Impresiones):0, fmtK) +
                   dCellNAP(pos,   pr2?pP(pr2['Posición']):0, function(v){return v.toFixed(1);}, true);
      }
      napRows+='<tr style="background:'+rowBg+'">'+
        '<td style="width:28px;text-align:center;padding:4px">'+lupaBtnHTML(url)+'</td>'+
        '<td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(svc?'<span class="dot dot-red"></span>':'')+esc(shortURL(url))+'</td>'+
        '<td class="r">'+Math.round(clics).toLocaleString()+'</td><td class="r">'+fmtK(impr)+'</td><td class="r">'+r.CTR+'</td>'+
        '<td class="r"><span class="'+posColor(pos)+'">'+pos.toFixed(1)+'</span><span class="pill '+posClass(pos)+'">'+posLbl(pos)+'</span></td>'+
        napDelta+'</tr>';
      if(i===pNAP.count-1 && pNAP.count<nonArticlePages.length) napRows+=paretoSepRow(colsNAP, nonArticlePages.length-pNAP.count);
    });
    content+='<div class="panel-table"><table><thead><tr><th style="width:28px"></th><th>URL</th><th class="r">Clics</th><th class="r">Impr.</th><th class="r">CTR</th><th class="r">Posición</th>'+
      (prev?'<th class="r">Δ clics</th><th class="r">Δ impr.</th><th class="r">Δ pos</th>':'')+
      '</tr></thead><tbody>'+napRows+'</tbody></table></div>';
    content+='<p style="font-size:10px;color:#aaa;margin-top:6px"><span class="dot dot-red"></span>páginas de servicio</p>';
  }

  // ── SNAPSHOTS ──
  if(S.tab==='snapshots'){
    content+='<p style="font-size:11px;color:#888;margin-bottom:10px">'+S.snapshots.length+' períodos cargados. '+(S.driveStatus==='connected'?'Pulsa "Actualizar datos" para importar períodos nuevos de Drive.':'Conecta Drive para sincronización automática.')+'</p>';
    content+=S.snapshots.map(function(s,i){var m=calcM(s);var isDrive=!!s.driveFolder;return'<div class="snap-item'+(i===S.curIdx?' active':'')+'"><div style="display:flex;align-items:center;gap:14px"><div><div class="snap-name'+(i===S.curIdx?' active':'')+'">'+esc(s.label)+(isDrive?' <span style="font-size:10px;color:#888">· Drive</span>':'')+'</div><div class="snap-meta">'+new Date(s.date).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'})+(m?' · '+Math.round(m.clics).toLocaleString()+' clics · pos '+m.pos.toFixed(1):'')+'</div></div></div><div style="display:flex;gap:6px"><button onclick="S.curIdx='+i+';S.tab=\'overview\';render()">Ver</button><button class="danger" onclick="deleteSnap('+i+')">Eliminar</button></div></div>';}).join('');
    content+='<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid #eee;display:flex;gap:8px;flex-wrap:wrap">'+
      (S.driveStatus==='connected'?'<button class="success" onclick="refreshFromDrive()">↻ Actualizar datos desde Drive</button>':'')+
      '<button onclick="document.getElementById(\'fi-snap\').click()">↑ Agregar CSV manual</button>'+
      '<input type="file" id="fi-snap" multiple accept=".csv" style="display:none"></div>';
  }

  var dateModal = '';
  if (S.showDateModal) {
    var mt  = S.modalTab || 'filtrar';
    var pr  = S.pendingRange || '3m';
    var pcr = S.pendingCompareRange || 'previous';

    // ── Filtrar tab content ──
    var filterRanges = [
      { key:'7d', lbl:'Últimos 7 días' }, { key:'28d', lbl:'Últimos 28 días' },
      { key:'3m', lbl:'Últimos 3 meses' }, { key:'6m', lbl:'Últimos 6 meses' },
      { key:'12m', lbl:'Últimos 12 meses' }, { key:'16m', lbl:'Últimos 16 meses' },
      { key:'custom', lbl:'Personalizado' }
    ];
    var filterRows = filterRanges.map(function(r) {
      return '<label class="date-radio-row">'+
        '<input type="radio" name="dm-range" value="'+r.key+'" onchange="setPendingRange(\''+r.key+'\')"'+(pr===r.key?' checked':'')+'>'+
        '<span>'+r.lbl+'</span></label>';
    }).join('');
    var filterCustom = pr === 'custom'
      ? '<div class="date-custom-inputs">'+
          '<div class="date-custom-field"><label>Fecha de inicio</label><input type="date" id="dm-from" value="'+esc(S.pendingDateFrom)+'"></div>'+
          '<div style="display:flex;align-items:flex-end;padding-bottom:9px;color:#94A3B8;font-size:16px">–</div>'+
          '<div class="date-custom-field"><label>Fecha de finalización</label><input type="date" id="dm-to" value="'+esc(S.pendingDateTo)+'"></div>'+
        '</div>' : '';

    // ── Comparar tab content ──
    var compareRanges = [
      { key:'previous', lbl:'Período anterior' },
      { key:'year',     lbl:'Año anterior' },
      { key:'custom',   lbl:'Personalizado' }
    ];
    var compareRows = compareRanges.map(function(r) {
      return '<label class="date-radio-row">'+
        '<input type="radio" name="dm-comp" value="'+r.key+'" onchange="setPendingCompareRange(\''+r.key+'\')"'+(pcr===r.key?' checked':'')+'>'+
        '<span>'+r.lbl+'</span></label>';
    }).join('');
    var compareCustom = pcr === 'custom'
      ? '<div class="date-custom-inputs">'+
          '<div class="date-custom-field"><label>Fecha de inicio</label><input type="date" id="dm-comp-from" value="'+esc(S.pendingCompareDateFrom)+'"></div>'+
          '<div style="display:flex;align-items:flex-end;padding-bottom:9px;color:#94A3B8;font-size:16px">–</div>'+
          '<div class="date-custom-field"><label>Fecha de finalización</label><input type="date" id="dm-comp-to" value="'+esc(S.pendingCompareDateTo)+'"></div>'+
        '</div>' : '';

    var tabContent = mt === 'comparar'
      ? '<div class="date-radio-list">'+compareRows+compareCustom+'</div>'
      : '<div class="date-radio-list">'+filterRows+filterCustom+'</div>';

    dateModal =
      '<div class="date-overlay" onclick="S.showDateModal=false;render()">'+
        '<div class="date-modal" onclick="event.stopPropagation()">'+
          '<h3>Intervalo de fechas</h3>'+
          '<div class="date-modal-tabs">'+
            '<div class="date-modal-tab'+(mt==='filtrar'?' active':'')+'" onclick="setPendingModalTab(\'filtrar\')">Filtrar</div>'+
            '<div class="date-modal-tab'+(mt==='comparar'?' active':'')+'" onclick="setPendingModalTab(\'comparar\')">Comparar</div>'+
          '</div>'+
          tabContent+
          '<div class="date-modal-footer">'+
            '<button class="date-modal-cancel" onclick="S.showDateModal=false;render()">Cancelar</button>'+
            '<button class="date-modal-apply" onclick="applyDateFilter()">Aplicar</button>'+
          '</div>'+
        '</div>'+
      '</div>';
  }

  return '<div class="shell">'+sidebar+'<main class="main">'+topbar+'<div class="content">'+content+'</div></main></div>'+dateModal;
}

// ── BIND EVENTS ──────────────────────────────────────────
function bindEvents(){
  var dz = document.getElementById('drop-zone');
  if(dz){
    dz.onclick = function(){ document.getElementById('fi').click(); };
    dz.ondragover = function(e){ e.preventDefault(); dz.classList.add('drag'); };
    dz.ondragleave = function(){ dz.classList.remove('drag'); };
    dz.ondrop = function(e){ e.preventDefault(); dz.classList.remove('drag'); processFiles(e.dataTransfer.files); };
  }
  document.querySelectorAll('.note-btn').forEach(function(btn){
    btn.onclick = function(){
      var idx  = parseInt(this.getAttribute('data-idx'));
      var wrap = this.parentElement;
      var txt  = wrap.querySelector('.note-input[data-idx="'+idx+'"]');
      var dt   = wrap.querySelector('.note-date[data-idx="'+idx+'"]');
      if(txt && txt.value.trim()) addNote(idx, txt.value.trim(), dt ? dt.value : '');
    };
  });
  ['fi','fi-snap','fi2'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.onchange=function(){processFiles(this.files);this.value='';};
  });
  var qf=document.getElementById('q-filter');
  if(qf){qf.oninput=function(){S.qFilter=this.value;render();};qf.focus();}
}

function saveConfig(){
  var cid  = document.getElementById('cfg-clientid');
  var fid  = document.getElementById('cfg-folderid');
  var gsw  = document.getElementById('cfg-gscweeks');
  var gss  = document.getElementById('cfg-gscsite');
  if(cid)  S.clientId   = cid.value.trim();
  if(fid)  S.folderId   = fid.value.trim();
  if(gsw)  S.gscWeeks   = parseInt(gsw.value) || 8;
  if(gss)  S.gscSiteUrl = gss.value;
  saveState();
  toast('✓ Configuración guardada');
  render();
}

// ── INIT ─────────────────────────────────────────────────
loadState();
render();
