// ── GOOGLE DRIVE INTEGRATION ─────────────────────────────
// Requires: parser.js (parseCSV, detectType, normalizeRow)
//           app.js    (S, saveState, render, toast)

var gapiLoaded = false;
var gisLoaded  = false;

window.gapiCallback = function() { gapiLoaded = true; tryInitDrive(); };
window.gisCallback  = function() { gisLoaded  = true; tryInitDrive(); };

// Attach onload to the async Google API script tags
document.querySelector('script[src*="api.js"]').onload = window.gapiCallback;
document.querySelector('script[src*="gsi/client"]').onload = window.gisCallback;

function tryInitDrive() {
  if (!gapiLoaded || !gisLoaded) return;
  if (!S.clientId || !S.folderId) return;
  gapi.load('client', function(){
    gapi.client.init({ discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'] })
      .then(function(){ initTokenClient(); });
  });
}

var tokenClient = null;

function initTokenClient() {
  if (!S.clientId) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: S.clientId,
    scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/webmasters.readonly',
    callback: function(resp) {
      if (resp.error) {
        S.driveStatus = 'disconnected';
        S.driveMsg = 'Error: ' + resp.error;
        render(); return;
      }
      S.accessToken = resp.access_token;
      S.driveStatus = 'connected';
      S.driveMsg = 'Conectado a Google Drive';
      render();
      toast('✓ Conectado a Google — cargando propiedades de Search Console...');
      // Auto-fetch GSC sites after successful auth
      if (typeof fetchGSCSites === 'function') fetchGSCSites();
    }
  });
}

function connectDrive() {
  if (!S.clientId) { toast('Client ID no configurado'); return; }
  // folderId only required when connecting Drive for CSV sync, not for GSC-only auth
  if (!S.folderId && !S.gscPendingConnect) { toast('Configura el Folder ID de Drive primero'); return; }
  S.driveStatus = 'loading'; S.driveMsg = 'Autenticando...'; render();
  if (!gapiLoaded || !gisLoaded) {
    toast('Las librerías de Google aún cargan, espera un momento e intenta de nuevo.');
    S.driveStatus = 'disconnected'; render(); return;
  }
  if (!tokenClient) {
    gapi.load('client', function(){
      gapi.client.init({ discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'] })
        .then(function(){
          initTokenClient();
          tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

function disconnectDrive() {
  if (S.accessToken) google.accounts.oauth2.revoke(S.accessToken, function(){});
  S.accessToken = null; S.driveStatus = 'disconnected'; S.driveMsg = '';
  render(); toast('Desconectado de Google Drive');
}

// List ALL CSV files in the root Drive folder (flat structure)
// Files must be named: PERIODO_TipoArchivo.csv  e.g. 2026-W14_Consultas.csv
function listAllCSVs(callback) {
  gapi.client.drive.files.list({
    q: "'"+S.folderId+"' in parents and mimeType='text/csv' and trashed=false",
    fields: 'files(id,name)',
    orderBy: 'name',
    pageSize: 500
  }).then(function(resp){ callback(null, resp.result.files||[]); })
    .catch(function(err){ callback(err, []); });
}

// Download a file by ID
function downloadFile(fileId, callback) {
  gapi.client.drive.files.get({ fileId: fileId, alt: 'media' })
    .then(function(resp){ callback(null, resp.body); })
    .catch(function(err){ callback(err, null); });
}

// Extract period from filename: "2026-W14_Consultas.csv" → "2026-W14"
function extractPeriod(filename) {
  var name = filename.replace(/\.csv$/i, '');
  var parts = name.split('_');
  if (parts.length >= 2) return parts[0].trim();
  return name;
}

// Refresh: read all CSV files, group by period, add new snapshots
function refreshFromDrive() {
  if (!S.accessToken) { connectDrive(); return; }
  S.refreshing = true; render();
  toast('Leyendo archivos de Google Drive...');

  listAllCSVs(function(err, files) {
    if (err) {
      S.refreshing = false;
      if (err.status === 401) { S.accessToken = null; S.driveStatus = 'disconnected'; }
      toast('Error al leer Drive: ' + (err.result && err.result.error && err.result.error.message || err));
      render(); return;
    }

    if (!files.length) {
      S.refreshing = false;
      toast('La carpeta está vacía. Sube archivos CSV con el formato PERIODO_Tipo.csv');
      render(); return;
    }

    // Group files by period
    var groups = {};
    files.forEach(function(f) {
      var period = extractPeriod(f.name);
      if (!groups[period]) groups[period] = [];
      groups[period].push(f);
    });

    // Find which periods are already loaded
    var existing = {};
    S.snapshots.forEach(function(s){ if (s.driveFolder) existing[s.driveFolder] = true; });

    var newPeriods = Object.keys(groups).filter(function(p){ return !existing[p]; }).sort();

    if (!newPeriods.length) {
      S.refreshing = false;
      toast('✓ Todo actualizado — no hay períodos nuevos');
      render(); return;
    }

    toast('Encontrados '+newPeriods.length+' período(s) nuevo(s)...');
    var loaded = 0;

    newPeriods.forEach(function(period) {
      var csvFiles = groups[period];
      var data = {};
      var remaining = csvFiles.length;

      csvFiles.forEach(function(file) {
        downloadFile(file.id, function(err3, fileContent) {
          if (!err3 && fileContent) {
            var rows = parseCSV(fileContent);
            if (rows.length) {
              var type = detectType(rows[0]);
              // Also try detecting type from filename if header detection fails
              if (type === 'unknown') {
                var nl = file.name.toLowerCase();
                if (nl.includes('consul'))    type = 'consultas';
                else if (nl.includes('gina')||nl.includes('page')) type = 'paginas';
                else if (nl.includes('gr')  ||nl.includes('graf')) type = 'grafico';
                else if (nl.includes('disp'))  type = 'dispositivos';
                else if (nl.includes('pa') && (nl.includes('is')||nl.includes('ís'))) type = 'paises';
              }
              if (type !== 'unknown') {
                data[type] = rows.map(function(r){ return normalizeRow(r, type); });
              }
            }
          }
          remaining--;
          if (remaining === 0) {
            if (Object.keys(data).length > 0) {
              S.snapshots.push({
                id: Date.now() + Math.random(),
                label: period,
                date: new Date().toISOString(),
                driveFolder: period,
                data: data
              });
            }
            loaded++;
            if (loaded === newPeriods.length) finishRefresh();
          }
        });
      });
    });
  });
}

function finishRefresh() {
  S.snapshots.sort(function(a,b){ return a.label.localeCompare(b.label); });
  S.curIdx = S.snapshots.length > 0 ? S.snapshots.length - 1 : null;
  S.refreshing = false;
  saveState();
  render();
  toast('✓ Datos actualizados: '+S.snapshots.length+' períodos cargados');
}
