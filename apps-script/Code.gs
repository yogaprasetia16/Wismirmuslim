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
// Testimoni (Marketing > Testimonials di dashboard): daftar disimpan sebagai testimoni/testimoni.json di repo website, fotonya di testimoni/.
var TESTI_DIR = 'testimoni/', TESTI_FILE = 'testimoni/testimoni.json';
// Batas percobaan kata sandi: 5 kali salah dalam 15 menit = semua akses dikunci 10 menit.
var MAX_FAILS = 5, FAIL_WINDOW_S = 900, LOCK_S = 600;
var NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.(jpe?g|png|webp)$/i;

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.h) return hit_(p); // statistik pengunjung dari web (tanpa kata sandi, hanya menambah hitungan)
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
      case 'statsGet':    return json_(statsGet_(req));
      case 'testiList':   return json_(testiList_());
      case 'testiSave':   return json_(testiSave_(req));
      case 'testiDelete': return json_(testiDelete_(req));
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

// ---------- Testimoni ----------
function b64text_(b64) { return Utilities.newBlob(Utilities.base64Decode(String(b64).replace(/\s/g, ''))).getDataAsString('UTF-8'); }

function testiRead_() {
  var r = gh_('get', TESTI_FILE), code = r.getResponseCode();
  if (code === 404) return { sha: null, items: [] };
  if (code !== 200) throw new Error('Gagal membaca testimoni dari GitHub (' + code + '). Cek GITHUB_TOKEN dan GITHUB_REPO.');
  var j = JSON.parse(r.getContentText()), items;
  try { items = JSON.parse(b64text_(j.content)); } catch (e) { items = []; }
  return { sha: j.sha, items: Array.isArray(items) ? items : [] };
}

// Baca, ubah, tulis. Kalau file berubah di tengah jalan (409), ulangi sekali dari bacaan terbaru.
function testiMutate_(fn, msg) {
  for (var attempt = 0; attempt < 2; attempt++) {
    var cur = testiRead_(), items = fn(cur.items);
    var body = { message: msg, content: Utilities.base64Encode(JSON.stringify(items, null, 1), Utilities.Charset.UTF_8), branch: prop_('GITHUB_BRANCH', 'main') };
    if (cur.sha) body.sha = cur.sha;
    var res = gh_('put', TESTI_FILE, body), code = res.getResponseCode();
    if (code < 300) return items;
    if (code !== 409 && code !== 422) throw new Error('Gagal menyimpan testimoni ke GitHub (' + code + ').');
  }
  throw new Error('Testimoni berubah di tempat lain. Muat ulang daftar lalu coba lagi.');
}

function testiClean_(d) {
  d = d || {};
  var fotos = (d.foto || []).map(String).filter(String);
  fotos.forEach(function (n) { if (!NAME_RE.test(n)) throw new Error('Nama foto tidak valid: ' + n); });
  var nama = String(d.nama || '').trim(), komentar = String(d.komentar || '').trim();
  if (!fotos.length && !komentar) throw new Error('Isi minimal satu foto atau komentar.');
  if (nama.length > 80) throw new Error('Nama terlalu panjang (maksimal 80 huruf).');
  if (komentar.length > 1000) throw new Error('Komentar terlalu panjang (maksimal 1000 huruf).');
  return { foto: fotos, nama: nama, komentar: komentar };
}

function testiList_() {
  var items = testiRead_().items.map(function (t) {
    return { id: String(t.id || ''), foto: (t.foto || []).map(String), nama: String(t.nama || ''), komentar: String(t.komentar || '') };
  });
  return { ok: true, items: items };
}

function testiSave_(req) {
  var c = testiClean_(req.data), photos = req.newPhotos || [];
  photos.forEach(function (p) { if (!NAME_RE.test(p.name || '')) throw new Error('Nama foto tidak valid: ' + p.name); });
  var id = req.id ? String(req.id) : '';
  photos.forEach(function (p) { ghPut_(TESTI_DIR + p.name, p.b64, 'Foto testimoni'); });
  var done = { id: id };
  testiMutate_(function (items) {
    if (id) {
      var i = -1;
      items.forEach(function (t, k) { if (String(t.id) === id) i = k; });
      if (i < 0) throw new Error('Testimoni tidak ditemukan. Muat ulang daftar.');
      var o = req.orig;
      if (o && JSON.stringify([(items[i].foto || []).join('|'), items[i].nama || '', items[i].komentar || '']) !== JSON.stringify([(o.foto || []).join('|'), o.nama || '', o.komentar || ''])) {
        throw new Error('Testimoni ini berubah di tempat lain. Muat ulang daftar lalu coba lagi.');
      }
      items[i] = { id: id, foto: c.foto, nama: c.nama, komentar: c.komentar };
    } else {
      done.id = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
      items.unshift({ id: done.id, foto: c.foto, nama: c.nama, komentar: c.komentar });
    }
    return items;
  }, 'Testimoni: ' + (c.nama || 'tanpa nama'));
  return { ok: true, id: done.id, uploaded: photos.map(function (p) { return p.name; }), deleted: testiDeleteFiles_(req.deleteFiles) };
}

