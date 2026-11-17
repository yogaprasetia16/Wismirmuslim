# Panduan memasang Admin WISMIR

Halaman admin ada di **wismir.id/admin**. Agar bisa dipakai, pasang dulu "mesin"-nya di akun Google kamu. Cukup sekali, sekitar 10 menit.

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

## Langkah 5. Masuk

Buka **wismir.id/admin**, tempel Web app URL, isi kata sandi, lalu masuk.
Kalau URL-nya dikirim ke Claude, URL itu bisa dipasang permanen di halaman admin sehingga tidak perlu ditempel lagi.

## Catatan penting

- **Perubahan tampil di web** sekitar 1 sampai 5 menit setelah Simpan. Google butuh waktu memperbarui Sheet yang dipublikasikan, dan GitHub butuh 1 sampai 2 menit untuk foto baru.
- **Kalau kode Code.gs diubah nanti**, lakukan **Deploy → Manage deployments → Edit → Version: New version → Deploy**, supaya perubahan berlaku.
- **Kolom harga, warna, dan harga_normal** belum ada di Sheet. Tambahkan kolom itu di Sheet (judul huruf kecil, persis `harga`, `warna`, `harga_normal`), dan kolomnya otomatis muncul di form admin dan di web.
- **Jangan hapus atau ubah nama judul kolom** di Sheet (baris 1), karena form admin dibuat dari judul itu.
- **Lupa kata sandi?** Ubah `ADMIN_PASSWORD` di Script properties.
- **Token bocor atau habis?** Buat token baru (Langkah 1) lalu ganti `GITHUB_TOKEN` di Script properties.
