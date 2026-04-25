// ── GOOGLE SEARCH CONSOLE API ────────────────────────────
// Requires: app.js (S, saveState, render, toast)
//           drive.js (connectDrive — shares OAuth token)
// Uses fetch() directly with the Bearer token from OAuth

var GSC_API = 'https://www.googleapis.com/webmasters/v3';

// ── LOW-LEVEL FETCH ──────────────────────────────────────
function gscFetch(path, method, body, callback) {
  if (!S.accessToken) { callback(new Error('Sin token de acceso'), null); return; }
  var opts = {
    method: method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + S.accessToken,
      'Content-Type': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  fetch(GSC_API + path, opts)
    .then(function(r) {
      if (r.status === 401) { S.accessToken = null; S.driveStatus = 'disconnected'; S.gscStatus = 'disconnected'; render(); throw new Error('Token expirado — vuelve a conectar'); }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) { callback(null, data); })
    .catch(function(e)   { callback(e, null); });
}

// ── SITES ────────────────────────────────────────────────
function listGSCSites(callback) {
  gscFetch('/sites', 'GET', null, function(err, data) {
    if (err) { callback(err, []); return; }
    callback(null, (data.siteEntry || []).map(function(s){ return s.siteUrl; }));
  });
}

// ── ANALYTICS QUERY ──────────────────────────────────────
function queryGSC(siteUrl, body, callback) {
  var encoded = encodeURIComponent(siteUrl);
  gscFetch('/sites/' + encoded + '/searchAnalytics/query', 'POST', body, function(err, data) {
    if (err) { callback(err, []); return; }
    callback(null, data.rows || []);
  });
}

// ── DATA MAPPERS ─────────────────────────────────────────
function rowsToConsultas(rows) {
  return rows.map(function(r) {
    return {
      'Consultas principales': r.keys[0],
      'Clics':        r.clicks,
      'Impresiones':  r.impressions,
      'CTR':          (r.ctr * 100).toFixed(2) + ' %',
      'Posición':     r.position.toFixed(2)
    };
  });
}

function rowsToPaginas(rows) {
  return rows.map(function(r) {
    return {
      'Páginas principales': r.keys[0],
      'Clics':       r.clicks,
      'Impresiones': r.impressions,
      'CTR':         (r.ctr * 100).toFixed(2) + ' %',
      'Posición':    r.position.toFixed(2)
    };
  });
}

function rowsToGrafico(rows) {
  return rows.map(function(r) {
    return {
      'Fecha':       r.keys[0],
      'Clics':       r.clicks,
      'Impresiones': r.impressions,
      'CTR':         (r.ctr * 100).toFixed(2) + ' %',
      'Posición':    r.position.toFixed(2)
    };
  });
}

var DEVICE_NAMES = { DESKTOP: 'Computadora', MOBILE: 'Móvil', TABLET: 'Tablet' };

function rowsToDispositivos(rows) {
  return rows.map(function(r) {
    return {
      'Dispositivo': DEVICE_NAMES[r.keys[0]] || r.keys[0],
      'Clics':       r.clicks,
      'Impresiones': r.impressions,
      'CTR':         (r.ctr * 100).toFixed(2) + ' %',
      'Posición':    r.position.toFixed(2)
    };
  });
}

function rowsToPaises(rows) {
  return rows.map(function(r) {
    return {
      'País':        r.keys[0],
      'Clics':       r.clicks,
      'Impresiones': r.impressions,
      'CTR':         (r.ctr * 100).toFixed(2) + ' %',
      'Posición':    r.position.toFixed(2)
    };
  });
}

// ── WEEK UTILITIES ───────────────────────────────────────

// ISO week label: "2026-W14"
function isoWeekLabel(d) {
  var date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  var week1 = new Date(date.getFullYear(), 0, 4);
  var weekNum = 1 + Math.round(
    ((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7
  );
  return date.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

// Get Mon–Sun date range for a past complete week (weeksAgo=1 → last week)
function getWeekRange(weeksAgo) {
  var d = new Date();
  var day = d.getDay() || 7;              // Mon=1 … Sun=7
  d.setDate(d.getDate() - (day - 1) - weeksAgo * 7);
  var start = new Date(d);
  var end   = new Date(d);
  end.setDate(end.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
    label: isoWeekLabel(start)
  };
}

// ── FETCH ONE WEEK (5 dimensions in parallel) ────────────
function fetchWeekFromGSC(siteUrl, startDate, endDate, onDone) {
  var data      = {};
  var remaining = 5;

  function done(type, rows) {
    data[type] = rows;
    if (--remaining === 0) onDone(data);
  }

  var base = { startDate: startDate, endDate: endDate };

  queryGSC(siteUrl, Object.assign({}, base, { dimensions: ['query'],   rowLimit: 1000 }),
    function(e, r) { done('consultas',   e ? [] : rowsToConsultas(r));   });
  queryGSC(siteUrl, Object.assign({}, base, { dimensions: ['page'],    rowLimit: 1000 }),
    function(e, r) { done('paginas',     e ? [] : rowsToPaginas(r));     });
  queryGSC(siteUrl, Object.assign({}, base, { dimensions: ['date'],    rowLimit: 100  }),
    function(e, r) { done('grafico',     e ? [] : rowsToGrafico(r));     });
  queryGSC(siteUrl, Object.assign({}, base, { dimensions: ['device'],  rowLimit: 10   }),
    function(e, r) { done('dispositivos',e ? [] : rowsToDispositivos(r));});
  queryGSC(siteUrl, Object.assign({}, base, { dimensions: ['country'], rowLimit: 100  }),
    function(e, r) { done('paises',      e ? [] : rowsToPaises(r));      });
}

// ── IMPORT N RECENT WEEKS ────────────────────────────────
function importFromGSC() {
  if (!S.accessToken) { toast('Conecta con Google primero'); return; }
  if (!S.gscSiteUrl) {
    S.tab = 'configuración'; render();
    toast('⚠ Elige la propiedad de Search Console antes de importar');
    return;
  }

  var weeks   = parseInt(S.gscWeeks) || 8;
  var siteUrl = S.gscSiteUrl;

  // Find which week labels already exist
  var existing = {};
  S.snapshots.forEach(function(s){ existing[s.label] = true; });

  var toImport = [];
  for (var i = 1; i <= weeks; i++) {
    var w = getWeekRange(i);
    if (!existing[w.label]) toImport.push(w);
  }

  if (!toImport.length) {
    toast('✓ Todo actualizado — no hay semanas nuevas en el rango seleccionado');
    return;
  }

  S.gscImporting = true;
  render();
  toast('Importando ' + toImport.length + ' semana(s) desde Search Console...');

  var loaded = 0;
  toImport.forEach(function(week) {
    fetchWeekFromGSC(siteUrl, week.start, week.end, function(data) {
      var hasData = Object.keys(data).some(function(k){ return data[k].length > 0; });
      if (hasData) {
        S.snapshots.push({
          id:         Date.now() + Math.random(),
          label:      week.label,
          date:       new Date().toISOString(),
          gscSource:  true,
          gscSiteUrl: siteUrl,
          data:       data
        });
      }
      loaded++;
      if (loaded === toImport.length) {
        S.snapshots.sort(function(a,b){ return a.label.localeCompare(b.label); });
        S.curIdx       = S.snapshots.length > 0 ? S.snapshots.length - 1 : null;
        S.gscImporting = false;
        saveState();
        render();
        toast('✓ ' + S.snapshots.length + ' períodos en total — ' + loaded + ' importados desde GSC');
      }
    });
  });
}

// ── CONNECT / FETCH SITES ────────────────────────────────
var gscTokenClient = null;

function connectGSC() {
  if (!S.clientId) { toast('Client ID no configurado'); return; }

  // If we already have a valid token, go straight to fetching sites
  if (S.accessToken) { fetchGSCSites(); return; }

  // GIS (accounts.google.com/gsi/client) must be loaded
  if (typeof google === 'undefined' || !google.accounts) {
    toast('Cargando librería de Google, intenta en un momento…'); return;
  }

  S.gscStatus = 'loading'; render();

  // Init token client once (GIS only — no gapi needed for fetch-based calls)
  if (!gscTokenClient) {
    gscTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: S.clientId,
      scope: [
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/indexing'
      ].join(' '),
      callback: function(resp) {
        if (resp.error) {
          S.gscStatus = 'disconnected';
          toast('Error al conectar: ' + resp.error);
          render(); return;
        }
        // Store token — shared with drive.js if needed
        S.accessToken   = resp.access_token;
        S.driveStatus   = 'connected';
        fetchGSCSites();
      }
    });
  }

  gscTokenClient.requestAccessToken({ prompt: '' });
}

function fetchGSCSites() {
  S.gscStatus = 'loading'; render();
  listGSCSites(function(err, sites) {
    if (err) {
      S.gscStatus = 'disconnected';
      toast('Error GSC: ' + (err.message || err));
      render(); return;
    }
    S.gscSites  = sites;
    S.gscStatus = 'connected';
    if (!S.gscSiteUrl) {
      S.gscSiteUrl = sites.length === 1 ? sites[0] : '';
    }
    saveState();
    if (sites.length > 1 && !S.gscSiteUrl) {
      S.tab = 'configuración';
      render();
      toast('✓ Conectado — elige la propiedad en Configuración');
    } else if (S.gscSiteUrl) {
      fetchGSCData();
    } else {
      render();
    }
  });
}

// ── COMPUTE DATE RANGES ──────────────────────────────────
function computeDateRange() {
  if (S.overviewRange === 'custom' && S.overviewDateFrom && S.overviewDateTo) {
    return { start: S.overviewDateFrom, end: S.overviewDateTo };
  }
  var weeks = RANGE_WEEKS[S.overviewRange] || 13;
  var end = new Date();
  end.setDate(end.getDate() - 3); // GSC ~3-day data lag
  var start = new Date(end);
  start.setDate(start.getDate() - weeks * 7 + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function computeCompareRange() {
  if (S.compareRange === 'custom' && S.compareDateFrom && S.compareDateTo) {
    return { start: S.compareDateFrom, end: S.compareDateTo };
  }
  var main = computeDateRange();
  var ms = new Date(main.start), me = new Date(main.end);
  var days = Math.round((me - ms) / 86400000);
  if (S.compareRange === 'year') {
    return {
      start: new Date(ms.getFullYear()-1, ms.getMonth(), ms.getDate()).toISOString().slice(0,10),
      end:   new Date(me.getFullYear()-1, me.getMonth(), me.getDate()).toISOString().slice(0,10)
    };
  }
  if (S.compareRange === 'week') {
    // Shift entire window 7 days back
    var ws = new Date(ms); ws.setDate(ws.getDate() - 7);
    var we = new Date(me); we.setDate(we.getDate() - 7);
    return { start: ws.toISOString().slice(0,10), end: we.toISOString().slice(0,10) };
  }
  if (S.compareRange === 'month') {
    // Shift entire window ~30 days back (month-over-month)
    var Ms = new Date(ms); Ms.setDate(Ms.getDate() - 30);
    var Me = new Date(me); Me.setDate(Me.getDate() - 30);
    return { start: Ms.toISOString().slice(0,10), end: Me.toISOString().slice(0,10) };
  }
  // 'previous' — same length immediately before
  var cEnd = new Date(ms); cEnd.setDate(cEnd.getDate() - 1);
  var cStart = new Date(cEnd); cStart.setDate(cStart.getDate() - days);
  return { start: cStart.toISOString().slice(0,10), end: cEnd.toISOString().slice(0,10) };
}

// ── DIRECT API FETCH ─────────────────────────────────────
function doFetch5(siteUrl, base, callback) {
  var data = {}, remaining = 5;
  function done(type, rows) {
    data[type] = rows;
    if (--remaining === 0) callback(data);
  }
  queryGSC(siteUrl, Object.assign({}, base, { dimensions: ['date'],    rowLimit: 500  }), function(e,r){ done('grafico',      e?[]:rowsToGrafico(r));      });
  queryGSC(siteUrl, Object.assign({}, base, { dimensions: ['page'],    rowLimit: 1000 }), function(e,r){ done('paginas',      e?[]:rowsToPaginas(r));      });
  queryGSC(siteUrl, Object.assign({}, base, { dimensions: ['query'],   rowLimit: 1000 }), function(e,r){ done('consultas',    e?[]:rowsToConsultas(r));    });
  queryGSC(siteUrl, Object.assign({}, base, { dimensions: ['device'],  rowLimit: 10   }), function(e,r){ done('dispositivos', e?[]:rowsToDispositivos(r)); });
  queryGSC(siteUrl, Object.assign({}, base, { dimensions: ['country'], rowLimit: 100  }), function(e,r){ done('paises',       e?[]:rowsToPaises(r));        });
}

function fetchGSCData() {
  if (!S.accessToken || !S.gscSiteUrl) return;
  var range = computeDateRange();
  S.gscLoading = true; S.gscData = null; render();
  doFetch5(S.gscSiteUrl, { startDate: range.start, endDate: range.end }, function(data) {
    data.startDate = range.start; data.endDate = range.end;
    S.gscData    = data;
    S.gscLoading = false;
    if (S.compareEnabled) {
      fetchGSCCompareData();
    } else {
      S.gscCompareData = null;
      render();
      var n = (data.paginas || []).length;
      if (n === 0) {
        var multi = (S.gscSites && S.gscSites.length > 1);
        toast(multi
          ? '⚠ "' + S.gscSiteUrl + '" no devolvió datos — elige otra propiedad en Configuración'
          : '⚠ "' + S.gscSiteUrl + '" no devolvió datos en ' + range.start + ' → ' + range.end);
        if (multi) { S.tab = 'configuración'; render(); }
      } else {
        toast('✓ ' + n + ' páginas · ' + range.start + ' → ' + range.end);
      }
    }
  });
}

function fetchGSCCompareData() {
  if (!S.accessToken || !S.gscSiteUrl) return;
  var range = computeCompareRange();
  doFetch5(S.gscSiteUrl, { startDate: range.start, endDate: range.end }, function(data) {
    data.startDate = range.start; data.endDate = range.end;
    S.gscCompareData = data;
    render();
    toast('✓ Comparando: ' + range.start + ' → ' + range.end);
  });
}

function fetchURLFocus(url) {
  if (!S.accessToken || !S.gscSiteUrl) return;
  var range = computeDateRange();
  queryGSC(S.gscSiteUrl, {
    startDate: range.start, endDate: range.end,
    dimensions: ['date'],
    dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: url }] }],
    rowLimit: 500
  }, function(e, r) {
    S.overviewFocusData = e ? [] : rowsToGrafico(r);
    render();
  });
}