function testiDelete_(req) {
  var id = String(req.id || '');
  if (!id) throw new Error('Testimoni tidak ditemukan.');
  testiMutate_(function (items) {
    var n = items.filter(function (t) { return String(t.id) !== id; });
    if (n.length === items.length) throw new Error('Testimoni tidak ditemukan. Muat ulang daftar.');
    return n;
  }, 'Hapus testimoni');
  return { ok: true, deleted: testiDeleteFiles_(req.deleteFiles) };
}

function testiDeleteFiles_(names) {
  var done = [];
  (names || []).forEach(function (n) { if (NAME_RE.test(n) && ghDelete_(TESTI_DIR + n)) done.push(n); });
  return done;
}

// ---------- Statistik pengunjung ----------
// Web mengirim hitungan lewat GET (doGet): ?h=<kejadian>&k=<kunci>&s=<id sesi>. Tanpa cookie, tanpa IP, tanpa data pribadi.
// Kejadian: visit (kunci = sumber: instagram, tiktok, google, direct, ...), product (kunci = slug produk yang dibuka),
// wa (klik tombol WhatsApp, kunci = slug atau "umum"), share (tombol Bagikan). Disimpan di tab "Statistik" Sheet ini:
// id | tanggal | kejadian | kunci | jumlah  (satu baris per tanggal + kejadian + kunci). Tab itu tidak ikut dipublikasikan ke web.
var HIT_EVENTS = { visit: 1, product: 1, wa: 1, share: 1 };
var STATS_TAB = 'Statistik', HIT_PER_SESSION_HOUR = 80, HIT_PER_DAY = 20000;

function statsSheet_() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(STATS_TAB);
  if (!sh) {
    sh = ss.insertSheet(STATS_TAB);
    sh.getRange(1, 1, 1, 5).setValues([['id', 'tanggal', 'kejadian', 'kunci', 'jumlah']]);
    sh.getRange('A:B').setNumberFormat('@'); // teks, supaya tanggal tidak diubah Sheets menjadi tanggal bergeser zona waktu
    sh.setFrozenRows(1);
  }
  return sh;
}

function today_() { return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'); }

function hit_(p) {
  var ok = json_({ ok: true });
  try {
    var ev = String(p.h || ''), key = String(p.k || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
    if (!HIT_EVENTS[ev]) return json_({ ok: false });
    if (!key) key = ev === 'visit' ? 'direct' : 'umum';
    var sid = String(p.s || '').replace(/[^a-z0-9]/gi, '').slice(0, 24) || 'x';
    var cache = CacheService.getScriptCache(), day = today_();
    var ck = 'hit:' + sid, n = Number(cache.get(ck) || 0);
    if (n >= HIT_PER_SESSION_HOUR) return json_({ ok: false });
    var dk = 'hitday:' + day, dn = Number(cache.get(dk) || 0);
    if (dn >= HIT_PER_DAY) return json_({ ok: false });
    cache.put(ck, String(n + 1), 3600);
    cache.put(dk, String(dn + 1), 90000);
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(4000)) return ok; // sibuk: hitungan ini dilewati, tidak mengganggu pengunjung
    try {
      var sh = statsSheet_(), id = day + '|' + ev + '|' + key;
      var f = sh.createTextFinder(id).matchEntireCell(true).findNext();
      if (f) { var c = sh.getRange(f.getRow(), 5); c.setValue(Number(c.getValue() || 0) + 1); }
      else sh.appendRow([id, day, ev, key, 1]);
    } finally { lock.releaseLock(); }
  } catch (err) {}
  return ok;
}

// Untuk dashboard (pakai kata sandi): baris statistik N hari terakhir.
function statsGet_(req) {
  var days = Math.max(1, Math.min(120, Number(req.days) || 30));
  var cut = Utilities.formatDate(new Date(Date.now() - (days - 1) * 86400000), 'Asia/Jakarta', 'yyyy-MM-dd');
  var sh = statsSheet_(), last = sh.getLastRow(), rows = [];
  if (last > 1) {
    var from = Math.max(2, last - 9999);
    sh.getRange(from, 2, last - from + 1, 4).getValues().forEach(function (r) {
      var d = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Jakarta', 'yyyy-MM-dd') : String(r[0]);
      if (d >= cut) rows.push([d, String(r[1]), String(r[2]), Number(r[3]) || 0]);
    });
  }
  return { ok: true, from: cut, today: today_(), rows: rows };
}
