/**
 * WISMIR – cadangan otomatis Google Sheet (proyek Apps Script TERPISAH).
 *
 * Menyalin Sheet dashboard/kasir dan Sheet katalog "web" ke satu folder Google Drive
 * setiap tanggal 1, sekitar jam 02.00 (zona waktu proyek). Hanya KEEP salinan terakhir
 * per Sheet yang disimpan; yang lebih lama masuk Sampah Drive (bisa dipulihkan 30 hari).
 *
 * Pengaturan (Project Settings → Script properties), TIDAK ditulis di kode ini:
 *   SHEET_DASHBOARD : ID Google Sheet dashboard/kasir  (teks di URL antara /d/ dan /edit)
 *   SHEET_WEB       : ID Google Sheet katalog "web"
 *   FOLDER_NAME     : (opsional) nama folder cadangan, bawaan "Cadangan WISMIR"
 *
 * Cara pakai: jalankan pasangJadwal() sekali (beri izin), lalu cadangkanSekarang() untuk uji.
 */
var KEEP = 6;
var BAWAAN_FOLDER = 'Cadangan WISMIR';

function daftarSheet_() {
  var p = PropertiesService.getScriptProperties();
  var d = [];
  [['Dashboard', 'SHEET_DASHBOARD'], ['Web', 'SHEET_WEB']].forEach(function (x) {
    var id = (p.getProperty(x[1]) || '').trim();
    if (id) d.push({ label: x[0], id: id });
  });
  return d;
}

function folder_() {
  var nama = (PropertiesService.getScriptProperties().getProperty('FOLDER_NAME') || BAWAAN_FOLDER).trim() || BAWAAN_FOLDER;
  var it = DriveApp.getFoldersByName(nama);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nama);
}

function tanggal_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Dipanggil jadwal bulanan; boleh dijalankan manual untuk uji. */
function cadangkanSekarang() {
  var sheets = daftarSheet_();
  if (!sheets.length) throw new Error('Isi SHEET_DASHBOARD dan/atau SHEET_WEB di Script properties.');
  var fo = folder_(), gagal = [], hasil = [];
  sheets.forEach(function (s) {
    try {
      var nama = 'Cadangan ' + s.label + ' ' + tanggal_();
      DriveApp.getFileById(s.id).makeCopy(nama, fo);
      var hapus = rapikan_(fo, 'Cadangan ' + s.label + ' ');
      hasil.push(s.label + ': ' + nama + (hapus ? ' (' + hapus + ' salinan lama ke Sampah)' : ''));
    } catch (e) {
      gagal.push(s.label + ': ' + e.message);
    }
  });
  if (gagal.length) {
    try {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Cadangan WISMIR gagal',
        'Sebagian cadangan gagal:\n' + gagal.join('\n') + '\n\nBuka Apps Script proyek cadangan → Executions untuk detailnya.');
    } catch (x) {}
    throw new Error(gagal.join(' | '));
  }
  Logger.log(hasil.join('\n'));
  return hasil;
}

/** Simpan KEEP terbaru (nama bertanggal, urut abjad = urut waktu); sisanya ke Sampah. */
function rapikan_(fo, awalan) {
  var daftar = [], it = fo.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(awalan) === 0) daftar.push(f);
  }
  daftar.sort(function (a, b) { return a.getName() < b.getName() ? 1 : a.getName() > b.getName() ? -1 : 0; });
  var n = 0;
  daftar.slice(KEEP).forEach(function (f) { f.setTrashed(true); n++; });
  return n;
}

/** Jalankan SEKALI: memasang jadwal tanggal 1 tiap bulan, sekitar jam 02.00. */
function pasangJadwal() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cadangkanSekarang') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cadangkanSekarang').timeBased().onMonthDay(1).atHour(2).create();
  Logger.log('Jadwal terpasang: tanggal 1 tiap bulan, sekitar jam 02.00 (' + Session.getScriptTimeZone() + ').');
}