// ── GOOGLE INDEXING API ──────────────────────────────────
function requestIndexing(url, callback) {
  if (!S.accessToken) { callback(new Error('Sin token de acceso'), null); return; }
  fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + S.accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url: url, type: 'URL_UPDATED' })
  })
    .then(function(r) { return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      if (!res.ok) callback(new Error((res.data.error && res.data.error.message) || 'Error ' + res.data), null);
      else callback(null, res.data);
    })
    .catch(function(e) { callback(e, null); });
}

function indexURL(urlIdx) {
  var tracked = S.trackedURLs[urlIdx];
  if (!tracked) return;
  if (!S.accessToken) { connectGSC(); return; }
  toast('Enviando URL a Google para indexación...');
  requestIndexing(tracked.url, function(err, data) {
    if (err) {
      toast('Error al indexar: ' + err.message);
      return;
    }
    tracked.lastIndexed = new Date().toISOString().slice(0, 10);
    saveState();
    render();
    toast('✓ URL enviada a Google — suele indexarse en minutos');
  });
}

// ── SWITCH PROPERTY ──────────────────────────────────────
function switchGSCProperty(newSiteUrl) {
  if (!newSiteUrl || newSiteUrl === S.gscSiteUrl) return;
  S.gscSiteUrl    = newSiteUrl;
  S.gscData       = null;
  S.gscCompareData = null;
  saveState();
  fetchGSCData();
}
