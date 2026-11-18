# Panduan memasang "mesin" katalog WISMIR

Katalog website diatur dari **dashboard** (Marketing › Website, lihat panduan dashboard bagian 30). Halaman `wismir.id/admin` sudah dihapus. Panduan ini hanya untuk memasang "mesin"-nya (Google Apps Script) di akun Google kamu. Cukup sekali, sekitar 10 menit.

## Langkah 1. Buat token GitHub (kunci akses terbatas)

Token ini mengizinkan admin menyimpan dan menghapus foto di repo, dan hanya itu.

1. Buka https://github.com/settings/personal-access-tokens/new
2. **Token name:** `wismir-admin`
3. **Expiration:** 1 tahun (catat tanggalnya, nanti buat token baru sebelum habis)
4. **Repository access:** pilih **Only select repositories**, lalu pilih `Wismirmuslim`
5. **Permissions → Repository permissions → Contents:** pilih **Read and write**
6. Klik **Generate token**, lalu **salin tokennya** (hanya tampil sekali)

## Langkah 2. Pasang kode di Google Sheet

1. Buka Google Sheet produk kamu.
2. Menu **Ekstensi (Extensions) → Apps Script**.
3. Hapus semua isi yang ada, lalu tempel seluruh isi file `apps-script/Code.gs` dari repo ini.
4. Klik ikon simpan.

## Langkah 3. Isi pengaturan rahasia

1. Di Apps Script, klik ikon roda gigi **Project Settings** (kiri).
2. Di bagian **Script properties**, klik **Add script property** dan isi tiga hal ini:

| Property | Nilai |
|---|---|
| `ADMIN_PASSWORD` | Kata sandi buatan kamu. Pakai yang panjang (15 karakter atau lebih) |
| `GITHUB_TOKEN` | Token dari Langkah 1 |
| `GITHUB_REPO` | `yogaprasetia16/Wismirmuslim` |

3. Klik **Save script properties**.

## Langkah 4. Deploy

1. Klik **Deploy → New deployment**.
2. Klik ikon roda gigi di samping "Select type", pilih **Web app**.
3. **Execute as:** Me. **Who has access:** Anyone.
4. Klik **Deploy**, lalu **Authorize access** dan pilih akun Google kamu.
   Kalau muncul "Google hasn't verified this app", klik **Advanced → Go to ... (unsafe)**. Ini normal karena script ini buatan kamu sendiri.
5. **Salin Web app URL** (berakhiran `/exec`).

## Langkah 5. Hubungkan ke dashboard

1. Di Script properties, pastikan `ADMIN_PASSWORD` **sama persis dengan PIN dashboard**.
2. Di dashboard: **Settings → Website catalog URL**, tempel Web app URL (berakhiran `/exec`), lalu **Save settings**.
3. Buka **Marketing → ikon globe (Website)**.

## Keamanan data (baca ini)

- **Tab produk di Sheet dipublikasikan ke web sebagai CSV, jadi SEMUA kolomnya bisa dibaca siapa saja** yang tahu alamatnya. Jangan pernah menambah kolom modal, HPP, harga supplier, atau data rahasia lain di tab itu. Simpan data seperti itu di tab atau Sheet lain yang tidak dipublikasikan.
- Kata sandi admin sebaiknya **12 karakter atau lebih** dan tidak dipakai di akun lain.
- **Penguncian otomatis:** kalau kata sandi salah **5 kali** dalam 15 menit, semua akses katalog dikunci **10 menit** (termasuk dengan kata sandi yang benar), supaya kata sandi tidak bisa ditebak berulang-ulang. Pesannya: "Terlalu banyak percobaan salah. Coba lagi dalam N menit." Cukup tunggu. Kalau kamu sendiri sering salah ketik, ini juga yang membuat akses terkunci sebentar.
- Token GitHub dan kata sandi hanya disimpan di Script properties Apps Script. Jangan ditulis di chat, catatan bersama, atau kode.

## Memperbarui kode di Apps Script (kalau `Code.gs` berubah)

1. Buka https://raw.githubusercontent.com/yogaprasetia16/Wismirmuslim/main/apps-script/Code.gs lalu salin semua teksnya.
2. Di Apps Script (Google Sheet **web** → Ekstensi → Apps Script): hapus semua isi, tempel, lalu simpan (Ctrl+S).
3. **Deploy → Manage deployments → ikon pensil (Edit) → Version: New version → Deploy.** Jangan pilih "New deployment", karena alamat `/exec` akan berubah dan harus ditempel ulang di dashboard.

## Catatan penting

- **Perubahan tampil di web** sekitar 1 sampai 5 menit setelah Simpan. Google butuh waktu memperbarui Sheet yang dipublikasikan, dan GitHub butuh 1 sampai 2 menit untuk foto baru.
- **Kalau kode Code.gs diubah nanti**, lakukan **Deploy → Manage deployments → Edit → Version: New version → Deploy**, supaya perubahan berlaku.
- **Kolom harga, warna, dan harga_normal** belum ada di Sheet. Tambahkan kolom itu di Sheet (judul huruf kecil, persis `harga`, `warna`, `harga_normal`), dan kolomnya otomatis muncul di form admin dan di web.
- **Jangan hapus atau ubah nama judul kolom** di Sheet (baris 1), karena form admin dibuat dari judul itu.
- **Lupa kata sandi?** Ubah `ADMIN_PASSWORD` di Script properties.
- **Token bocor atau habis?** Buat token baru (Langkah 1) lalu ganti `GITHUB_TOKEN` di Script properties.
