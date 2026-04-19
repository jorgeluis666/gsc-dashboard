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
  if (!S.accessToken) { toast('Conecta con Google primero (tab Configuración)'); return; }
  if (!S.gscSiteUrl)  { toast('Selecciona una propiedad de Search Console en Configuración'); return; }

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
        'https://www.googleapis.com/auth/drive.readonly'
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
    if (!S.gscSiteUrl && sites.length > 0) S.gscSiteUrl = sites[0];
    saveState(); render();
    toast('✓ Search Console conectado — ' + sites.length + ' propiedad(es)');
  });
}

// ── RESET ALL AND RE-IMPORT ──────────────────────────────
function resetAndImport() {
  if (!confirm('Esto borrará todos los snapshots actuales (' + S.snapshots.length + ') e importará datos frescos de "' + S.gscSiteUrl + '".\n\n¿Continuar?')) return;
  S.snapshots = [];
  S.curIdx = null;
  saveState();
  importFromGSC();
}

// ── SWITCH PROPERTY — clear snapshots and re-import ──────
function switchGSCProperty(newSiteUrl) {
  if (!newSiteUrl || newSiteUrl === S.gscSiteUrl) return;
  var hasSnaps = S.snapshots.some(function(s){ return s.gscSource; });
  if (hasSnaps) {
    if (!confirm('Cambiar de propiedad borrará los ' + S.snapshots.length + ' snapshots actuales e importará los de "' + newSiteUrl + '".\n\n¿Continuar?')) {
      render(); return; // revert selector visually
    }
    S.snapshots = [];
    S.curIdx = null;
  }
  S.gscSiteUrl = newSiteUrl;
  saveState();
  render();
  toast('Propiedad cambiada a ' + newSiteUrl + ' — pulsa "↓ Importar semanas"');
}
