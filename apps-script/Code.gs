/**
 * WISMIR Admin API (Google Apps Script)
 * Dipasang di Google Sheet produk: Extensions > Apps Script. Panduan: admin/PANDUAN.md
 *
 * Script Properties yang wajib diisi (Project Settings > Script properties):
 *   ADMIN_PASSWORD  kata sandi halaman admin (buat sendiri, panjang lebih baik)
 *   GITHUB_TOKEN    fine-grained token, hanya repo ini, izin Contents: Read and write
 *   GITHUB_REPO     contoh: yogaprasetia16/Wismirmuslim
 * Opsional: GITHUB_BRANCH (default main), SHEET_GID (default 0)
 */
var PHOTO_DIR = 'foto/';
// Batas percobaan kata sandi: 5 kali salah dalam 15 menit = semua akses dikunci 10 menit.
var MAX_FAILS = 5, FAIL_WINDOW_S = 900, LOCK_S = 600;
var NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.(jpe?g|png|webp)$/i;

function doGet() {
  return json_({ ok: true, info: 'WISMIR admin API' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Permintaan tidak valid.' }); }
  var left = lockedMinutes_();
  if (left) return json_({ ok: false, error: 'Terlalu banyak percobaan salah. Coba lagi dalam ' + left + ' menit.' });
  if (!auth_(req.pass)) { noteFail_(); Utilities.sleep(800); return json_({ ok: false, error: 'Kata sandi salah.' }); }
  noteOk_();
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    switch (req.action) {
      case 'list':   return json_(list_());
      case 'save':   return json_(save_(req));
      case 'delete': return json_(del_(req));
      default:       return json_({ ok: false, error: 'Aksi tidak dikenal.' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function prop_(k, d) { return PropertiesService.getScriptProperties().getProperty(k) || d || ''; }

function auth_(p) {
  var real = prop_('ADMIN_PASSWORD');
  if (!real || typeof p !== 'string' || p.length !== real.length) return false;
  var diff = 0;
  for (var i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ p.charCodeAt(i);
  return diff === 0;
}

// Sisa menit penguncian (0 = tidak terkunci). Kalau cache bermasalah, akses tidak diblokir.
function lockedMinutes_() {
  try {
    var left = Number(CacheService.getScriptCache().get('lockUntil') || 0) - Date.now();
    return left > 0 ? Math.ceil(left / 60000) : 0;
  } catch (e) { return 0; }
}

function noteFail_() {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      var c = CacheService.getScriptCache();
      var n = Number(c.get('fails') || 0) + 1;
      if (n >= MAX_FAILS) { c.put('lockUntil', String(Date.now() + LOCK_S * 1000), LOCK_S + 60); c.remove('fails'); }
      else c.put('fails', String(n), FAIL_WINDOW_S);
    } finally { lock.releaseLock(); }
  } catch (e) {}
}

function noteOk_() {
  try { CacheService.getScriptCache().remove('fails'); } catch (e) {}
}

function sheet_() {
  var ss = SpreadsheetApp.getActive();
  var gid = Number(prop_('SHEET_GID', '0'));
  var sh = ss.getSheets().filter(function (s) { return s.getSheetId() === gid; })[0];
  return sh || ss.getSheets()[0];
}

function headers_(sh) {
  var n = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, n).getValues()[0].map(function (h) { return String(h).trim(); });
}

function list_() {
  var sh = sheet_(), head = headers_(sh), last = sh.getLastRow(), items = [];
  if (last > 1) {
    var vals = sh.getRange(2, 1, last - 1, head.length).getDisplayValues();
    vals.forEach(function (r, i) {
      var o = { _row: i + 2 };
      head.forEach(function (h, c) { if (h) o[h.toLowerCase()] = String(r[c]).trim(); });
      if (o.nama) items.push(o);
    });
  }
  return { ok: true, headers: head.filter(String).map(function (h) { return h.toLowerCase(); }), items: items };
}

function rowIndex_(sh, row, nama) {
  var last = sh.getLastRow();
  if (!row || row < 2 || row > last) throw new Error('Baris produk tidak ditemukan. Muat ulang halaman.');
  var head = headers_(sh), c = head.map(function (h) { return h.toLowerCase(); }).indexOf('nama');
  var cur = String(sh.getRange(row, c + 1).getValue()).trim();
  if (nama != null && cur !== String(nama).trim()) throw new Error('Data berubah di Sheet. Muat ulang halaman lalu coba lagi.');
  return row;
}

function save_(req) {
  var sh = sheet_(), head = headers_(sh), lower = head.map(function (h) { return h.toLowerCase(); });
  var d = req.data || {};
  if (!String(d.nama || '').trim()) throw new Error('Nama produk wajib diisi.');
  var uploaded = [];
  (req.newPhotos || []).forEach(function (p) {
    if (!NAME_RE.test(p.name || '')) throw new Error('Nama foto tidak valid: ' + p.name);
    ghPut_(PHOTO_DIR + p.name, p.b64, 'Foto produk: ' + d.nama);
    uploaded.push(p.name);
  });
  var vals = head.map(function (h, i) { var k = lower[i]; return k && d[k] != null ? String(d[k]) : ''; });
  if (req.row) {
    var r = rowIndex_(sh, Number(req.row), req.origNama);
    var cur = sh.getRange(r, 1, 1, head.length).getValues()[0];
    vals = vals.map(function (v, i) { return lower[i] && d[lower[i]] != null ? v : cur[i]; });
    sh.getRange(r, 1, 1, head.length).setValues([vals]);
  } else {
    sh.appendRow(vals);
  }
  var del = [];
  (req.deleteFiles || []).forEach(function (n) { if (NAME_RE.test(n) && ghDelete_(PHOTO_DIR + n)) del.push(n); });
  return { ok: true, uploaded: uploaded, deleted: del };
}

function del_(req) {
  var sh = sheet_();
  var r = rowIndex_(sh, Number(req.row), req.nama);
  sh.deleteRow(r);
  var del = [];
  (req.deleteFiles || []).forEach(function (n) { if (NAME_RE.test(n) && ghDelete_(PHOTO_DIR + n)) del.push(n); });
  return { ok: true, deleted: del };
}

function gh_(method, path, body) {
  var url = 'https://api.github.com/repos/' + prop_('GITHUB_REPO') + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  if (method === 'get') url += '?ref=' + encodeURIComponent(prop_('GITHUB_BRANCH', 'main'));
  var opt = {
    method: method === 'get' ? 'get' : method,
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + prop_('GITHUB_TOKEN'), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  };
  if (body) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(body); }
  return UrlFetchApp.fetch(url, opt);
}

function ghPut_(path, b64, msg) {
  var branch = prop_('GITHUB_BRANCH', 'main');
  var body = { message: msg, content: b64, branch: branch };
  var ex = gh_('get', path);
  if (ex.getResponseCode() === 200) body.sha = JSON.parse(ex.getContentText()).sha;
  var res = gh_('put', path, body);
  if (res.getResponseCode() >= 300) throw new Error('Gagal mengirim foto ke GitHub (' + res.getResponseCode() + '). Cek GITHUB_TOKEN dan GITHUB_REPO.');
}

function ghDelete_(path) {
  var ex = gh_('get', path);
  if (ex.getResponseCode() !== 200) return false;
  var res = gh_('delete', path, { message: 'Hapus foto produk', sha: JSON.parse(ex.getContentText()).sha, branch: prop_('GITHUB_BRANCH', 'main') });
  return res.getResponseCode() < 300;
}
