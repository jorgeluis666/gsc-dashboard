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
  // ui
  refreshing: false,
  overviewSection: 'top'  // top | gained | lost
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
      gscWeeks:    S.gscWeeks
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
var CSV_NAMES = ['gráfico','grafico','consultas','páginas','paginas','dispositivos','países','paises','filtros'];

// ── HELPERS ──────────────────────────────────────────────
function pN(v){return parseFloat(String(v||'0').replace(/[%\s]/g,'').replace(',','.'))||0;}
function pP(v){return parseFloat(String(v||'0').replace(',','.'))||0;}
function isPaid(q){var ql=(q||'').toLowerCase();return PAID.some(function(p){return ql.includes(p);});}
function isSvc(url){var ul=(url||'').toLowerCase();return SVCS.some(function(s){return ul.includes(s);});}
function shortURL(u){return(u||'').replace('https://limaretail.com','').split('#')[0]||'/';}
function fmtK(v){return v>=1000?(v/1000).toFixed(1)+'k':Math.round(v)+'';}
function posClass(p){return p<=10?'pg1':p<=20?'pg2':'pg3';}
function posLbl(p){return p<=10?'Pág. 1':p<=20?'Pág. 2':'Pág. '+Math.ceil(p/10);}
function posColor(p){return p<=10?'up':p<=20?'am':'dn';}
function calcM(snap){
  if(!snap)return null;
  var g=snap.data.grafico||[];
  var tc=g.reduce(function(s,r){return s+pN(r.Clics);},0);
  var ti=g.reduce(function(s,r){return s+pN(r.Impresiones);},0);
  var lr=g[g.length-1]||{};
  return{clics:tc,impr:ti,ctr:ti>0?(tc/ti*100):0,pos:pP(lr['Posición'])};
}
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
function getURLHistory(url) {
  return S.snapshots.map(function(snap) {
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

// ── ANALYSIS ─────────────────────────────────────────────
function analyzeOpp(cur){
  var Q=cur.data.consultas||[],P=cur.data.paginas||[];
  return{
    quickwins: Q.filter(function(r){var p=pP(r['Posición']);return p>=11&&p<=20&&pN(r.Impresiones)>=30&&pN(r.Clics)===0;}).sort(function(a,b){return pN(b.Impresiones)-pN(a.Impresiones);}).slice(0,8),
    ctrGap:    Q.filter(function(r){return pP(r['Posición'])<=15&&pN(r.Impresiones)>=20&&pN(r.Clics)===0;}).sort(function(a,b){return pN(b.Impresiones)-pN(a.Impresiones);}).slice(0,8),
    paidGap:   P.filter(function(r){return isSvc(r['Páginas principales']||'')&&pP(r['Posición'])>20;}),
    paidZero:  Q.filter(function(r){return isPaid(r['Consultas principales']||'')&&pN(r.Clics)===0&&pN(r.Impresiones)>=30;}).sort(function(a,b){return pN(b.Impresiones)-pN(a.Impresiones);}).slice(0,8)
  };
}

function analyzeVar(cur,prev){
  var res=[];
  var cQ=cur.data.consultas||[],pQ=prev.data.consultas||[];
  var cP=cur.data.paginas||[],pP2=prev.data.paginas||[];
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

  // X axis labels
  labels.forEach(function(lbl, i) {
    var x = xOf(i);
    // Shorten label: take last part after space or dash
    var short = lbl.split(' ').pop().split('-').pop();
    svg += '<text x="'+x.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#aaa">'+esc(lbl)+'</text>';
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
      svg += '<path d="'+lineD+'" fill="none" stroke="'+s.color+'" stroke-width="2"'+(s.dashed?' stroke-dasharray="5,3"':'')+' stroke-linejoin="round" stroke-linecap="round"/>';
    }

    // Dots + value labels
    pts.forEach(function(p) {
      svg += '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4" fill="'+s.color+'" stroke="#fff" stroke-width="1.5"/>';
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
function buildTrendData() {
  return S.snapshots.map(function(snap) {
    var m = calcM(snap);
    return { label: snap.label, clics: m ? m.clics : 0, impr: m ? m.impr : 0, pos: m ? m.pos : 0 };
  });
}

// Build trend data for a specific URL across all snapshots
function buildURLTrend(url) {
  return getURLHistory(url).map(function(h) {
    return {
      label: h.label,
      clics: h.found ? h.clics : null,
      impr:  h.found ? h.impr  : null,
      pos:   h.found ? h.pos   : null
    };
  });
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

// ── HELPERS (DS pill classes) ────────────────────────────
function posClass(p){return p<=10?'green':p<=20?'amber':'red';}
function posLbl(p){return p<=10?'Pág. 1':p<=20?'Pág. 2':'Pág. '+Math.ceil(p/10);}
function posColor(p){return p<=10?'up':p<=20?'am':'dn';}

// ── SIDEBAR SVG ICONS ────────────────────────────────────
var ICONS = {
  overview:      '<svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  oportunidades: '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  consultas:     '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  transaccionales:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  seguimiento:   '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  paginas:       '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  variacion:     '<svg viewBox="0 0 24 24"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  ideas:         '<svg viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="6"/><path d="M12 8a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V17a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-1.5C8.8 14.8 8 13.5 8 12a4 4 0 0 1 4-4z"/><line x1="12" y1="21" x2="12" y2="22"/></svg>',
  configuracion: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
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

  var hasSnaps = S.snapshots.length > 0;
  var TABS_DEF = [
    { id:'overview',       label:'Overview',        group:'Análisis' },
    { id:'oportunidades',  label:'Oportunidades',   group:'Análisis', hi:true },
    { id:'consultas',      label:'Consultas',        group:'Análisis' },
    { id:'transaccionales',label:'Transaccionales',  group:'Análisis' },
    { id:'seguimiento',    label:'Seguimiento',      group:'Acciones' },
    { id:'páginas',        label:'Páginas',          group:'Análisis' },
    { id:'variación',      label:'Variación',        group:'Análisis', hi:true, req2:true },
    { id:'ideas',          label:'Ideas',            group:'Acciones' },
    { id:'configuración',  label:'Configuración',    group:'Config' },
    { id:'snapshots',      label:'Snapshots',        group:'Config' }
  ].filter(function(t){ return !t.req2 || S.snapshots.length > 1; });

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
      '<div class="s-title">GSC Dashboard</div>'+
      '<div class="s-sub">Lima Retail</div>'+
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

  var selSnap='';
  if(S.snapshots.length>1){
    var opts=S.snapshots.map(function(s,i){return'<option value="'+i+'"'+(i===S.curIdx?' selected':'')+'>'+esc(s.label)+'</option>';}).join('');
    selSnap='<select class="period-select" onchange="S.curIdx=parseInt(this.value);render()">'+opts+'</select>';
  } else if(S.snapshots.length===1){
    selSnap='<span style="font-size:11px;font-weight:500;color:var(--text-2);background:#F1F5F9;padding:4px 10px;border-radius:20px">'+esc(S.snapshots[0].label)+'</span>';
  }

  var refreshBtn = S.driveStatus==='connected'
    ? '<button class="btn success btn-sm" onclick="refreshFromDrive()" '+(S.refreshing?'disabled':'')+'>'+(S.refreshing?'<span class="spinning">↻</span> Actualizando':'↻ Drive')+'</button>'
    : '';
  var gscBtn = S.gscStatus==='connected' && S.gscSiteUrl
    ? '<button class="btn btn-sm" style="background:#059669;color:#fff;border-color:#059669" onclick="importFromGSC()" '+(S.gscImporting?'disabled':'')+'>'+(S.gscImporting?'<span class="spinning">↻</span> Importando':'↓ GSC')+'</button>'
    : '';

  var topbar = '<div class="topbar">'+
    '<div class="topbar-left">'+
      '<span class="topbar-title">'+esc(tabLabel)+'</span>'+
      selSnap+
      (S.refreshing?'<span style="font-size:11px;color:var(--muted)">Sincronizando...</span>':'')+
    '</div>'+
    '<div class="topbar-right">'+
      gscBtn+
      refreshBtn+
      (S.driveStatus==='connected'?'<button class="btn btn-sm" onclick="disconnectDrive()">✕ Drive</button>':'')+
      '<button class="btn btn-sm primary" onclick="document.getElementById(\'fi\').click()">↑ Subir CSV</button>'+
      '<input type="file" id="fi" multiple accept=".csv" style="display:none">'+
    '</div>'+
  '</div>';

  // ── CONTENT ──
  var content = '';

  // ── SIN DATOS — pantalla de bienvenida ──
  if(!hasSnaps && S.tab !== 'configuración' && S.tab !== 'snapshots'){
    var connectBlock = S.gscStatus === 'connected'
      ? '<button onclick="importFromGSC()" style="display:inline-flex;align-items:center;gap:10px;background:#2563EB;color:#fff;border:none;border-radius:12px;padding:14px 32px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,.35)">'+
          '<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="3" x2="12" y2="21"/></svg>'+
          'Importar datos de Search Console</button>'
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
        '<div style="width:72px;height:72px;background:linear-gradient(135deg,#2563EB,#1D4ED8);border-radius:20px;display:flex;align-items:center;justify-content:center;margin-bottom:1.5rem;box-shadow:0 8px 24px rgba(37,99,235,.3)">'+
          '<svg viewBox="0 0 24 24" style="width:36px;height:36px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>'+
        '</div>'+

        '<h1 style="font-size:28px;font-weight:800;color:#0F172A;margin:0 0 10px;text-align:center;letter-spacing:-.5px">GSC Dashboard</h1>'+
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

        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
          '<div><label style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">Rango</label>'+
          '<select id="cfg-gscweeks" onchange="S.gscWeeks=parseInt(this.value);saveState()" style="padding:7px 10px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;background:#fff">'+weekOptions+'</select></div>'+
          '<button class="btn success" style="margin-top:18px;padding:9px 20px;font-size:13px" onclick="importFromGSC()" '+(S.gscImporting?'disabled':'')+'>'+
            (S.gscImporting ? '<span class="spinning">↻</span> Importando…' : '↓ Importar semanas')+'</button>'+
          '<button class="btn btn-sm" style="margin-top:18px;background:#FEF2F2;color:#DC2626;border-color:#FECACA" onclick="resetAndImport()">⟳ Limpiar e importar todo</button>'+
          '<button class="btn btn-sm" style="margin-top:18px;color:#94A3B8" onclick="disconnectDrive();S.gscStatus=\'disconnected\';S.gscSites=[];render()">Desconectar</button>'+
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
          '<svg viewBox="0 0 24 24" style="width:26px;height:26px;fill:none;stroke:#2563EB;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'+
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

  var cur  = S.snapshots[S.curIdx];
  var prev = S.curIdx > 0 ? S.snapshots[S.curIdx - 1] : null;
  var curM = calcM(cur), prevM = calcM(prev);

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

    var pages = cur.data.paginas || [];
    var topClics = pages.slice().sort(function(a,b){return pN(b.Clics)-pN(a.Clics);}).slice(0,8);
    var prevPages = prev ? (prev.data.paginas || []) : [];

    function findPrev(url){ return prevPages.find(function(r){return(r['Páginas principales']||'')===url;})||null; }

    var withDelta = pages.map(function(r){
      var url=r['Páginas principales']||'';
      var pr=findPrev(url);
      return {
        url: url,
        clics: pN(r.Clics),
        impr:  pN(r.Impresiones),
        dClics: pr ? pN(r.Clics)-pN(pr.Clics) : null,
        dImpr:  pr ? pN(r.Impresiones)-pN(pr.Impresiones) : null
      };
    }).filter(function(r){ return r.dClics !== null; });

    var topGainClics = withDelta.filter(function(r){return r.dClics>0;}).sort(function(a,b){return b.dClics-a.dClics;}).slice(0,8);
    var topGainImpr  = withDelta.filter(function(r){return r.dImpr>0;}).sort(function(a,b){return b.dImpr-a.dImpr;}).slice(0,8);
    var topDropClics = withDelta.filter(function(r){return r.dClics<0;}).sort(function(a,b){return a.dClics-b.dClics;}).slice(0,8);
    var topDropImpr  = withDelta.filter(function(r){return r.dImpr<0;}).sort(function(a,b){return a.dImpr-b.dImpr;}).slice(0,8);

    function pageRow(r, showDelta, deltaKey, actionType){
      var url = r.url || r['Páginas principales'] || '';
      var clics = r.clics !== undefined ? r.clics : pN(r.Clics);
      var impr  = r.impr  !== undefined ? r.impr  : pN(r.Impresiones);
      var dVal  = r[deltaKey];
      var dHtml = '';
      if(dVal !== undefined && dVal !== null){
        dHtml = dVal > 0
          ? '<span class="up">↑ '+Math.round(dVal).toLocaleString()+'</span>'
          : '<span class="dn">↓ '+Math.round(Math.abs(dVal)).toLocaleString()+'</span>';
      }
      var safeUrl = url.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      var actionHtml = '';
      if(actionType==='optimizar'){
        actionHtml='<td><button onclick="optimizarPagina(\''+safeUrl+'\')" style="font-size:10px;padding:3px 8px;background:#DC2626;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap">Optimizar</button></td>';
      } else if(actionType==='promocionar'){
        actionHtml='<td><button onclick="promoverPagina(\''+safeUrl+'\')" style="font-size:10px;padding:3px 8px;background:#059669;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap">Promocionar</button></td>';
      }
      return '<tr><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(shortURL(url))+'</td>'+
             '<td class="r">'+Math.round(clics).toLocaleString()+'</td>'+
             '<td class="r">'+fmtK(impr)+'</td>'+
             (showDelta ? '<td class="r">'+dHtml+'</td>' : '')+
             actionHtml+'</tr>';
    }

    function pageTable(rows, showDelta, deltaKey, actionType){
      if(!rows.length) return '<div class="insight info" style="margin-top:8px">No hay datos para este período.</div>';
      var extraTh = showDelta ? '<th class="r">Δ clics</th>' : '';
      var actionTh = actionType ? '<th></th>' : '';
      return '<div class="panel-table" style="margin-top:8px"><table>'+
        '<thead><tr><th>Página</th><th class="r">Clics</th><th class="r">Impr.</th>'+extraTh+actionTh+'</tr></thead>'+
        '<tbody>'+rows.map(function(r){return pageRow(r,showDelta,deltaKey,actionType);}).join('')+'</tbody></table></div>';
    }

    // ── Tab buttons + trend chart ──
    var ovSec = S.overviewSection || 'top';
    function tabBtn(key, label) {
      var active = ovSec === key;
      var bg = active ? '#2563EB' : 'transparent';
      var col = active ? '#fff' : '#666';
      var bdr = active ? '#2563EB' : '#ddd';
      return '<button onclick="S.overviewSection=\''+key+'\';render()" style="font-size:11px;padding:4px 12px;border-radius:20px;border:1px solid '+bdr+';background:'+bg+';color:'+col+';cursor:pointer">'+label+'</button>';
    }

    content += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
    content += '<p class="sec-lbl" style="margin:0">Evolución por período</p>';
    content += '<div style="display:flex;gap:6px">'+tabBtn('top','Top páginas')+tabBtn('gained','↑ Crecimiento')+tabBtn('lost','↓ Caídas')+'</div>';
    content += '</div>';

    if(S.snapshots.length >= 2) {
      var td = buildTrendData();
      var tLabels = td.map(function(d){ return d.label; });
      content += '<div class="panel" style="padding:1rem 1.2rem 0.6rem">';
      content += svgLineChart(tLabels, [
        { label:'Clics',       values: td.map(function(d){ return d.clics; }), color:'#2563EB' },
        { label:'Impresiones', values: td.map(function(d){ return d.impr;  }), color:'#059669', dashed:true },
        { label:'Posición',    values: td.map(function(d){ return d.pos;   }), color:'#DC2626', yRight:true }
      ], { height:200, invertRight:true });
      content += '<p style="font-size:10px;color:#aaa;padding:4px 0 6px">Posición: eje derecho — valores más bajos = mejor ranking</p>';
      content += '</div>';
    }

    // ── Table per selected tab ──
    if(ovSec==='top'){
      content += pageTable(topClics, false, '', null);
    } else if(ovSec==='gained'){
      if(!prev){
        content += '<div class="insight info" style="margin-top:8px">Necesitas al menos 2 períodos para ver variaciones.</div>';
      } else {
        content += pageTable(topGainClics, true, 'dClics', 'promocionar');
      }
    } else if(ovSec==='lost'){
      if(!prev){
        content += '<div class="insight info" style="margin-top:8px">Necesitas al menos 2 períodos para ver variaciones.</div>';
      } else {
        content += pageTable(topDropClics, true, 'dClics', 'optimizar');
      }
    }
  }

  // ── TRANSACCIONALES ──
  if(S.tab==='transaccionales'){
    var svcP=(cur.data.paginas||[]).filter(function(r){return isSvc(r['Páginas principales']||'');});
    var paidQ=(cur.data.consultas||[]).filter(function(r){return isPaid(r['Consultas principales']||'');});
    var fPP=function(url){if(!prev)return null;var f=(prev.data.paginas||[]).find(function(r){return(r['Páginas principales']||'')===url;});return f?pP(f['Posición']):null;};
    var fPQ=function(q){if(!prev)return null;var f=(prev.data.consultas||[]).find(function(r){return(r['Consultas principales']||'').toLowerCase()===q.toLowerCase();});return f?pP(f['Posición']):null;};

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
          '<div class="kpi-delta"><span class="'+(good?'up':'dn')+'">'+(good?'↑':'↓')+' '+fmt[i](Math.abs(d))+sfx[i]+'</span> vs '+esc(prev.label)+'</div>'+
        '</div>';
      }).join('')+'</div>';

      // Trend chart in variación tab
      if(S.snapshots.length >= 2) {
        var vtd = buildTrendData();
        var vtLabels = vtd.map(function(d){ return d.label; });
        content += '<div class="panel" style="padding:1rem 1.2rem 0.6rem">';
        content += svgLineChart(vtLabels, [
          { label:'Clics',       values: vtd.map(function(d){ return d.clics; }), color:'#2563EB' },
          { label:'Impresiones', values: vtd.map(function(d){ return d.impr;  }), color:'#059669', dashed:true },
          { label:'Posición',    values: vtd.map(function(d){ return d.pos;   }), color:'#DC2626', yRight:true }
        ], { height:200, invertRight:true });
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

  // ── SEGUIMIENTO ──
  if(S.tab==='seguimiento'){
    if(S.trackedURLs.length===0){
      S.trackedURLs.push({
        url:'https://limaretail.com/performance/07-herramientas-medir-velocidad-pagina-web/',
        label:'07 Herramientas medir velocidad página web',
        dateAdded:'2026-04-12',
        notes:[]
      });
      saveState();
    }

    content+='<div class="add-track-form">'+
      '<p class="sec-lbl" style="margin-top:0">Agregar URL al seguimiento</p>'+
      '<div class="form-row">'+
      '<div><label style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">URL completa</label>'+
      '<input id="new-track-url" placeholder="https://limaretail.com/..." style="width:100%"></div>'+
      '<div><label style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">Fecha de envío a GSC</label>'+
      '<input type="date" id="new-track-date" value="'+new Date().toISOString().slice(0,10)+'" style="width:100%"></div>'+
      '</div>'+
      '<div style="display:flex;gap:8px">'+
      '<button class="primary" onclick="(function(){var u=document.getElementById(\'new-track-url\');if(u)addTrackedURL(u.value,\'\')})()">+ Agregar URL</button>'+
      '</div></div>';

    if(!S.trackedURLs.length){
      content+='<div class="insight info">No hay URLs en seguimiento. Agrega una arriba.</div>';
    } else {
      S.trackedURLs.forEach(function(tracked, urlIdx){
        var history = getURLHistory(tracked.url);
        var slug    = tracked.url.replace('https://limaretail.com','');
        var added   = tracked.dateAdded ? tracked.dateAdded.slice(0,10) : '—';
        var weeksTracked = history.filter(function(h){ return h.found; }).length;

        content+='<div class="track-url-card">'+
          '<div class="track-url-header">'+
          '<div>'+
          '<div class="track-url-slug">'+esc(slug)+'</div>'+
          '<div class="track-url-meta">Enviado a GSC: '+esc(added)+
            (weeksTracked ? ' · <span style="color:var(--green)">'+weeksTracked+' período'+(weeksTracked>1?'s':'')+' con datos</span>' : ' · <span style="color:var(--red)">Sin datos aún en snapshots</span>')+
            (tracked.lastIndexed ? ' · <span style="color:#7c3aed">↑ Indexado: '+esc(tracked.lastIndexed)+'</span>' : '')+
          '</div>'+
          '</div>'+
          '<div style="display:flex;gap:6px">'+
          '<button style="font-size:11px;padding:4px 10px;background:#7c3aed;color:#fff;border:none;border-radius:4px;cursor:pointer" onclick="indexURL('+urlIdx+')">↑ Indexar</button>'+
          '<button class="danger" style="font-size:11px" onclick="removeTrackedURL('+urlIdx+')">Quitar</button>'+
          '</div>'+
          '</div>';

        if(history.length){
          // Cards grid
          content+='<div class="track-progress">';
          history.forEach(function(h){
            var cls = h.found ? (h.pos && h.pos<=10 ? 'track-week p1' : 'track-week has-data') : 'track-week';
            var posStr   = h.found && h.pos   ? h.pos.toFixed(1)  : '—';
            var clicsStr = h.found && h.clics !== null ? Math.round(h.clics) : '—';
            var imprStr  = h.found && h.impr  !== null ? fmtK(h.impr) : '—';
            content+='<div class="'+cls+'">'+
              '<div class="track-week-lbl">'+esc(h.label)+'</div>'+
              '<div class="track-week-val">pos '+posStr+'</div>'+
              '<div class="track-week-sub">'+clicsStr+' clics · '+imprStr+' impr.</div>'+
              '</div>';
          });
          content+='</div>';

          // Line chart (only when ≥2 snapshots have data)
          var withData = history.filter(function(h){ return h.found; });
          if(withData.length >= 2) {
            var uLabels = history.map(function(h){ return h.label; });
            var uTrend = buildURLTrend(tracked.url);
            content += '<div style="margin-top:10px">';
            content += svgLineChart(uLabels, [
              { label:'Clics',    values: uTrend.map(function(d){ return d.clics; }), color:'#2563EB' },
              { label:'Impr.',    values: uTrend.map(function(d){ return d.impr;  }), color:'#059669', dashed:true },
              { label:'Posición', values: uTrend.map(function(d){ return d.pos;   }), color:'#DC2626', yRight:true }
            ], { height:170, invertRight:true });
            content += '<p style="font-size:10px;color:#aaa;margin-top:2px">Posición: eje derecho — más bajo = mejor</p>';
            content += '</div>';
          }
        } else {
          content+='<div class="insight info" style="margin-top:8px;font-size:11px">Carga snapshots para ver la evolución de esta URL.</div>';
        }

        if(tracked.notes && tracked.notes.length){
          content+='<div style="margin-top:8px">';
          tracked.notes.forEach(function(n){
            content+='<div class="track-note">📝 <b>'+esc(n.date)+'</b> — '+esc(n.text)+'</div>';
          });
          content+='</div>';
        }

        content+='<div style="display:flex;gap:6px;margin-top:10px">'+
          '<input class="note-input" data-idx="'+urlIdx+'" placeholder="Ej: Actualicé el H1 y agregué datos 2026" style="flex:1;font-size:11px">'+
          '<input type="date" class="note-date" data-idx="'+urlIdx+'" value="'+new Date().toISOString().slice(0,10)+'" style="width:130px;font-size:11px">'+
          '<button class="note-btn" data-idx="'+urlIdx+'" style="font-size:11px">+ Nota</button>'+
          '</div>';

        content+='</div>';
      });
    }
  }

  // ── IDEAS ──
  if(S.tab==='ideas'){
    var Q = cur.data.consultas || [];
    var P = cur.data.paginas   || [];

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
    var allQ=(cur.data.consultas||[]).filter(function(r){return!S.qFilter||(r['Consultas principales']||'').toLowerCase().includes(S.qFilter.toLowerCase());}).slice(0,30);
    content+='<input id="q-filter" value="'+esc(S.qFilter)+'" placeholder="Filtrar consultas..." style="width:100%;margin-bottom:10px;padding:6px 10px">';
    content+='<div class="panel-table"><table><thead><tr><th>Consulta</th><th class="r">Clics</th><th class="r">Impr.</th><th class="r">CTR</th><th class="r">Posición</th></tr></thead><tbody>'+
      allQ.map(function(r){var q=r['Consultas principales']||'';var pos=pP(r['Posición']);var paid=isPaid(q);return'<tr style="background:'+(paid?'rgba(24,95,165,0.04)':'transparent')+'"><td>'+(paid?'<span class="dot dot-blue"></span>':'')+esc(q)+'</td><td class="r">'+r.Clics+'</td><td class="r">'+r.Impresiones+'</td><td class="r">'+r.CTR+'</td><td class="r"><span class="'+posColor(pos)+'">'+pos.toFixed(1)+'</span></td></tr>';}).join('')+
      '</tbody></table>';
    if((cur.data.consultas||[]).length>30)content+='<div style="padding:6px 10px;font-size:10px;color:#aaa;border-top:1px solid #eee">30 de '+(cur.data.consultas||[]).length+' · usa el filtro</div>';
    content+='</div><p style="font-size:10px;color:#aaa;margin-top:6px"><span class="dot dot-blue"></span>consultas transaccionales</p>';
  }

  // ── PÁGINAS ──
  if(S.tab==='páginas'){
    content+='<div class="panel-table"><table><thead><tr><th>URL</th><th class="r">Clics</th><th class="r">Impr.</th><th class="r">CTR</th><th class="r">Posición</th></tr></thead><tbody>'+
      (cur.data.paginas||[]).slice(0,25).map(function(r){var url=r['Páginas principales']||'';var svc=isSvc(url);var pos=pP(r['Posición']);return'<tr style="background:'+(svc?'rgba(216,90,48,0.04)':'transparent')+'"><td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(svc?'<span class="dot dot-red"></span>':'')+esc(shortURL(url))+'</td><td class="r">'+r.Clics+'</td><td class="r">'+r.Impresiones+'</td><td class="r">'+r.CTR+'</td><td class="r"><span class="'+posColor(pos)+'">'+pos.toFixed(1)+'</span><span class="pill '+posClass(pos)+'">'+posLbl(pos)+'</span></td></tr>';}).join('')+
      '</tbody></table></div>';
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

  return '<div class="shell">'+sidebar+'<main class="main">'+topbar+'<div class="content">'+content+'</div></main></div>';
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
